import { Component, computed, input, output, signal } from '@angular/core';
import { SeleccionCombate } from '../carga/player-fight-loader.service';
import { SelectorCombate } from './selector-combate';

export interface ParSeleccion {
  mio: SeleccionCombate;
  suyo: SeleccionCombate;
}

@Component({
  selector: 'cv-entrada',
  imports: [SelectorCombate],
  template: `
    <div class="cv-grid-2">
      <cv-selector-combate titulo="Tu combate" (seleccion)="mio.set($event)" />
      <cv-selector-combate titulo="Combate a analizar" (seleccion)="suyo.set($event)" />
    </div>
    <div class="cv-acciones">
      <button class="cv-boton" type="button" [disabled]="!listo() || ocupado()" (click)="enviar()">Comparar</button>
    </div>
  `,
})
export class Entrada {
  readonly ocupado = input(false);
  readonly comparar = output<ParSeleccion>();
  protected readonly mio = signal<SeleccionCombate | null>(null);
  protected readonly suyo = signal<SeleccionCombate | null>(null);
  protected readonly listo = computed(() => !!this.mio() && !!this.suyo());

  protected enviar(): void {
    const mio = this.mio();
    const suyo = this.suyo();
    if (mio && suyo) this.comparar.emit({ mio, suyo });
  }
}
