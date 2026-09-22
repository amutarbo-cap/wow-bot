import { TestBed } from '@angular/core/testing';
import { diamades, rokka } from '../../testing/fabrica';
import { comparar } from '../analisis/motor';
import { ComparacionVista } from './comparacion-vista';

describe('ComparacionVista (smoke)', () => {
  async function montar() {
    const fixture = TestBed.createComponent(ComparacionVista);
    fixture.componentRef.setInput('comparacion', comparar(rokka(), diamades()));
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('pinta la cabecera, el veredicto con 8 hallazgos y las 4 pestañas', async () => {
    const { el } = await montar();
    expect(el.querySelector('.cv-duelo')?.textContent).toContain('Rokka');
    expect(el.querySelector('.cv-duelo')?.textContent).toContain('Diamades');
    expect(el.querySelectorAll('.cv-hallazgo')).toHaveLength(8);
    expect([...el.querySelectorAll('.cv-pestana')].map((b) => b.textContent?.trim())).toEqual([
      'Build',
      'Rendimiento',
      'Rotación',
      'Supervivencia',
    ]);
  });

  it('al pulsar un hallazgo abre su pestaña y resalta la fila', async () => {
    const { fixture, el } = await montar();
    (el.querySelector('.cv-hallazgo') as HTMLButtonElement).click(); // el primero es la muerte
    await fixture.whenStable();
    expect(el.querySelector('.cv-pestana[aria-selected="true"]')?.textContent?.trim()).toBe('Supervivencia');
    expect(el.querySelector('[data-ref="muertes"]')?.classList).toContain('cv-resaltada');
  });

  it('todas las pestañas se pintan sin errores', async () => {
    const { fixture, el } = await montar();
    for (const b of [...el.querySelectorAll<HTMLButtonElement>('.cv-pestana')]) {
      b.click();
      await fixture.whenStable();
      expect(el.querySelector('[role="tabpanel"]')?.children.length).toBeGreaterThan(0);
    }
    expect(el.querySelector('.cv-linea-tiempo')).toBeNull(); // la última pestaña es Supervivencia
  });
});
