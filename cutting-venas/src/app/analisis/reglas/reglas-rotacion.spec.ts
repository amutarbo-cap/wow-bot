import { crearJugador } from '../../../testing/fabrica';
import { Casteo } from '../../modelo/player-fight-data';
import {
  reglaDowntime,
  reglaPrimerCooldown,
  reglaUptime,
  reglaUsosCooldown,
} from './reglas-rotacion';

const usos = (nombre: string, ...tiempos: number[]): Casteo[] =>
  tiempos.map((t) => ({ inicio: t, fin: t, guid: 1, nombre }));
const conCd = (casteos: Casteo[], duracionMs = 300000) =>
  crearJugador({ meta: { duracionMs }, timeline: { casteos, cooldowns: ['Combustion'] } });

describe('reglaUsosCooldown', () => {
  it('cuenta usos de menos con la misma duración', () => {
    const [h] = reglaUsosCooldown(
      conCd(usos('Combustion', 0)),
      conCd(usos('Combustion', 0, 120000, 240000)),
    );
    expect(h.texto).toBe('Combustion: 1 uso frente a 3');
    expect(h.impacto).toBeCloseTo(100000 * 0.05 * 2, 0);
    expect(h.refFila).toBe('cd:Combustion');
  });

  it('dice "No usas" si no lo usas nunca', () => {
    const [h] = reglaUsosCooldown(conCd([]), conCd(usos('Combustion', 0, 120000)));
    expect(h.texto).toBe('No usas Combustion (él: 2 usos)');
  });

  it('dice "No usas" en singular si él solo lo usó una vez', () => {
    const [h] = reglaUsosCooldown(conCd([]), conCd(usos('Combustion', 0)));
    expect(h.texto).toBe('No usas Combustion (él: 1 uso)');
  });

  it('con duraciones distintas compara usos por minuto', () => {
    const [h] = reglaUsosCooldown(
      conCd(usos('Combustion', 0, 120000), 600000),
      conCd(usos('Combustion', 0, 120000), 300000),
    );
    expect(h.texto).toBe(
      'Combustion: 0,20 usos/min frente a 0,40/min (2 en 10:00 frente a 2 en 5:00)',
    );
  });

  it('no salta si usas los mismos', () => {
    expect(
      reglaUsosCooldown(conCd(usos('Combustion', 0, 120000)), conCd(usos('Combustion', 0, 120000))),
    ).toEqual([]);
  });

  it('devuelve [] si la duración de la pelea es 0', () => {
    expect(
      reglaUsosCooldown(conCd(usos('Combustion', 0), 0), conCd(usos('Combustion', 0, 120000))),
    ).toEqual([]);
    expect(
      reglaUsosCooldown(conCd(usos('Combustion', 0)), conCd(usos('Combustion', 0, 120000), 0)),
    ).toEqual([]);
  });
});

describe('reglaPrimerCooldown', () => {
  it('salta si tu primer uso llega ≥ 5 s tarde', () => {
    const [h] = reglaPrimerCooldown(conCd(usos('Combustion', 42000)), conCd(usos('Combustion', 0)));
    expect(h.texto).toBe('Primer Combustion a los 0:42; el suyo, a los 0:00');
  });

  it('no salta con 4 s de retraso', () => {
    expect(
      reglaPrimerCooldown(conCd(usos('Combustion', 4000)), conCd(usos('Combustion', 0))),
    ).toEqual([]);
  });
});

describe('reglaDowntime', () => {
  const dt = (downtimeMs: number, downtimePct: number) =>
    crearJugador({ timeline: { downtimeMs, downtimePct } });

  it('salta si tu downtime es ≥ 3 puntos mayor', () => {
    const [h] = reglaDowntime(dt(14000, 4.7), dt(3000, 1));
    expect(h.texto).toBe('Downtime: 14 s (4,7 %) frente a 3 s (1,0 %)');
    expect(h.impacto).toBeCloseTo(3700, 0);
  });

  it('no salta si el tuyo es menor', () => {
    expect(reglaDowntime(dt(3000, 1), dt(14000, 4.7))).toEqual([]);
  });
});

describe('reglaUptime', () => {
  const conAuras = (uptime: number, nombre = 'Living Bomb', tipo: 'buff' | 'debuff' = 'debuff') =>
    crearJugador({
      auras: [{ guid: 1, nombre, tipo, uptimePct: uptime }],
      timeline: { casteos: usos('Combustion', 0) },
    });

  it('salta con un debuff tuyo ≥ 10 puntos por debajo', () => {
    const [h] = reglaUptime(conAuras(62), conAuras(97));
    expect(h.texto).toBe('Living Bomb: 62 % de uptime frente a 97 %');
  });

  it('cuenta buffs ligados a un hechizo casteado ("Combustion: X")', () => {
    expect(
      reglaUptime(
        conAuras(20, 'Combustion: Haste', 'buff'),
        conAuras(50, 'Combustion: Haste', 'buff'),
      ),
    ).toHaveLength(1);
  });

  it('ignora buffs ajenos (procs, banda) y consumibles', () => {
    expect(
      reglaUptime(
        conAuras(0, 'Soul Fang Alacrity', 'buff'),
        conAuras(54, 'Soul Fang Alacrity', 'buff'),
      ),
    ).toEqual([]);
    expect(
      reglaUptime(
        conAuras(0, 'Flask of the Magisters', 'buff'),
        conAuras(100, 'Flask of the Magisters', 'buff'),
      ),
    ).toEqual([]);
  });
});
