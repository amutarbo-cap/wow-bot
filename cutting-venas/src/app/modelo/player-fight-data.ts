export type Bloque = 'build' | 'rendimiento' | 'rotacion' | 'supervivencia';

export interface MetaPelea {
  reportCode: string;
  fightId: number;
  sourceId: number;
  nombre: string;
  clase: string;
  spec: string;
  specId: number | null;
  boss: string;
  encounterId: number;
  dificultad: number | null;
  kill: boolean;
  duracionMs: number;
}

export interface Talento {
  entryId: number;
  nodeId: number;
  nombre: string;
  rango: number;
  arbol: 'clase' | 'spec' | 'heroe';
  spellId: number | null;
  icono: string | null;
}

export interface Pieza {
  ranura: number;
  itemId: number;
  ilvl: number;
  encantamiento: number | null;
  gemas: number[];
  bonusIds: number[];
  icono: string;
}

export interface Stats {
  principal: number;
  critico: number;
  celeridad: number;
  maestria: number;
  versatilidad: number;
}

export interface Consumibles {
  flask: string | null;
  comida: string | null;
  runa: string | null;
  pocionDps: string | null;
}

export interface Build {
  talentos: Talento[];
  heroe: string | null;
  equipo: Pieza[];
  ilvlMedio: number;
  stats: Stats;
  consumibles: Consumibles;
}

export interface Hechizo {
  guid: number;
  nombre: string;
  icono: string | null;
  dano: number;
  porcentaje: number;
  casteos: number;
  cpm: number;
  danoPorCasteo: number;
}

export interface Rendimiento {
  dps: number;
  danoTotal: number;
  hechizos: Hechizo[];
}

export interface Casteo {
  inicio: number;
  fin: number;
  guid: number;
  nombre: string;
}

export interface Hueco {
  desde: number;
  hasta: number;
  duracion: number;
  tras: string;
}

export interface Timeline {
  casteos: Casteo[];
  huecos: Hueco[];
  downtimeMs: number;
  downtimePct: number;
  cooldowns: string[];
}

export interface Aura {
  guid: number;
  nombre: string;
  tipo: 'buff' | 'debuff';
  uptimePct: number;
}

export interface DanoRecibido {
  guid: number;
  nombre: string;
  origen: string;
  total: number;
  porMinuto: number;
}

export interface Muerte {
  t: number;
  causa: string;
}

export interface UsoDefensivo {
  nombre: string;
  usos: number;
}

export interface Supervivencia {
  danoRecibido: DanoRecibido[];
  totalRecibido: number;
  muertes: Muerte[];
  defensivos: UsoDefensivo[];
  pocionesVida: number;
  piedrasVida: number;
}

export interface PlayerFightData {
  meta: MetaPelea;
  disponible: Record<Bloque, boolean>;
  build: Build;
  rendimiento: Rendimiento;
  timeline: Timeline;
  auras: Aura[];
  supervivencia: Supervivencia;
}
