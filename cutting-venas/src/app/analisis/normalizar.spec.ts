import { brujo, diamades, RAW, rokka, SPECS } from '../../testing/fabrica';
import { normalizar, resolverTalentos } from './normalizar';

describe('normalizar (fixture real: chamán elemental)', () => {
  const d = rokka();

  it('rellena meta a partir de la pelea y el jugador', () => {
    expect(d.meta).toMatchObject({
      reportCode: 'DFwWK2hHpCcq4t8R',
      fightId: 14,
      sourceId: 17,
      nombre: 'Rokka',
      clase: 'Shaman',
      spec: 'Elemental',
      specId: 262,
      boss: 'The Coiled Altar',
      encounterId: 3429,
      kill: true,
      duracionMs: 507735,
    });
    expect(d.disponible).toEqual({
      build: true,
      rendimiento: true,
      rotacion: true,
      supervivencia: true,
    });
  });

  it('calcula DPS y el desglose por hechizo', () => {
    expect(d.rendimiento.danoTotal).toBe(51709052);
    expect(d.rendimiento.dps).toBeCloseTo(101842.6, 0);
    const lvb = d.rendimiento.hechizos.find((h) => h.nombre === 'Lava Burst')!;
    expect(lvb.casteos).toBe(46);
    expect(lvb.porcentaje).toBeCloseTo(16.97, 1);
    expect(lvb.danoPorCasteo).toBeCloseTo(190725, 0);
  });

  it('resuelve talentos con nombre, héroe, equipo, stats y consumibles', () => {
    expect(d.build.talentos).toHaveLength(78);
    expect(d.build.talentos.some((t) => t.nombre.startsWith('Talento #'))).toBe(false);
    expect(d.build.heroe).toBe('Farseer');
    expect(d.build.equipo).toHaveLength(15);
    expect(d.build.ilvlMedio).toBeCloseTo(313.4, 1);
    expect(d.build.stats.principal).toBe(3275);
    expect(d.build.consumibles).toEqual({
      flask: 'Flask of the Shattered Sun',
      comida: 'Well Fed',
      runa: null,
      pocionDps: "Light's Potential",
    });
  });

  it('construye la línea de tiempo solo con casts y detecta cooldowns', () => {
    expect(d.timeline.casteos).toHaveLength(265);
    expect(d.timeline.huecos.length).toBeGreaterThan(0);
    expect(d.timeline.cooldowns).toEqual(['Ancestral Swiftness', 'Ascendance', 'Stormkeeper']);
  });

  it('calcula el uptime de los debuffs que aplica', () => {
    const fs = d.auras.find((a) => a.tipo === 'debuff' && a.nombre === 'Flame Shock')!;
    expect(fs.uptimePct).toBeCloseTo(62.3, 1);
  });

  it('recoge muertes, daño recibido y defensivos', () => {
    expect(d.supervivencia.muertes).toEqual([{ t: 494870, causa: 'Grim Guillotine' }]);
    expect(d.supervivencia.totalRecibido).toBe(35985818);
    expect(d.supervivencia.defensivos.map((x) => x.nombre)).toContain('Astral Shift');
  });
});

describe('normalizar (otra clase: brujo de aflicción)', () => {
  it('no depende de la clase', () => {
    const d = brujo();
    expect(d.meta).toMatchObject({
      nombre: 'Mutgagarín',
      clase: 'Warlock',
      spec: 'Affliction',
      specId: 265,
    });
    expect(d.build.talentos.length).toBeGreaterThan(60);
    expect(d.build.heroe).toBe('Hellcaller');
    expect(d.timeline.cooldowns).toContain('Summon Darkglare');
    expect(d.auras.find((a) => a.nombre === 'Agony')!.uptimePct).toBeGreaterThan(90);
  });
});

describe('normalizar con datos parciales', () => {
  it('marca bloques no disponibles si faltan tablas', () => {
    const raw = {
      ...RAW.rokka,
      detalle: { ...RAW.rokka.detalle, danoHecho: null, combatantInfo: null },
    };
    const d = normalizar(raw, SPECS.elemental);
    expect(d.disponible.rendimiento).toBe(false);
    expect(d.disponible.build).toBe(false);
    expect(d.rendimiento.hechizos).toEqual([]);
    expect(d.build.talentos).toEqual([]);
  });

  it('sin catálogo de talentos usa el id como nombre', () => {
    const { talentos, heroe } = resolverTalentos([{ id: 5, rank: 1, nodeID: 9 }], null);
    expect(talentos[0].nombre).toBe('Talento #5');
    expect(heroe).toBeNull();
  });
});

describe('normalizar agrupa entradas con el mismo nombre', () => {
  it('en rendimiento: Diamades tiene exactamente un Earthquake con el dano total', () => {
    const d = diamades();
    const earthquakes = d.rendimiento.hechizos.filter((h) => h.nombre === 'Earthquake');
    expect(earthquakes).toHaveLength(1);
    expect(earthquakes[0].dano).toBe(185972);
  });

  it('en supervivencia: fusion de dano recibido con el mismo nombre suma totales y mantiene guid/origen del mayor', () => {
    const raw = { ...RAW.rokka };
    if (raw.detalle.danoRecibido?.data.entries) {
      const e0 = raw.detalle.danoRecibido.data.entries[0];
      if (e0) {
        raw.detalle.danoRecibido.data.entries = [
          { ...e0, guid: 1, total: 100, actorName: 'A' },
          { ...e0, guid: 2, total: 200, actorName: 'B' },
          { ...e0, guid: 3, total: 50, actorName: 'C' },
          ...raw.detalle.danoRecibido.data.entries.slice(1),
        ];
        const d = normalizar(raw, SPECS.elemental);
        const danoName = e0.name;
        const danoEntries = d.supervivencia.danoRecibido.filter((x) => x.nombre === danoName);
        expect(danoEntries).toHaveLength(1);
        expect(danoEntries[0].total).toBe(350);
        expect(danoEntries[0].guid).toBe(2);
        expect(danoEntries[0].origen).toBe('B');
      }
    }
  });

  it('en Casteos: dos entradas del mismo nombre con guids distintos suman su total (no solo la última)', () => {
    const raw = { ...RAW.rokka, detalle: { ...RAW.rokka.detalle } };
    raw.detalle.danoHecho = {
      ...raw.detalle.danoHecho!,
      data: {
        ...raw.detalle.danoHecho!.data,
        entries: [
          ...raw.detalle.danoHecho!.data.entries,
          { name: 'Hechizo Duplicado', guid: 999001, type: 1, total: 1000 },
        ],
      },
    };
    raw.detalle.casteos = {
      ...raw.detalle.casteos!,
      data: {
        ...raw.detalle.casteos!.data,
        entries: [
          ...raw.detalle.casteos!.data.entries,
          { name: 'Hechizo Duplicado', guid: 999002, type: 8, total: 3 },
          { name: 'Hechizo Duplicado', guid: 999003, type: 8, total: 5 },
        ],
      },
    };
    const d = normalizar(raw, SPECS.elemental);
    const h = d.rendimiento.hechizos.find((x) => x.nombre === 'Hechizo Duplicado');
    expect(h?.casteos).toBe(8);
  });

  it('en rendimiento: dos entradas del mismo nombre con uses distintos suman casts', () => {
    const raw = { ...RAW.rokka };
    if (raw.detalle.danoHecho?.data.entries) {
      const e0 = raw.detalle.danoHecho.data.entries[0];
      if (e0) {
        raw.detalle.danoHecho.data.entries = [
          { ...e0, guid: 1000, total: 1000, uses: 3 },
          { ...e0, guid: 1001, total: 4000, uses: 5 },
          ...raw.detalle.danoHecho.data.entries.slice(1),
        ];
        const d = normalizar(raw, SPECS.elemental);
        const hechizo = d.rendimiento.hechizos.find((h) => h.nombre === e0.name);
        expect(hechizo?.casteos).toBe(8);
        expect(hechizo?.dano).toBe(5000);
        expect(hechizo?.guid).toBe(1001); // guid of the 4000 entry
      }
    }
  });
});
