// Forma del catálogo público de Raidbots: https://www.raidbots.com/static/data/live/talents.json

export interface RbEntrada {
  id: number;
  name?: string;
  spellId?: number;
  icon?: string;
  type?: string;
}

export interface RbNodo {
  id: number;
  name: string;
  entries: RbEntrada[];
}

export interface SpecTalentos {
  specId: number;
  className: string;
  specName: string;
  classNodes: RbNodo[];
  specNodes: RbNodo[];
  heroNodes: RbNodo[];
  subTreeNodes: RbNodo[];
}
