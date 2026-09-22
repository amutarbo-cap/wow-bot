import {
  Aura,
  Build,
  Consumibles,
  Hechizo,
  PlayerFightData,
  Rendimiento,
  Supervivencia,
  Talento,
  Timeline,
} from '../modelo/player-fight-data';
import { RbEntrada, RbNodo, SpecTalentos } from '../talentos/talentos-tipos';
import { RawJugador, WclCombatantInfo, WclDetalle } from '../wcl/wcl-tipos';
import {
  DEFENSIVOS,
  RANURAS_IGNORADAS,
  REGEX_COMIDA,
  REGEX_FLASK,
  REGEX_RUNA,
  esPocionDps,
} from './catalogo-habilidades';
import { construirCasteos, detectarCooldowns, detectarHuecos } from './timeline';

export function normalizar(raw: RawJugador, spec: SpecTalentos | null): PlayerFightData {
  const { fight, detalle } = raw;
  const duracionMs = fight.endTime - fight.startTime;
  const minutos = duracionMs / 60000;
  const ci = detalle.combatantInfo?.data[0] ?? null;
  const nombres = new Map(detalle.masterData.abilities.map((a) => [a.gameID, a.name]));
  const casteosPorNombre = new Map<string, number>();
  for (const e of detalle.casteos?.data.entries ?? []) {
    casteosPorNombre.set(e.name, (casteosPorNombre.get(e.name) ?? 0) + e.total);
  }
  const buffsPropios = new Set((detalle.buffs?.data.auras ?? []).map((a) => a.name));

  const muertes = (detalle.muertes?.data.entries ?? []).map((m) => m.timestamp - fight.startTime);
  const casteos = construirCasteos(raw.eventos, fight.startTime, nombres);
  const huecos = detectarHuecos(casteos, duracionMs, muertes);
  const downtimeMs = huecos.reduce((acc, h) => acc + h.duracion, 0);
  const timeline: Timeline = {
    casteos,
    huecos,
    downtimeMs,
    downtimePct: duracionMs > 0 ? (downtimeMs / duracionMs) * 100 : 0,
    cooldowns: detectarCooldowns(casteosPorNombre, buffsPropios, duracionMs),
  };

  return {
    meta: {
      reportCode: raw.reportCode,
      fightId: fight.id,
      sourceId: raw.actor.id,
      nombre: raw.actor.name,
      clase: raw.detallesJugador?.type ?? raw.actor.subType,
      spec: raw.detallesJugador?.specs[0]?.spec ?? '',
      specId: ci?.specID ?? null,
      boss: fight.name,
      encounterId: fight.encounterID,
      dificultad: fight.difficulty,
      kill: !!fight.kill,
      duracionMs,
    },
    disponible: {
      build: !!ci,
      rendimiento: !!detalle.danoHecho,
      rotacion: raw.eventos.length > 0,
      supervivencia: !!detalle.danoRecibido && !!detalle.muertes,
    },
    build: normalizarBuild(ci, spec, detalle, casteosPorNombre),
    rendimiento: normalizarRendimiento(detalle, minutos, duracionMs, casteosPorNombre),
    timeline,
    auras: normalizarAuras(detalle, duracionMs),
    supervivencia: normalizarSupervivencia(raw, minutos, casteosPorNombre),
  };
}

export function resolverTalentos(
  arbol: WclCombatantInfo['talentTree'],
  spec: SpecTalentos | null,
): { talentos: Talento[]; heroe: string | null } {
  const porEntrada = new Map<
    number,
    { nodo: RbNodo; entrada: RbEntrada; arbol: Talento['arbol'] }
  >();
  const indexar = (nodos: RbNodo[], tipo: Talento['arbol']) => {
    for (const nodo of nodos)
      for (const entrada of nodo.entries)
        porEntrada.set(entrada.id, { nodo, entrada, arbol: tipo });
  };
  if (spec) {
    indexar(spec.classNodes, 'clase');
    indexar(spec.specNodes, 'spec');
    indexar(spec.heroNodes, 'heroe');
  }
  const subarboles = new Map<number, string>();
  for (const nodo of spec?.subTreeNodes ?? [])
    for (const e of nodo.entries) subarboles.set(e.id, e.name ?? nodo.name);

  let heroe: string | null = null;
  const talentos: Talento[] = [];
  for (const t of arbol) {
    const sub = subarboles.get(t.id);
    if (sub) {
      heroe = sub;
      continue;
    }
    const m = porEntrada.get(t.id);
    talentos.push({
      entryId: t.id,
      nodeId: t.nodeID,
      nombre: m ? (m.entrada.name ?? m.nodo.name) : `Talento #${t.id}`,
      rango: t.rank,
      arbol: m?.arbol ?? 'spec',
      spellId: m?.entrada.spellId ?? null,
      icono: m?.entrada.icon ?? null,
    });
  }
  return { talentos, heroe };
}

function normalizarBuild(
  ci: WclCombatantInfo | null,
  spec: SpecTalentos | null,
  detalle: WclDetalle,
  casteosPorNombre: Map<string, number>,
): Build {
  const { talentos, heroe } = ci
    ? resolverTalentos(ci.talentTree, spec)
    : { talentos: [], heroe: null };
  const equipo = (ci?.gear ?? [])
    .map((g, ranura) => ({
      ranura,
      itemId: g.id,
      ilvl: g.itemLevel,
      encantamiento: g.permanentEnchant ?? null,
      gemas: (g.gems ?? []).map((x) => x.id),
      bonusIds: g.bonusIDs ?? [],
      icono: g.icon,
    }))
    .filter((p) => p.itemId > 0 && !RANURAS_IGNORADAS.has(p.ranura));
  const ilvlMedio = equipo.length ? equipo.reduce((a, p) => a + p.ilvl, 0) / equipo.length : 0;
  const buffs = (detalle.buffs?.data.auras ?? []).map((a) => a.name);
  const buscar = (re: RegExp) => buffs.find((n) => re.test(n)) ?? null;
  const consumibles: Consumibles = {
    flask: buscar(REGEX_FLASK),
    comida: buscar(REGEX_COMIDA),
    runa: buscar(REGEX_RUNA),
    pocionDps: [...buffs, ...casteosPorNombre.keys()].find(esPocionDps) ?? null,
  };
  return {
    talentos,
    heroe,
    equipo,
    ilvlMedio,
    stats: {
      principal: ci ? Math.max(ci.strength, ci.agility, ci.intellect) : 0,
      critico: ci ? Math.max(ci.critMelee, ci.critRanged, ci.critSpell) : 0,
      celeridad: ci ? Math.max(ci.hasteMelee, ci.hasteRanged, ci.hasteSpell) : 0,
      maestria: ci?.mastery ?? 0,
      versatilidad: ci?.versatilityDamageDone ?? 0,
    },
    consumibles,
  };
}

interface Grupo<T> {
  principal: T;
  total: number;
  miembros: T[];
}

/** Une las entradas de una tabla de WCL que comparten nombre (el mismo hechizo con varios IDs): suma el total y conserva como principal la de mayor total. */
function agruparPorNombre<T extends { name: string; total: number }>(entradas: T[]): Grupo<T>[] {
  const grupos = new Map<string, Grupo<T>>();
  for (const e of entradas) {
    const g = grupos.get(e.name);
    if (!g) {
      grupos.set(e.name, { principal: e, total: e.total, miembros: [e] });
      continue;
    }
    g.total += e.total;
    g.miembros.push(e);
    if (e.total > g.principal.total) g.principal = e;
  }
  return [...grupos.values()];
}

function normalizarRendimiento(
  detalle: WclDetalle,
  minutos: number,
  duracionMs: number,
  casteosPorNombre: Map<string, number>,
): Rendimiento {
  const entradas = detalle.danoHecho?.data.entries ?? [];
  const casteos = detalle.casteos?.data.entries ?? [];
  const casteosPorGuid = new Map(casteos.map((c) => [c.guid, c.total]));

  // Merge entries with the same name
  const grupos = agruparPorNombre(entradas);
  const danoTotal = grupos.reduce((a, g) => a + g.total, 0);

  const hechizos: Hechizo[] = grupos
    .map((grupo) => {
      // Sum casts across all members: use e.uses if present, fall back to guid, then name
      let n = 0;
      for (const m of grupo.miembros) {
        n += m.uses ?? casteosPorGuid.get(m.guid) ?? 0;
      }
      // If no casts found via guid, try name
      if (n === 0) {
        n = casteosPorNombre.get(grupo.principal.name) ?? 0;
      }

      return {
        guid: grupo.principal.guid,
        nombre: grupo.principal.name,
        icono: grupo.principal.abilityIcon ?? null,
        dano: grupo.total,
        porcentaje: danoTotal > 0 ? (grupo.total / danoTotal) * 100 : 0,
        casteos: n,
        cpm: minutos > 0 ? n / minutos : 0,
        danoPorCasteo: n > 0 ? grupo.total / n : 0,
      };
    })
    .sort((a, b) => b.dano - a.dano);
  return { dps: duracionMs > 0 ? danoTotal / (duracionMs / 1000) : 0, danoTotal, hechizos };
}

function normalizarAuras(detalle: WclDetalle, duracionMs: number): Aura[] {
  const pct = (uptime: number) => (duracionMs > 0 ? Math.min(100, (uptime / duracionMs) * 100) : 0);
  return [
    ...(detalle.buffs?.data.auras ?? []).map((a) => ({
      guid: a.guid,
      nombre: a.name,
      tipo: 'buff' as const,
      uptimePct: pct(a.totalUptime),
    })),
    ...(detalle.debuffs?.data.auras ?? []).map((a) => ({
      guid: a.guid,
      nombre: a.name,
      tipo: 'debuff' as const,
      uptimePct: pct(a.totalUptime),
    })),
  ];
}

function normalizarSupervivencia(
  raw: RawJugador,
  minutos: number,
  casteosPorNombre: Map<string, number>,
): Supervivencia {
  const entradas = raw.detalle.danoRecibido?.data.entries ?? [];

  // Merge entries with the same name
  const grupos = agruparPorNombre(entradas);

  const danoRecibido = grupos
    .map((grupo) => ({
      guid: grupo.principal.guid,
      nombre: grupo.principal.name,
      origen: grupo.principal.actorName ?? '',
      total: grupo.total,
      porMinuto: minutos > 0 ? grupo.total / minutos : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    danoRecibido,
    totalRecibido: danoRecibido.reduce((a, d) => a + d.total, 0),
    muertes: (raw.detalle.muertes?.data.entries ?? []).map((m) => ({
      t: m.timestamp - raw.fight.startTime,
      causa: m.killingBlow?.name ?? 'Desconocido',
    })),
    defensivos: [...casteosPorNombre]
      .filter(([nombre]) => DEFENSIVOS.has(nombre))
      .map(([nombre, usos]) => ({ nombre, usos })),
    pocionesVida: raw.detallesJugador?.potionUse ?? 0,
    piedrasVida: raw.detallesJugador?.healthstoneUse ?? 0,
  };
}
