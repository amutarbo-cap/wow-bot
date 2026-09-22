import { Bloque, Consumibles, Hechizo, Pieza, PlayerFightData, Talento } from '../modelo/player-fight-data';

export type Severidad = 'alta' | 'media' | 'baja';

export interface Hallazgo {
  id: string;
  bloque: Bloque;
  severidad: Severidad;
  texto: string;
  impacto: number;
  refFila?: string;
}

export type Regla = (mio: PlayerFightData, suyo: PlayerFightData) => Hallazgo[];

export interface FilaHechizo {
  ref: string;
  nombre: string;
  icono: string | null;
  mio: Hechizo | null;
  suyo: Hechizo | null;
  difCpmPct: number | null;
  difPorcentaje: number;
}

export interface DiffTalentos {
  soloMios: Talento[];
  soloSuyos: Talento[];
  comunes: Talento[];
  heroeMio: string | null;
  heroeSuyo: string | null;
}

export interface FilaEquipo {
  ref: string;
  ranura: number;
  nombreRanura: string;
  mio: Pieza | null;
  suyo: Pieza | null;
  difIlvl: number;
  faltaEncantamiento: boolean;
  faltanGemas: number;
}

export interface FilaStat {
  nombre: string;
  mio: number;
  suyo: number;
  dif: number;
}

export interface FilaConsumible {
  ref: string;
  tipo: keyof Consumibles;
  etiqueta: string;
  mio: string | null;
  suyo: string | null;
}

export interface FilaCooldown {
  ref: string;
  nombre: string;
  mio: number[];
  suyo: number[];
}

export interface FilaAura {
  ref: string;
  nombre: string;
  tipo: 'buff' | 'debuff';
  mio: number | null;
  suyo: number | null;
  dif: number;
}

export interface FilaDanoRecibido {
  ref: string;
  nombre: string;
  origen: string;
  mioPorMinuto: number;
  suyoPorMinuto: number;
  ratio: number | null;
}

export interface Comparison {
  mio: PlayerFightData;
  suyo: PlayerFightData;
  avisos: string[];
  hallazgos: Hallazgo[];
  hechizos: FilaHechizo[];
  talentos: DiffTalentos;
  equipo: FilaEquipo[];
  stats: FilaStat[];
  consumibles: FilaConsumible[];
  cooldowns: FilaCooldown[];
  auras: FilaAura[];
  danoRecibido: FilaDanoRecibido[];
}
