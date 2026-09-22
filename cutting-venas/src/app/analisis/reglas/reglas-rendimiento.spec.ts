import { crearJugador, hechizo } from '../../../testing/fabrica';
import { reglaCpm, reglaHechizoAusente, reglaReparto } from './reglas-rendimiento';

const con = (...hechizos: ReturnType<typeof hechizo>[]) => crearJugador({ rendimiento: { hechizos } });

describe('reglaCpm', () => {
  it('salta si el CPM difiere ≥ 15 % en un hechizo con ≥ 3 % del daño', () => {
    const [h] = reglaCpm(con(hechizo('Fireball', 6000000, 40)), con(hechizo('Fireball', 6000000, 50)));
    expect(h.texto).toBe('Fireball: 8,0/min frente a 10,0/min (−20 %)');
    expect(h.bloque).toBe('rendimiento');
    expect(h.refFila).toBe('hechizo:Fireball');
    // |8 - 10| CPM × 120.000 de daño por casteo / 60
    expect(h.impacto).toBeCloseTo(4000, 0);
  });

  it('no salta por debajo del 15 %', () => {
    expect(reglaCpm(con(hechizo('Fireball', 6000000, 45)), con(hechizo('Fireball', 6000000, 50)))).toEqual([]);
  });

  it('ignora hechizos con < 3 % del daño en ambos', () => {
    expect(reglaCpm(con(hechizo('Scorch', 300000, 5)), con(hechizo('Scorch', 300000, 20)))).toEqual([]);
  });
});

describe('reglaReparto', () => {
  it('salta si el % de daño difiere ≥ 5 puntos', () => {
    const [h] = reglaReparto(con(hechizo('Pyroblast', 3000000, 10)), con(hechizo('Pyroblast', 6000000, 10)));
    expect(h.texto).toBe('Pyroblast es el 20,0 % de su daño y el 10,0 % del tuyo');
  });

  it('no salta con 4 puntos', () => {
    expect(reglaReparto(con(hechizo('Pyroblast', 3000000, 10)), con(hechizo('Pyroblast', 4200000, 10)))).toEqual([]);
  });
});

describe('reglaHechizoAusente', () => {
  it('salta si él usa un hechizo con ≥ 1 % del daño y tú no', () => {
    const [h] = reglaHechizoAusente(con(), con(hechizo('Meteor', 900000, 3)));
    expect(h.texto).toBe('No usas Meteor (3,0 % de su daño)');
  });

  it('no salta por debajo del 1 %', () => {
    expect(reglaHechizoAusente(con(), con(hechizo('Meteor', 150000, 1)))).toEqual([]);
  });
});
