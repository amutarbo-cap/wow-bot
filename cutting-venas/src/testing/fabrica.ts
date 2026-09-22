import { normalizar } from '../app/analisis/normalizar';
import { Hechizo, PlayerFightData } from '../app/modelo/player-fight-data';
import { SpecTalentos } from '../app/talentos/talentos-tipos';
import { RawJugador } from '../app/wcl/wcl-tipos';
import rawBrujo from './fixtures/jugador-DFwWK2hHpCcq4t8R-14-22.json';
import rawRokka from './fixtures/jugador-DFwWK2hHpCcq4t8R-14-17.json';
import rawDiamades from './fixtures/jugador-DkNt713VdTzjrPZA-2-85.json';
import talentos262 from './fixtures/talentos-262.json';
import talentos265 from './fixtures/talentos-265.json';

/** Fixtures reales capturados con scripts/capturar-fixture.ts (dos reportes distintos). */
export const RAW = {
  /** Chamán elemental, reporte DFwWK2hHpCcq4t8R, pelea 14, muere a las 8:14 y usa Reincarnation. */
  rokka: rawRokka as unknown as RawJugador,
  /** Chamán elemental top de otro reporte (DkNt713VdTzjrPZA), mismo boss. */
  diamades: rawDiamades as unknown as RawJugador,
  /** Brujo de aflicción, mismo reporte que Rokka; nombre con tilde. */
  brujo: rawBrujo as unknown as RawJugador,
};

export const SPECS = {
  elemental: talentos262 as unknown as SpecTalentos,
  afliccion: talentos265 as unknown as SpecTalentos,
};

export const rokka = () => normalizar(RAW.rokka, SPECS.elemental);
export const diamades = () => normalizar(RAW.diamades, SPECS.elemental);
export const brujo = () => normalizar(RAW.brujo, SPECS.afliccion);

/** Jugador vacío de 5 minutos con todos los bloques disponibles; los tests sobrescriben lo que necesitan. */
export function crearJugador(
  cambios: {
    meta?: Partial<PlayerFightData['meta']>;
    build?: Partial<PlayerFightData['build']>;
    rendimiento?: Partial<PlayerFightData['rendimiento']>;
    timeline?: Partial<PlayerFightData['timeline']>;
    auras?: PlayerFightData['auras'];
    supervivencia?: Partial<PlayerFightData['supervivencia']>;
    disponible?: Partial<PlayerFightData['disponible']>;
  } = {},
): PlayerFightData {
  return {
    meta: {
      reportCode: 'AAAAAAAAAAAAAAAA',
      fightId: 1,
      sourceId: 1,
      nombre: 'Prueba',
      clase: 'Mage',
      spec: 'Fire',
      specId: 63,
      boss: 'Boss',
      encounterId: 1,
      dificultad: 5,
      kill: true,
      duracionMs: 300000,
      ...cambios.meta,
    },
    disponible: { build: true, rendimiento: true, rotacion: true, supervivencia: true, ...cambios.disponible },
    build: {
      talentos: [],
      heroe: null,
      equipo: [],
      ilvlMedio: 0,
      stats: { principal: 0, critico: 0, celeridad: 0, maestria: 0, versatilidad: 0 },
      consumibles: { flask: null, comida: null, runa: null, pocionDps: null },
      ...cambios.build,
    },
    rendimiento: { dps: 100000, danoTotal: 30000000, hechizos: [], ...cambios.rendimiento },
    timeline: { casteos: [], huecos: [], downtimeMs: 0, downtimePct: 0, cooldowns: [], ...cambios.timeline },
    auras: cambios.auras ?? [],
    supervivencia: {
      danoRecibido: [],
      totalRecibido: 0,
      muertes: [],
      defensivos: [],
      pocionesVida: 0,
      piedrasVida: 0,
      ...cambios.supervivencia,
    },
  };
}

/** Hechizo de una pelea de 5 min con 30 M de daño total. */
export function hechizo(nombre: string, dano: number, casteos: number): Hechizo {
  return {
    guid: nombre.length,
    nombre,
    icono: null,
    dano,
    porcentaje: (dano / 30000000) * 100,
    casteos,
    cpm: casteos / 5,
    danoPorCasteo: casteos > 0 ? dano / casteos : 0,
  };
}
