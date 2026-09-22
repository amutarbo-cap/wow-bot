import { Component, input } from '@angular/core';
import { Comparison } from '../analisis/comparison';
import { compacto, num, reloj } from '../util/formato';

@Component({
  selector: 'cv-pestana-supervivencia',
  template: `
    @let c = this.c();
    <div class="cv-grid-2">
      @for (lado of [{ etiqueta: 'Tú', d: c.mio }, { etiqueta: 'Él', d: c.suyo }]; track lado.etiqueta) {
        <div>
          <h3 [attr.data-ref]="lado.etiqueta === 'Tú' ? 'muertes' : null" [class.cv-resaltada]="lado.etiqueta === 'Tú' && resaltada() === 'muertes'">
            {{ lado.etiqueta }}: {{ lado.d.supervivencia.muertes.length }} muertes
          </h3>
          <ul>
            @for (m of lado.d.supervivencia.muertes; track m.t) {
              <li>{{ reloj(m.t) }} · {{ m.causa }}</li>
            }
          </ul>
          <p>
            Defensivos:
            @for (x of lado.d.supervivencia.defensivos; track x.nombre; let ultimo = $last) {
              {{ x.nombre }} ×{{ x.usos }}{{ ultimo ? '' : ', ' }}
            } @empty {
              ninguno
            }
          </p>
          <p>Pociones de vida: {{ lado.d.supervivencia.pocionesVida }} · Piedras de salud: {{ lado.d.supervivencia.piedrasVida }}</p>
        </div>
      }
    </div>

    <h3>Daño recibido por habilidad (por minuto)</h3>
    <table class="cv-tabla">
      <thead>
        <tr><th>Habilidad</th><th>Origen</th><th class="cv-num">Tú</th><th class="cv-num">Él</th><th class="cv-num">Ratio</th></tr>
      </thead>
      <tbody>
        @for (f of c.danoRecibido; track f.ref) {
          <tr [attr.data-ref]="f.ref" [class.cv-resaltada]="resaltada() === f.ref">
            <td>{{ f.nombre }}</td>
            <td>{{ f.origen }}</td>
            <td class="cv-num">{{ compacto(f.mioPorMinuto) }}</td>
            <td class="cv-num">{{ compacto(f.suyoPorMinuto) }}</td>
            <td class="cv-num" [class.cv-peor]="f.ratio === null ? f.mioPorMinuto > 0 : f.ratio >= 1.5">
              {{ f.ratio === null ? '—' : num(f.ratio, 1) + '×' }}
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class PestanaSupervivencia {
  readonly c = input.required<Comparison>();
  readonly resaltada = input<string | null>(null);
  protected readonly num = num;
  protected readonly compacto = compacto;
  protected readonly reloj = reloj;
}
