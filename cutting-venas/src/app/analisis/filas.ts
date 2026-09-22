// Construcción de las filas "tú | él | diferencia" que usan tanto las reglas como la UI.
import { PlayerFightData } from '../modelo/player-fight-data';
import { NOMBRES_RANURA } from './catalogo-habilidades';
import {
  DiffTalentos,
  FilaAura,
  FilaConsumible,
  FilaCooldown,
  FilaDanoRecibido,
  FilaEquipo,
  FilaHechizo,
  FilaStat,
} from './comparison';

function unirPorClave<T>(a: T[], b: T[], clave: (x: T) => string): [string, T | null, T | null][] {
  const ma = new Map(a.map((x) => [clave(x), x]));
  const mb = new Map(b.map((x) => [clave(x), x]));
  const claves = [...new Set([...ma.keys(), ...mb.keys()])];
  return claves.map((k) => [k, ma.get(k) ?? null, mb.get(k) ?? null]);
}

export function filasHechizos(mio: PlayerFightData, suyo: PlayerFightData): FilaHechizo[] {
  return unirPorClave(mio.rendimiento.hechizos, suyo.rendimiento.hechizos, (h) => h.nombre)
    .map(([nombre, m, s]) => ({
      ref: `hechizo:${nombre}`,
      nombre,
      icono: m?.icono ?? s?.icono ?? null,
      mio: m,
      suyo: s,
      difCpmPct: m && s && s.cpm > 0 && m.cpm > 0 ? ((m.cpm - s.cpm) / s.cpm) * 100 : null,
      difPorcentaje: (m?.porcentaje ?? 0) - (s?.porcentaje ?? 0),
    }))
    .sort((a, b) => Math.abs(b.difPorcentaje) - Math.abs(a.difPorcentaje));
}

export function diffTalentos(mio: PlayerFightData, suyo: PlayerFightData): DiffTalentos {
  const clave = (t: { entryId: number; rango: number }) => `${t.entryId}:${t.rango}`;
  const suyos = new Set(suyo.build.talentos.map(clave));
  const mios = new Set(mio.build.talentos.map(clave));
  return {
    soloMios: mio.build.talentos.filter((t) => !suyos.has(clave(t))),
    soloSuyos: suyo.build.talentos.filter((t) => !mios.has(clave(t))),
    comunes: mio.build.talentos.filter((t) => suyos.has(clave(t))),
    heroeMio: mio.build.heroe,
    heroeSuyo: suyo.build.heroe,
  };
}

export function filasEquipo(mio: PlayerFightData, suyo: PlayerFightData): FilaEquipo[] {
  return unirPorClave(mio.build.equipo, suyo.build.equipo, (p) => String(p.ranura))
    .map(([k, m, s]) => {
      const ranura = Number(k);
      return {
        ref: `ranura:${ranura}`,
        ranura,
        nombreRanura: NOMBRES_RANURA[ranura] ?? `Ranura ${ranura}`,
        mio: m,
        suyo: s,
        difIlvl: (m?.ilvl ?? 0) - (s?.ilvl ?? 0),
        faltaEncantamiento: !!s?.encantamiento && !m?.encantamiento,
        faltanGemas: Math.max(0, (s?.gemas.length ?? 0) - (m?.gemas.length ?? 0)),
      };
    })
    .sort((a, b) => a.ranura - b.ranura);
}

export function filasStats(mio: PlayerFightData, suyo: PlayerFightData): FilaStat[] {
  const nombres: [keyof PlayerFightData['build']['stats'], string][] = [
    ['principal', 'Atributo principal'],
    ['critico', 'Crítico'],
    ['celeridad', 'Celeridad'],
    ['maestria', 'Maestría'],
    ['versatilidad', 'Versatilidad'],
  ];
  return nombres.map(([k, nombre]) => ({
    nombre,
    mio: mio.build.stats[k],
    suyo: suyo.build.stats[k],
    dif: mio.build.stats[k] - suyo.build.stats[k],
  }));
}

export const ETIQUETAS_CONSUMIBLE: Record<FilaConsumible['tipo'], string> = {
  flask: 'Flask',
  comida: 'Comida',
  runa: 'Runa de aumento',
  pocionDps: 'Poción de DPS',
};

export function filasConsumibles(mio: PlayerFightData, suyo: PlayerFightData): FilaConsumible[] {
  return (Object.keys(ETIQUETAS_CONSUMIBLE) as FilaConsumible['tipo'][]).map((tipo) => ({
    ref: `consumible:${tipo}`,
    tipo,
    etiqueta: ETIQUETAS_CONSUMIBLE[tipo],
    mio: mio.build.consumibles[tipo],
    suyo: suyo.build.consumibles[tipo],
  }));
}

export function filasCooldowns(mio: PlayerFightData, suyo: PlayerFightData): FilaCooldown[] {
  const nombres = [...new Set([...mio.timeline.cooldowns, ...suyo.timeline.cooldowns])].sort();
  const usos = (d: PlayerFightData, nombre: string) =>
    d.timeline.casteos.filter((c) => c.nombre === nombre).map((c) => c.fin);
  return nombres.map((nombre) => ({ ref: `cd:${nombre}`, nombre, mio: usos(mio, nombre), suyo: usos(suyo, nombre) }));
}

export function filasAuras(mio: PlayerFightData, suyo: PlayerFightData): FilaAura[] {
  return unirPorClave(mio.auras, suyo.auras, (a) => `${a.tipo}:${a.nombre}`)
    .map(([k, m, s]) => ({
      ref: `aura:${k}`,
      nombre: (m ?? s)!.nombre,
      tipo: (m ?? s)!.tipo,
      mio: m?.uptimePct ?? null,
      suyo: s?.uptimePct ?? null,
      dif: (m?.uptimePct ?? 0) - (s?.uptimePct ?? 0),
    }))
    .sort((a, b) => a.dif - b.dif);
}

export function filasDanoRecibido(mio: PlayerFightData, suyo: PlayerFightData): FilaDanoRecibido[] {
  return unirPorClave(mio.supervivencia.danoRecibido, suyo.supervivencia.danoRecibido, (d) => d.nombre)
    .map(([nombre, m, s]) => {
      const mioPorMinuto = m?.porMinuto ?? 0;
      const suyoPorMinuto = s?.porMinuto ?? 0;
      return {
        ref: `dano:${nombre}`,
        nombre,
        origen: m?.origen || s?.origen || '',
        mioPorMinuto,
        suyoPorMinuto,
        ratio: suyoPorMinuto > 0 ? mioPorMinuto / suyoPorMinuto : null,
      };
    })
    .sort((a, b) => b.mioPorMinuto - b.suyoPorMinuto - (a.mioPorMinuto - a.suyoPorMinuto));
}
