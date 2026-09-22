import { Component, computed, input, output, signal } from '@angular/core';
import { Hallazgo } from '../analisis/comparison';
import { NOMBRES_BLOQUE } from '../modelo/player-fight-data';

const VISIBLES = 8;

@Component({
  selector: 'cv-veredicto',
  template: `
    <section class="cv-panel cv-veredicto">
      <h2>Veredicto</h2>
      @if (hallazgos().length === 0) {
        <p>No hay diferencias relevantes. Buen trabajo.</p>
      } @else {
        <ol class="cv-hallazgos">
          @for (h of visibles(); track h.id) {
            <li>
              <button type="button" class="cv-hallazgo" (click)="elegir.emit(h)">
                <span class="cv-sev cv-sev--{{ h.severidad }}">{{ h.severidad }}</span>
                <span class="cv-hallazgo__texto">{{ h.texto }}</span>
                <span class="cv-hallazgo__bloque">→ {{ nombres[h.bloque] }}</span>
              </button>
            </li>
          }
        </ol>
        @if (hallazgos().length > limite) {
          <button type="button" class="cv-boton cv-boton--secundario" (click)="todos.set(!todos())">
            {{ todos() ? 'Ver menos' : 'Ver todos (' + hallazgos().length + ')' }}
          </button>
        }
      }
    </section>
  `,
})
export class Veredicto {
  readonly hallazgos = input.required<Hallazgo[]>();
  readonly elegir = output<Hallazgo>();
  protected readonly nombres = NOMBRES_BLOQUE;
  protected readonly limite = VISIBLES;
  protected readonly todos = signal(false);
  protected readonly visibles = computed(() =>
    this.todos() ? this.hallazgos() : this.hallazgos().slice(0, VISIBLES),
  );
}
