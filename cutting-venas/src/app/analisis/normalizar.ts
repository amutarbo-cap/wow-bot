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
  const casteosPorNombre = new Map((detalle.casteos?.data.entries ?? []).map((e) => [e.name, e.total]));
  const buffsPropios = new Set((detalle.buffs?.data.auras ?? []).map((a) => a.name));

  const casteos = construirCasteos(raw.eventos, fight.startTime, nombres);
  const huecos = detectarHuecos(casteos, duracionMs);
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
    rendimiento: normalizarRendimiento(detalle, minutos, duracionMs),
    timeline,
    auras: normalizarAuras(detalle, duracionMs),
    supervivencia: normalizarSupervivencia(raw, minutos, casteosPorNombre),
  };
}

export function resolverTalentos(
  arbol: WclCombatantInfo['talentTree'],
  spec: SpecTalentos | null,
): { talentos: Talento[]; heroe: string | null } {
  const porEntrada = new Map<number, { nodo: RbNodo; entrada: RbEntrada; arbol: Talento['arbol'] }>();
  const indexar = (nodos: RbNodo[], tipo: Talento['arbol']) => {
    for (const nodo of nodos) for (const entrada of nodo.entries) porEntrada.set(entrada.id, { nodo, entrada, arbol: tipo });
  };
  if (spec) {
    indexar(spec.classNodes, 'clase');
    indexar(spec.specNodes, 'spec');
    indexar(spec.heroNodes, 'heroe');
  }
  const subarboles = new Map<number, string>();
  for (const nodo of spec?.subTreeNodes ?? []) for (const e of nodo.entries) subarboles.set(e.id, e.name ?? nodo.name);

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
  const { talentos, heroe } = ci ? resolverTalentos(ci.talentTree, spec) : { talentos: [], heroe: null };
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

function agruparPorNombre<T extends { name: string; total: number; guid: number; abilityIcon?: string | null }>(
  entradas: T[],
  casteosPorGuid: Map<number, number>,
  casteosPorNombre: Map<string, number>,
): Array<T & { _merged: true }> {
  const porNombre = new Map<string, { entrada: T; totalDano: number; usosContados: Set<string> }>();
  const nombresVistos = new Set<string>();

  for (const e of entradas) {
    if (!porNombre.has(e.name)) {
      porNombre.set(e.name, { entrada: e, totalDano: e.total, usosContados: new Set() });
      nombresVistos.add(e.name);
    } else {
      const agrupado = porNombre.get(e.name)!;
      agrupado.totalDano += e.total;
      // Keep entry with largest total
      if (e.total > agrupado.entrada.total) {
        agrupado.entrada = e;
      }
    }
  }

  return Array.from(porNombre.values()).map(({ entrada, totalDano, usosContados }) => ({
    ...entrada,
    total: totalDano,
    _merged: true as const,
  }));
}

function normalizarRendimiento(detalle: WclDetalle, minutos: number, duracionMs: number): Rendimiento {
  const entradas = detalle.danoHecho?.data.entries ?? [];
  const casteos = detalle.casteos?.data.entries ?? [];
  const casteosPorGuid = new Map(casteos.map((c) => [c.guid, c.total]));
  const casteosPorNombre = new Map(casteos.map((c) => [c.name, c.total]));

  // Merge entries with the same name
  const entradasMerged = agruparPorNombre(entradas, casteosPorGuid, casteosPorNombre);
  const danoTotal = entradasMerged.reduce((a, e) => a + e.total, 0);

  // Track which names have had their casteosPorNombre usage counted
  const nombresProcesados = new Set<string>();

  const hechizos: Hechizo[] = entradasMerged
    .map((e) => {
      // Use e.uses (from merged total), or guid-based count, or name-based count (only once per name)
      let n: number;
      if (e.uses) {
        n = e.uses;
      } else if (casteosPorGuid.has(e.guid)) {
        n = casteosPorGuid.get(e.guid)!;
      } else if (!nombresProcesados.has(e.name) && casteosPorNombre.has(e.name)) {
        n = casteosPorNombre.get(e.name)!;
        nombresProcesados.add(e.name);
      } else {
        n = 0;
      }

      return {
        guid: e.guid,
        nombre: e.name,
        icono: e.abilityIcon ?? null,
        dano: e.total,
        porcentaje: danoTotal > 0 ? (e.total / danoTotal) * 100 : 0,
        casteos: n,
        cpm: minutos > 0 ? n / minutos : 0,
        danoPorCasteo: n > 0 ? e.total / n : 0,
      };
    })
    .sort((a, b) => b.dano - a.dano);
  return { dps: duracionMs > 0 ? danoTotal / (duracionMs / 1000) : 0, danoTotal, hechizos };
}

function normalizarAuras(detalle: WclDetalle, duracionMs: number): Aura[] {
  const pct = (uptime: number) => (duracionMs > 0 ? Math.min(100, (uptime / duracionMs) * 100) : 0);
  return [
    ...(detalle.buffs?.data.auras ?? []).map((a) => ({ guid: a.guid, nombre: a.name, tipo: 'buff' as const, uptimePct: pct(a.totalUptime) })),
    ...(detalle.debuffs?.data.auras ?? []).map((a) => ({ guid: a.guid, nombre: a.name, tipo: 'debuff' as const, uptimePct: pct(a.totalUptime) })),
  ];
}

function normalizarSupervivencia(raw: RawJugador, minutos: number, casteosPorNombre: Map<string, number>): Supervivencia {
  const entradas = raw.detalle.danoRecibido?.data.entries ?? [];

  // Merge entries with the same name
  const porNombre = new Map<string, { guid: number; nombre: string; origen: string; total: number }>();
  for (const e of entradas) {
    if (!porNombre.has(e.name)) {
      porNombre.set(e.name, { guid: e.guid, nombre: e.name, origen: e.actorName ?? '', total: e.total });
    } else {
      const agrupado = porNombre.get(e.name)!;
      agrupado.total += e.total;
      // Keep guid and origen of entry with largest total
      if (e.total > porNombre.get(e.name)!.total) {
        agrupado.guid = e.guid;
        agrupado.origen = e.actorName ?? '';
      }
    }
  }

  const danoRecibido = Array.from(porNombre.values())
    .map((d) => ({
      guid: d.guid,
      nombre: d.nombre,
      origen: d.origen,
      total: d.total,
      porMinuto: minutos > 0 ? d.total / minutos : 0,
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
