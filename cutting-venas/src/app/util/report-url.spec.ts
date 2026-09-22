import { parsearUrlReporte } from './report-url';

describe('parsearUrlReporte', () => {
  it('extrae reporte, pelea y jugador de una URL completa', () => {
    expect(parsearUrlReporte('https://www.warcraftlogs.com/reports/DFwWK2hHpCcq4t8R#fight=14&type=damage-done&source=17')).toEqual({
      reportCode: 'DFwWK2hHpCcq4t8R',
      fightId: 14,
      sourceId: 17,
    });
  });

  it('acepta parámetros con ? y espacios alrededor', () => {
    expect(parsearUrlReporte('  https://www.warcraftlogs.com/reports/DkNt713VdTzjrPZA?fight=2&source=85 ')).toEqual({
      reportCode: 'DkNt713VdTzjrPZA',
      fightId: 2,
      sourceId: 85,
    });
  });

  it('deja fight y source a null si faltan o si fight=last', () => {
    expect(parsearUrlReporte('https://www.warcraftlogs.com/reports/DFwWK2hHpCcq4t8R')).toEqual({
      reportCode: 'DFwWK2hHpCcq4t8R',
      fightId: null,
      sourceId: null,
    });
    expect(parsearUrlReporte('https://www.warcraftlogs.com/reports/DFwWK2hHpCcq4t8R#fight=last')?.fightId).toBeNull();
  });

  it('acepta un código de reporte suelto', () => {
    expect(parsearUrlReporte('DFwWK2hHpCcq4t8R')?.reportCode).toBe('DFwWK2hHpCcq4t8R');
  });

  it('devuelve null si no es una URL de reporte', () => {
    expect(parsearUrlReporte('https://www.google.com')).toBeNull();
    expect(parsearUrlReporte('')).toBeNull();
    expect(parsearUrlReporte('https://www.warcraftlogs.com/character/eu/uldum/rokka')).toBeNull();
  });
});
