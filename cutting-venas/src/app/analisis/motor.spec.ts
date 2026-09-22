import { brujo, crearJugador, diamades, rokka } from '../../testing/fabrica';
import { comparar } from './motor';

describe('comparar', () => {
  it('un jugador contra sí mismo no da hallazgos ni avisos', () => {
    const r = rokka();
    const c = comparar(r, r);
    expect(c.hallazgos).toEqual([]);
    expect(c.avisos).toEqual([]);
  });

  it('dos logs de reportes distintos: ordena por impacto y la muerte va primero', () => {
    const c = comparar(rokka(), diamades());
    expect(c.avisos).toEqual([]);
    expect(c.hallazgos.length).toBeGreaterThan(10);
    expect(c.hallazgos[0]).toMatchObject({
      bloque: 'supervivencia',
      severidad: 'alta',
      refFila: 'muertes',
    });
    const impactos = c.hallazgos.map((h) => h.impacto);
    expect(impactos).toEqual([...impactos].sort((a, b) => b - a));
    expect(c.hallazgos.some((h) => h.id === 'downtime')).toBe(true);
    expect(c.hallazgos.some((h) => h.id === 'cpm:Lava Burst')).toBe(true);
  });

  it('rellena las filas de todas las pestañas', () => {
    const c = comparar(rokka(), diamades());
    expect(c.hechizos.length).toBeGreaterThan(5);
    expect(c.talentos.soloSuyos.length).toBeGreaterThan(0);
    expect(c.equipo.length).toBe(16); // Diamades lleva mano secundaria
    expect(c.stats).toHaveLength(5);
    expect(c.consumibles).toHaveLength(4);
    expect(c.cooldowns.map((f) => f.nombre)).toContain('Ascendance');
    expect(c.auras.length).toBeGreaterThan(0);
    expect(c.danoRecibido.length).toBeGreaterThan(0);
  });

  it('avisa si la spec o el boss son distintos, sin bloquear', () => {
    const c = comparar(rokka(), brujo());
    expect(c.avisos).toEqual([
      'Comparas especializaciones distintas (Elemental Shaman y Affliction Warlock)',
    ]);
    const otroBoss = comparar(
      crearJugador(),
      crearJugador({ meta: { encounterId: 2, boss: 'Otro' } }),
    );
    expect(otroBoss.avisos).toEqual(['Las peleas son de bosses distintos (Boss y Otro)']);
  });

  it('omite los hallazgos de un bloque no disponible y lo avisa', () => {
    const sinSuperv = {
      ...rokka(),
      disponible: { build: true, rendimiento: true, rotacion: true, supervivencia: false },
    };
    const c = comparar(sinSuperv, diamades());
    expect(c.hallazgos.some((h) => h.bloque === 'supervivencia')).toBe(false);
    expect(c.avisos).toContain('Datos de Supervivencia no disponibles: se omiten sus hallazgos');
  });
});
