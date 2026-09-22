import { crearJugador } from '../../../testing/fabrica';
import { reglaDanoRecibido, reglaMuertes } from './reglas-supervivencia';

const recibe = (nombre: string, total: number) =>
  crearJugador({
    supervivencia: {
      danoRecibido: [{ guid: 1, nombre, origen: 'Boss', total, porMinuto: total / 5 }],
      totalRecibido: total,
    },
  });

describe('reglaMuertes', () => {
  it('salta con severidad alta si mueres más que él', () => {
    const mio = crearJugador({
      supervivencia: { muertes: [{ t: 494870, causa: 'Grim Guillotine' }] },
    });
    const [h] = reglaMuertes(mio, crearJugador());
    expect(h.texto).toBe('Mueres 1 vez (8:14 por Grim Guillotine) y él no muere');
    expect(h.severidad).toBe('alta');
  });

  it('si él también muere, dice "muere N vez/veces" en el lado correcto', () => {
    const mio = crearJugador({
      supervivencia: {
        muertes: [
          { t: 60000, causa: 'A' },
          { t: 120000, causa: 'B' },
        ],
      },
    });
    const suyo = crearJugador({ supervivencia: { muertes: [{ t: 90000, causa: 'C' }] } });
    const [h] = reglaMuertes(mio, suyo);
    expect(h.texto).toBe('Mueres 2 veces (1:00 por A, 2:00 por B) y él muere 1 vez');
  });

  it('no salta si mueres lo mismo', () => {
    const m = { supervivencia: { muertes: [{ t: 1000, causa: 'X' }] } };
    expect(reglaMuertes(crearJugador(m), crearJugador(m))).toEqual([]);
  });
});

describe('reglaDanoRecibido', () => {
  it('salta si recibes ≥ 1,5× más daño por minuto de una habilidad', () => {
    const [h] = reglaDanoRecibido(
      recibe('Volatile Venom', 2000000),
      recibe('Volatile Venom', 1000000),
    );
    expect(h.texto).toBe('Recibes 2,0× más daño de Volatile Venom');
  });

  it('dice "y él no" si él no la recibe', () => {
    const [h] = reglaDanoRecibido(recibe('Gravebound', 1000000), crearJugador());
    expect(h.texto).toBe('Recibes daño de Gravebound y él no');
  });

  it('no salta por debajo de 1,5×', () => {
    expect(reglaDanoRecibido(recibe('Venomfang', 1400000), recibe('Venomfang', 1000000))).toEqual(
      [],
    );
  });
});
