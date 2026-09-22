import { Component, input, signal } from '@angular/core';
import { Comparison, Hallazgo } from '../analisis/comparison';
import { Bloque, NOMBRES_BLOQUE, PlayerFightData } from '../modelo/player-fight-data';
import { enlaceReporte } from '../ui/enlaces';
import { compacto, nombreDificultad, reloj } from '../util/formato';
import { PestanaBuild } from './pestana-build';
import { PestanaRendimiento } from './pestana-rendimiento';
import { PestanaRotacion } from './pestana-rotacion';
import { PestanaSupervivencia } from './pestana-supervivencia';
import { Veredicto } from './veredicto';

@Component({
  selector: 'cv-comparacion',
  imports: [Veredicto, PestanaBuild, PestanaRendimiento, PestanaRotacion, PestanaSupervivencia],
  template: `
    @let c = comparacion();
    <section class="cv-duelo">
      @for (
        lado of [
          { etiqueta: 'Tú', d: c.mio },
          { etiqueta: 'Él', d: c.suyo },
        ];
        track lado.etiqueta
      ) {
        <div class="cv-lado">
          <span class="cv-lado__etiqueta">{{ lado.etiqueta }}</span>
          <a class="cv-lado__nombre" [href]="enlace(lado.d)" target="_blank" rel="noopener">{{
            lado.d.meta.nombre
          }}</a>
          <span>{{ lado.d.meta.spec }} {{ lado.d.meta.clase }}</span>
          <strong class="cv-lado__dps">{{ compacto(lado.d.rendimiento.dps) }} DPS</strong>
          <span class="cv-lado__pelea">
            {{ lado.d.meta.boss }} · {{ nombreDificultad(lado.d.meta.dificultad) }} ·
            {{ lado.d.meta.kill ? 'kill' : 'wipe' }} ·
            {{ reloj(lado.d.meta.duracionMs) }}
          </span>
        </div>
      }
    </section>

    @for (a of c.avisos; track a) {
      <p class="cv-aviso">{{ a }}</p>
    }

    <cv-veredicto [hallazgos]="c.hallazgos" (elegir)="irA($event)" />

    <nav class="cv-pestanas" role="tablist">
      @for (b of bloques; track b) {
        <button
          type="button"
          role="tab"
          class="cv-pestana"
          [attr.aria-selected]="pestana() === b"
          (click)="pestana.set(b)"
        >
          {{ nombres[b] }}
        </button>
      }
    </nav>

    <section class="cv-panel" role="tabpanel">
      @switch (pestana()) {
        @case ('build') {
          <cv-pestana-build [c]="c" [resaltada]="resaltada()" />
        }
        @case ('rendimiento') {
          <cv-pestana-rendimiento [c]="c" [resaltada]="resaltada()" />
        }
        @case ('rotacion') {
          <cv-pestana-rotacion [c]="c" [resaltada]="resaltada()" />
        }
        @case ('supervivencia') {
          <cv-pestana-supervivencia [c]="c" [resaltada]="resaltada()" />
        }
      }
    </section>
  `,
})
export class ComparacionVista {
  readonly comparacion = input.required<Comparison>();
  protected readonly bloques: Bloque[] = ['build', 'rendimiento', 'rotacion', 'supervivencia'];
  protected readonly nombres = NOMBRES_BLOQUE;
  protected readonly pestana = signal<Bloque>('rendimiento');
  protected readonly resaltada = signal<string | null>(null);
  protected readonly compacto = compacto;
  protected readonly reloj = reloj;
  protected readonly nombreDificultad = nombreDificultad;

  protected enlace(d: PlayerFightData): string {
    return enlaceReporte(d.meta.reportCode, d.meta.fightId, d.meta.sourceId);
  }

  protected irA(h: Hallazgo): void {
    this.pestana.set(h.bloque);
    this.resaltada.set(h.refFila ?? null);
    const ref = h.refFila;
    if (!ref) return;
    // Esperar a que la pestaña se pinte antes de desplazar la fila a la vista.
    setTimeout(() => {
      const fila = document.querySelector(`[data-ref="${ref.replace(/"/g, '\\"')}"]`);
      fila?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    });
  }
}
