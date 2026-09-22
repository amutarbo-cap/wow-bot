import { Pieza } from '../modelo/player-fight-data';

export function iconoWcl(icono: string | null): string | null {
  return icono ? `https://assets.rpglogs.com/img/warcraft/abilities/${icono}` : null;
}

export function iconoZam(icono: string | null): string | null {
  return icono ? `https://wow.zamimg.com/images/wow/icons/medium/${icono}.jpg` : null;
}

export function enlaceHechizo(spellId: number | null): string | null {
  return spellId ? `https://www.wowhead.com/spell=${spellId}` : null;
}

export function enlaceItem(p: Pieza): string {
  return `https://www.wowhead.com/item=${p.itemId}`;
}

/** Parámetros data-wowhead para que el tooltip muestre la pieza exacta (ilvl, bonus, encantamiento, gemas). */
export function datosWowhead(p: Pieza): string {
  return [
    `ilvl=${p.ilvl}`,
    p.bonusIds.length ? `bonus=${p.bonusIds.join(':')}` : '',
    p.encantamiento ? `ench=${p.encantamiento}` : '',
    p.gemas.length ? `gems=${p.gemas.join(':')}` : '',
  ]
    .filter(Boolean)
    .join('&');
}

export function enlaceReporte(code: string, fightId: number, sourceId: number): string {
  return `https://www.warcraftlogs.com/reports/${code}#fight=${fightId}&source=${sourceId}`;
}

/** Vuelve a escanear los enlaces de Wowhead tras pintar contenido nuevo. */
export function refrescarWowhead(): void {
  (globalThis as { $WowheadPower?: { refreshLinks(): void } }).$WowheadPower?.refreshLinks();
}
