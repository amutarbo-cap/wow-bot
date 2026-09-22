import { compacto, lista, nombreDificultad, num, pctSigno, reloj } from './formato';

describe('formato', () => {
  it('num usa formato español', () => {
    expect(num(8.1, 1)).toBe('8,1');
    expect(num(12345)).toBe('12.345');
  });

  it('reloj convierte ms a m:ss', () => {
    expect(reloj(0)).toBe('0:00');
    expect(reloj(62000)).toBe('1:02');
    expect(reloj(494870)).toBe('8:14');
  });

  it('compacto abrevia miles y millones', () => {
    expect(compacto(412345)).toBe('412,3 k');
    expect(compacto(1500000)).toBe('1,50 M');
    expect(compacto(950)).toBe('950');
  });

  it('pctSigno redondea y pone signo', () => {
    expect(pctSigno(-23.4)).toBe('−23 %');
    expect(pctSigno(44.6)).toBe('+45 %');
    expect(pctSigno(0.2)).toBe('0 %');
  });

  it('lista corta a partir de 4 elementos', () => {
    expect(lista(['a', 'b'])).toBe('a, b');
    expect(lista(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('a, b, c, d y 2 más');
  });

  it('nombreDificultad traduce los ids de WCL', () => {
    expect(nombreDificultad(4)).toBe('Heroico');
    expect(nombreDificultad(5)).toBe('Mítico');
    expect(nombreDificultad(null)).toBe('—');
    expect(nombreDificultad(99)).toBe('Dificultad 99');
  });
});
