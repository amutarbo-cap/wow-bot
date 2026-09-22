import { Bloque, PlayerFightData } from '../../modelo/player-fight-data';
import { Hallazgo, Severidad } from '../comparison';

/** Pesos fijos, expresados como fracción de tu DPS. */
export const PESOS = {
  muerte: 1,
  usoCooldown: 0.05,
  retrasoCooldown: 0.02,
  uptime: 0.1,
  consumible: 0.03,
  encantamiento: 0.01,
  gema: 0.01,
  ilvlPorPunto: 0.005,
  talento: 0.005,
  heroe: 0.02,
  danoRecibido: 0.02,
  reparto: 0.5,
} as const;

export function dpsBase(d: PlayerFightData): number {
  return d.rendimiento.dps > 0 ? d.rendimiento.dps : 1;
}

export function severidadDe(impacto: number, miDps: number): Severidad {
  const r = impacto / miDps;
  if (r >= 0.05) return 'alta';
  if (r >= 0.02) return 'media';
  return 'baja';
}

export function hallazgo(
  mio: PlayerFightData,
  bloque: Bloque,
  id: string,
  texto: string,
  impacto: number,
  refFila?: string,
  severidad?: Severidad,
): Hallazgo {
  return { id, bloque, texto, impacto, refFila, severidad: severidad ?? severidadDe(impacto, dpsBase(mio)) };
}
