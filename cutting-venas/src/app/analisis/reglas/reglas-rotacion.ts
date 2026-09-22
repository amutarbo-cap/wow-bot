import { num, reloj } from '../../util/formato';
import { PlayerFightData } from '../../modelo/player-fight-data';
import { esBuffRelevante } from '../catalogo-habilidades';
import { Hallazgo, Regla } from '../comparison';
import { filasAuras, filasCooldowns } from '../filas';
import { PESOS, dpsBase, hallazgo } from './impacto';

const usos = (n: number) => (n === 1 ? '1 uso' : `${n} usos`);

export const reglaUsosCooldown: Regla = (mio, suyo) => {
  const minM = mio.meta.duracionMs / 60000;
  const minS = suyo.meta.duracionMs / 60000;
  if (minM <= 0 || minS <= 0) return [];
  const mismaDuracion = Math.abs(minM - minS) / Math.max(minM, minS) <= 0.1;
  const res: Hallazgo[] = [];
  for (const f of filasCooldowns(mio, suyo)) {
    const faltan = Math.round((f.suyo.length / minS) * minM - f.mio.length);
    if (faltan < 1) continue;
    let texto: string;
    if (f.mio.length === 0) texto = `No usas ${f.nombre} (él: ${usos(f.suyo.length)})`;
    else if (mismaDuracion) texto = `${f.nombre}: ${usos(f.mio.length)} frente a ${f.suyo.length}`;
    else
      texto =
        `${f.nombre}: ${num(f.mio.length / minM, 2)} usos/min frente a ${num(f.suyo.length / minS, 2)}/min ` +
        `(${f.mio.length} en ${reloj(mio.meta.duracionMs)} frente a ${f.suyo.length} en ${reloj(suyo.meta.duracionMs)})`;
    res.push(
      hallazgo(
        mio,
        'rotacion',
        `cd-usos:${f.nombre}`,
        texto,
        dpsBase(mio) * PESOS.usoCooldown * faltan,
        f.ref,
      ),
    );
  }
  return res;
};

export const reglaPrimerCooldown: Regla = (mio, suyo) =>
  filasCooldowns(mio, suyo)
    .filter((f) => f.mio.length > 0 && f.suyo.length > 0 && f.mio[0] - f.suyo[0] >= 5000)
    .map((f) => {
      const retraso = f.mio[0] - f.suyo[0];
      return hallazgo(
        mio,
        'rotacion',
        `cd-primero:${f.nombre}`,
        `Primer ${f.nombre} a los ${reloj(f.mio[0])}; el suyo, a los ${reloj(f.suyo[0])}`,
        dpsBase(mio) * PESOS.retrasoCooldown * Math.min(retraso / 10000, 3),
        f.ref,
      );
    });

export const reglaDowntime: Regla = (mio, suyo) => {
  const dif = mio.timeline.downtimePct - suyo.timeline.downtimePct;
  if (dif < 3) return [];
  const seg = (ms: number) => num(ms / 1000, 0);
  return [
    hallazgo(
      mio,
      'rotacion',
      'downtime',
      `Downtime: ${seg(mio.timeline.downtimeMs)} s (${num(mio.timeline.downtimePct, 1)} %) frente a ${seg(suyo.timeline.downtimeMs)} s (${num(suyo.timeline.downtimePct, 1)} %)`,
      (dif / 100) * dpsBase(mio),
      'downtime',
    ),
  ];
};

/** Nombres de hechizos casteados y talentos de ambos jugadores: los buffs ligados a ellos son los que importan. */
function clavesBuff(mio: PlayerFightData, suyo: PlayerFightData): Set<string> {
  const claves = new Set<string>();
  for (const d of [mio, suyo]) {
    for (const c of d.timeline.casteos) claves.add(c.nombre);
    for (const t of d.build.talentos) claves.add(t.nombre);
  }
  return claves;
}

export const reglaUptime: Regla = (mio, suyo) =>
  filasAuras(mio, suyo)
    .filter((f) => f.suyo !== null && f.suyo - (f.mio ?? 0) >= 10)
    .filter((f) => f.tipo === 'debuff' || esBuffRelevante(f.nombre, clavesBuff(mio, suyo)))
    .map((f) =>
      hallazgo(
        mio,
        'rotacion',
        `uptime:${f.tipo}:${f.nombre}`,
        `${f.nombre}: ${num(f.mio ?? 0, 0)} % de uptime frente a ${num(f.suyo!, 0)} %`,
        dpsBase(mio) * PESOS.uptime * ((f.suyo! - (f.mio ?? 0)) / 100),
        f.ref,
      ),
    );

export const REGLAS_ROTACION: Regla[] = [
  reglaUsosCooldown,
  reglaPrimerCooldown,
  reglaDowntime,
  reglaUptime,
];
