import { crearJugador } from '../../../testing/fabrica';
import { Pieza, Talento } from '../../modelo/player-fight-data';
import { reglaConsumibles, reglaEquipo, reglaTalentos } from './reglas-build';

const talento = (entryId: number, nombre: string): Talento => ({
  entryId,
  nodeId: entryId,
  nombre,
  rango: 1,
  arbol: 'spec',
  spellId: null,
  icono: null,
});
const pieza = (ranura: number, ilvl: number, encantamiento: number | null = null, gemas: number[] = []): Pieza => ({
  ranura,
  itemId: 1000 + ranura,
  ilvl,
  encantamiento,
  gemas,
  bonusIds: [],
  icono: 'x.jpg',
});

describe('reglaTalentos', () => {
  it('agrupa los talentos distintos en un solo hallazgo', () => {
    const mio = crearJugador({ build: { talentos: [talento(1, 'A'), talento(2, 'B')] } });
    const suyo = crearJugador({ build: { talentos: [talento(1, 'A'), talento(3, 'C')] } });
    const [h] = reglaTalentos(mio, suyo);
    expect(h.texto).toBe('Talentos distintos: él lleva C; tú llevas B');
    expect(h.refFila).toBe('talentos');
  });

  it('avisa si el héroe es distinto', () => {
    const r = reglaTalentos(crearJugador({ build: { heroe: 'Farseer' } }), crearJugador({ build: { heroe: 'Stormbringer' } }));
    expect(r.map((h) => h.texto)).toEqual(['Héroe distinto: tú Farseer, él Stormbringer']);
  });

  it('no salta con los mismos talentos', () => {
    const b = { build: { talentos: [talento(1, 'A')] } };
    expect(reglaTalentos(crearJugador(b), crearJugador(b))).toEqual([]);
  });
});

describe('reglaEquipo', () => {
  it('detecta ilvl ≥ 3 por debajo, encantamientos y gemas que faltan', () => {
    const mio = crearJugador({ build: { ilvlMedio: 310, equipo: [pieza(10, 310, null, [])] } });
    const suyo = crearJugador({ build: { ilvlMedio: 320, equipo: [pieza(10, 320, 7995, [1, 2])] } });
    expect(reglaEquipo(mio, suyo).map((h) => h.texto)).toEqual([
      'Tu ilvl medio es 310,0 frente a 320,0',
      'Te falta el encantamiento de anillo 1',
      'Te faltan 2 gemas en anillo 1',
    ]);
  });

  it('no salta con el mismo equipo', () => {
    const b = { build: { ilvlMedio: 320, equipo: [pieza(10, 320, 7995, [1])] } };
    expect(reglaEquipo(crearJugador(b), crearJugador(b))).toEqual([]);
  });
});

describe('reglaConsumibles', () => {
  it('salta por cada consumible que él usa y tú no', () => {
    const mio = crearJugador({ build: { consumibles: { flask: 'Flask A', comida: null, runa: null, pocionDps: null } } });
    const suyo = crearJugador({ build: { consumibles: { flask: 'Flask B', comida: 'Well Fed', runa: null, pocionDps: 'Tempered Potion' } } });
    expect(reglaConsumibles(mio, suyo).map((h) => h.texto)).toEqual([
      'No usaste comida (él: Well Fed)',
      'No usaste poción de dps (él: Tempered Potion)',
    ]);
  });
});
