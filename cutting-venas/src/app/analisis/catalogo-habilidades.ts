// Listas editables por nombre (inglés, tal como vienen de WCL).
// Ampliar aquí cuando aparezcan falsos positivos o negativos.

/** Movilidad, utilidad y buffs de banda: nunca cuentan como cooldown ofensivo. */
export const UTILIDAD = new Set<string>([
  'Ghost Wolf', 'Gust of Wind', "Spiritwalker's Grace", 'Skyfury', 'Wind Rush Totem', 'Tremor Totem',
  'Reincarnation', 'Time Warp', 'Bloodlust', 'Heroism', 'Primal Rage', 'Fury of the Aspects',
  'Blink', 'Shimmer', 'Sprint', 'Dash', 'Stampeding Roar', 'Heroic Leap', 'Disengage', 'Roll',
  'Chi Torpedo', "Tiger's Lust", 'Hover', 'Door of Shadows', 'Leap of Faith', 'Angelic Feather',
  'Divine Steed', "Death's Advance", 'Wraith Walk', 'Fel Rush', 'Vengeful Retreat', 'Shadowstep',
  'Arcane Intellect', 'Mark of the Wild', 'Battle Shout', 'Power Word: Fortitude', 'Blessing of the Bronze',
]);

/** Defensivos personales: se listan en Supervivencia y no cuentan como cooldown ofensivo. */
export const DEFENSIVOS = new Set<string>([
  'Astral Shift', 'Ice Block', 'Ice Cold', 'Mirror Image', 'Alter Time', 'Greater Invisibility',
  'Divine Shield', 'Divine Protection', 'Shield of Vengeance', 'Blessing of Protection',
  'Unending Resolve', 'Dark Pact', 'Survival Instincts', 'Barkskin', 'Renewal',
  'Obsidian Scales', 'Renewing Blaze', 'Aspect of the Turtle', 'Survival of the Fittest', 'Exhilaration',
  'Die by the Sword', 'Enraged Regeneration', 'Ignore Pain', 'Rallying Cry', 'Spell Reflection', 'Shield Wall',
  'Icebound Fortitude', 'Anti-Magic Shell', 'Anti-Magic Zone', 'Lichborne', 'Death Pact',
  'Blur', 'Netherwalk', 'Darkness', 'Fortifying Brew', 'Diffuse Magic', 'Dampen Harm', 'Touch of Karma',
  'Desperate Prayer', 'Dispersion', 'Fade', 'Vampiric Embrace', 'Evasion', 'Cloak of Shadows', 'Feint',
  'Crimson Vial', 'Stone Bulwark Totem', 'Earth Elemental',
]);

export const REGEX_FLASK = /^(Flask|Phial) of/i;
export const REGEX_COMIDA = /Well Fed|Hearty/i;
export const REGEX_RUNA = /Augment/i;
export const POCIONES_DPS = new Set<string>([
  "Light's Potential", 'Tempered Potion', 'Potion of Unwavering Focus', 'Elemental Potion of Ultimate Power',
]);

export function esPocionDps(nombre: string): boolean {
  return POCIONES_DPS.has(nombre) || (/Potion/i.test(nombre) && !/Heal|Health|Mana|Invisib/i.test(nombre));
}

export const NOMBRES_RANURA = [
  'Cabeza', 'Cuello', 'Hombros', 'Camisa', 'Pecho', 'Cintura', 'Piernas', 'Pies', 'Muñecas', 'Manos',
  'Anillo 1', 'Anillo 2', 'Abalorio 1', 'Abalorio 2', 'Espalda', 'Mano principal', 'Mano secundaria', 'Tabardo',
];

/** Ranuras que no aportan (camisa y tabardo). */
export const RANURAS_IGNORADAS = new Set([3, 17]);

/** Auras de consumibles (flask, comida, runas, pociones): las cubre la regla de consumibles, no la de uptime. */
export function esAuraConsumible(nombre: string): boolean {
  return REGEX_FLASK.test(nombre) || REGEX_COMIDA.test(nombre) || REGEX_RUNA.test(nombre) || /^Rune of/i.test(nombre) || esPocionDps(nombre);
}

/**
 * Un buff cuenta para la regla de uptime si coincide con un hechizo casteado o un talento
 * ("Elemental Blast: Haste" coincide con "Elemental Blast") y no es utilidad, defensivo ni consumible.
 * Así se descartan procs de abalorios, buffs de banda y mecánicas del boss.
 */
export function esBuffRelevante(nombre: string, claves: Set<string>): boolean {
  if (UTILIDAD.has(nombre) || DEFENSIVOS.has(nombre) || esAuraConsumible(nombre)) return false;
  if (claves.has(nombre)) return true;
  const base = nombre.split(':')[0].trim();
  return base !== nombre && claves.has(base);
}
