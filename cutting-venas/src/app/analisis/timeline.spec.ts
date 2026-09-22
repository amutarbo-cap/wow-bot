import { WclEvento } from '../wcl/wcl-tipos';
import { construirCasteos, detectarCooldowns, detectarHuecos } from './timeline';

const ev = (timestamp: number, type: string, abilityGameID: number): WclEvento => ({
  timestamp,
  type,
  sourceID: 1,
  abilityGameID,
});
const nombres = new Map([
  [1, 'Fireball'],
  [2, 'Combustion'],
]);

describe('construirCasteos', () => {
  it('empareja begincast con cast y no duplica', () => {
    const casteos = construirCasteos([ev(1000, 'begincast', 1), ev(3000, 'cast', 1), ev(3500, 'cast', 2)], 1000, nombres);
    expect(casteos).toEqual([
      { inicio: 0, fin: 2000, guid: 1, nombre: 'Fireball' },
      { inicio: 2500, fin: 2500, guid: 2, nombre: 'Combustion' },
    ]);
  });

  it('ignora un begincast de hace más de 10 s', () => {
    const [c] = construirCasteos([ev(0, 'begincast', 1), ev(20000, 'cast', 1)], 0, nombres);
    expect(c.inicio).toBe(20000);
  });

  it('pone #id si la habilidad no tiene nombre', () => {
    expect(construirCasteos([ev(0, 'cast', 99)], 0, nombres)[0].nombre).toBe('#99');
  });
});

describe('detectarHuecos', () => {
  const c = (inicio: number, fin: number) => ({ inicio, fin, guid: 1, nombre: 'Fireball' });

  it('el tiempo de casteo no cuenta como hueco', () => {
    expect(detectarHuecos([c(0, 2500), c(2600, 5000)], 5000)).toEqual([]);
  });

  it('detecta huecos de más de 1,5 s, incluido el tramo final', () => {
    const huecos = detectarHuecos([c(0, 1000), c(4000, 4000)], 10000);
    expect(huecos).toEqual([
      { desde: 1000, hasta: 4000, duracion: 3000, tras: 'Fireball' },
      { desde: 4000, hasta: 10000, duracion: 6000, tras: 'Fireball' },
    ]);
  });

  it('un hueco de exactamente 1,5 s no cuenta', () => {
    expect(detectarHuecos([c(0, 1000), c(2500, 2500)], 2500)).toEqual([]);
  });
});

describe('detectarCooldowns', () => {
  it('exige frecuencia baja y buff propio con el mismo nombre', () => {
    const casteos = new Map([
      ['Combustion', 3],
      ['Fireball', 120],
      ['Scorch', 2],
    ]);
    expect(detectarCooldowns(casteos, new Set(['Combustion', 'Fireball']), 300000)).toEqual(['Combustion']);
  });

  it('excluye utilidad, defensivos y pociones', () => {
    const casteos = new Map([
      ['Ghost Wolf', 1],
      ['Ice Block', 1],
      ["Light's Potential", 1],
    ]);
    expect(detectarCooldowns(casteos, new Set(casteos.keys()), 300000)).toEqual([]);
  });
});
