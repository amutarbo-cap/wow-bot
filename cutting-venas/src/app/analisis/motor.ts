import { Bloque, PlayerFightData } from '../modelo/player-fight-data';
import { Comparison, Hallazgo, Regla } from './comparison';
import {
  diffTalentos,
  filasAuras,
  filasConsumibles,
  filasCooldowns,
  filasDanoRecibido,
  filasEquipo,
  filasHechizos,
  filasStats,
} from './filas';
import { REGLAS_BUILD } from './reglas/reglas-build';
import { REGLAS_RENDIMIENTO } from './reglas/reglas-rendimiento';
import { REGLAS_ROTACION } from './reglas/reglas-rotacion';
import { REGLAS_SUPERVIVENCIA } from './reglas/reglas-supervivencia';

export const REGLAS: Record<Bloque, Regla[]> = {
  build: REGLAS_BUILD,
  rendimiento: REGLAS_RENDIMIENTO,
  rotacion: REGLAS_ROTACION,
  supervivencia: REGLAS_SUPERVIVENCIA,
};

export function avisos(mio: PlayerFightData, suyo: PlayerFightData): string[] {
  const res: string[] = [];
  if (mio.meta.encounterId !== suyo.meta.encounterId) {
    res.push(`Las peleas son de bosses distintos (${mio.meta.boss} y ${suyo.meta.boss})`);
  } else if (mio.meta.dificultad !== suyo.meta.dificultad) {
    res.push('Las peleas son de dificultades distintas');
  }
  if (mio.meta.clase !== suyo.meta.clase || mio.meta.spec !== suyo.meta.spec) {
    res.push(`Comparas especializaciones distintas (${mio.meta.spec} ${mio.meta.clase} y ${suyo.meta.spec} ${suyo.meta.clase})`);
  }
  for (const b of Object.keys(REGLAS) as Bloque[]) {
    if (!mio.disponible[b] || !suyo.disponible[b]) res.push(`Datos de ${b} no disponibles: se omiten sus hallazgos`);
  }
  return res;
}

export function comparar(mio: PlayerFightData, suyo: PlayerFightData): Comparison {
  const hallazgos: Hallazgo[] = [];
  for (const b of Object.keys(REGLAS) as Bloque[]) {
    if (!mio.disponible[b] || !suyo.disponible[b]) continue;
    for (const regla of REGLAS[b]) hallazgos.push(...regla(mio, suyo));
  }
  hallazgos.sort((a, b) => b.impacto - a.impacto);
  return {
    mio,
    suyo,
    avisos: avisos(mio, suyo),
    hallazgos,
    hechizos: filasHechizos(mio, suyo),
    talentos: diffTalentos(mio, suyo),
    equipo: filasEquipo(mio, suyo),
    stats: filasStats(mio, suyo),
    consumibles: filasConsumibles(mio, suyo),
    cooldowns: filasCooldowns(mio, suyo),
    auras: filasAuras(mio, suyo),
    danoRecibido: filasDanoRecibido(mio, suyo),
  };
}
