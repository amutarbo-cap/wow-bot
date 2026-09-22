import { Casteo, Hueco } from '../modelo/player-fight-data';
import { WclEvento } from '../wcl/wcl-tipos';
import { DEFENSIVOS, UTILIDAD, esPocionDps } from './catalogo-habilidades';

export const UMBRAL_HUECO_MS = 1500;
const MAX_CASTEO_MS = 10000;
const INTERVALO_MIN_COOLDOWN_MS = 45000;

/**
 * Convierte eventos begincast/cast en casteos con inicio y fin relativos al pull.
 * Un cast con begincast previo de la misma habilidad (≤ 10 s) empieza en el begincast;
 * así el tiempo de casteo no cuenta como hueco y no hay duplicados.
 */
export function construirCasteos(
  eventos: WclEvento[],
  inicioPelea: number,
  nombres: Map<number, string>,
): Casteo[] {
  const ordenados = [...eventos].sort((a, b) => a.timestamp - b.timestamp);
  const pendientes = new Map<number, number>();
  const casteos: Casteo[] = [];
  for (const e of ordenados) {
    if (e.type === 'begincast') {
      pendientes.set(e.abilityGameID, e.timestamp);
      continue;
    }
    if (e.type !== 'cast') continue;
    const empezo = pendientes.get(e.abilityGameID);
    pendientes.delete(e.abilityGameID);
    const inicio =
      empezo !== undefined && e.timestamp - empezo <= MAX_CASTEO_MS ? empezo : e.timestamp;
    casteos.push({
      inicio: inicio - inicioPelea,
      fin: e.timestamp - inicioPelea,
      guid: e.abilityGameID,
      nombre: nombres.get(e.abilityGameID) ?? `#${e.abilityGameID}`,
    });
  }
  return casteos;
}

/**
 * Huecos > 1,5 s entre el fin de un casteo y el inicio del siguiente, incluido el tramo final hasta el fin de la pelea.
 * Un hueco que contiene una muerte (desde < t ≤ hasta) no cuenta como downtime: el jugador estaba muerto, no parado.
 */
export function detectarHuecos(casteos: Casteo[], duracionMs: number, muertes: number[]): Hueco[] {
  const contieneMuerte = (desde: number, hasta: number) =>
    muertes.some((t) => t > desde && t <= hasta);
  const huecos: Hueco[] = [];
  for (let i = 1; i < casteos.length; i++) {
    const desde = casteos[i - 1].fin;
    const hasta = casteos[i].inicio;
    if (hasta - desde > UMBRAL_HUECO_MS && !contieneMuerte(desde, hasta)) {
      huecos.push({ desde, hasta, duracion: hasta - desde, tras: casteos[i - 1].nombre });
    }
  }
  const ultimo = casteos.at(-1);
  if (
    ultimo &&
    duracionMs - ultimo.fin > UMBRAL_HUECO_MS &&
    !contieneMuerte(ultimo.fin, duracionMs)
  ) {
    huecos.push({
      desde: ultimo.fin,
      hasta: duracionMs,
      duracion: duracionMs - ultimo.fin,
      tras: ultimo.nombre,
    });
  }
  return huecos;
}

/**
 * Cooldown = hechizo casteado de media como mucho una vez cada 45 s que además
 * da un buff propio con el mismo nombre, excluyendo utilidad, defensivos y pociones.
 */
export function detectarCooldowns(
  casteosPorNombre: Map<string, number>,
  buffsPropios: Set<string>,
  duracionMs: number,
): string[] {
  const res: string[] = [];
  for (const [nombre, total] of casteosPorNombre) {
    if (total <= 0) continue;
    if (duracionMs / total < INTERVALO_MIN_COOLDOWN_MS) continue;
    if (!buffsPropios.has(nombre)) continue;
    if (UTILIDAD.has(nombre) || DEFENSIVOS.has(nombre) || esPocionDps(nombre)) continue;
    res.push(nombre);
  }
  return res.sort();
}
