// Formas de las respuestas crudas de la API v2 de WarcraftLogs (solo los campos que usamos).

export interface WclFight {
  id: number;
  name: string;
  encounterID: number;
  difficulty: number | null;
  kill: boolean | null;
  startTime: number;
  endTime: number;
  friendlyPlayers: number[] | null;
}

export interface WclActor {
  id: number;
  name: string;
  subType: string;
}

export interface WclResumen {
  title: string;
  fights: WclFight[];
  masterData: { actors: WclActor[] };
}

export interface WclJugadorDetalle {
  name: string;
  id: number;
  type: string;
  specs: { spec: string }[];
  potionUse?: number;
  healthstoneUse?: number;
}

export interface WclPlayerDetails {
  data: {
    playerDetails: {
      tanks?: WclJugadorDetalle[];
      healers?: WclJugadorDetalle[];
      dps?: WclJugadorDetalle[];
    };
  };
}

export interface WclEntradaTabla {
  name: string;
  guid: number;
  type: number;
  total: number;
  uses?: number;
  abilityIcon?: string;
  actorName?: string;
}

export interface WclTablaEntradas {
  data: { entries: WclEntradaTabla[]; totalTime: number };
}

export interface WclAuraTabla {
  name: string;
  guid: number;
  totalUptime: number;
  abilityIcon?: string;
}

export interface WclTablaAuras {
  data: { auras: WclAuraTabla[]; totalTime: number };
}

export interface WclMuerte {
  timestamp: number;
  killingBlow?: { name: string } | null;
}

export interface WclTablaMuertes {
  data: { entries: WclMuerte[] };
}

export interface WclPieza {
  id: number;
  itemLevel: number;
  icon: string;
  permanentEnchant?: number;
  gems?: { id: number }[];
  bonusIDs?: number[];
}

export interface WclCombatantInfo {
  specID: number;
  gear: WclPieza[];
  talentTree: { id: number; rank: number; nodeID: number }[];
  strength: number;
  agility: number;
  intellect: number;
  critMelee: number;
  critRanged: number;
  critSpell: number;
  hasteMelee: number;
  hasteRanged: number;
  hasteSpell: number;
  mastery: number;
  versatilityDamageDone: number;
}

export interface WclDetalle {
  masterData: { abilities: { gameID: number; name: string; icon: string }[] };
  danoHecho: WclTablaEntradas | null;
  casteos: WclTablaEntradas | null;
  buffs: WclTablaAuras | null;
  debuffs: WclTablaAuras | null;
  danoRecibido: WclTablaEntradas | null;
  muertes: WclTablaMuertes | null;
  combatantInfo: { data: WclCombatantInfo[] } | null;
}

export interface WclEvento {
  timestamp: number;
  type: string;
  sourceID: number;
  abilityGameID: number;
}

/** Todo lo descargado de un jugador en una pelea, antes de normalizar. */
export interface RawJugador {
  reportCode: string;
  fight: WclFight;
  actor: WclActor;
  detallesJugador: WclJugadorDetalle | null;
  detalle: WclDetalle;
  eventos: WclEvento[];
}
