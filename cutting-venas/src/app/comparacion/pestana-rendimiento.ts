import { Component, input } from '@angular/core';
import { Comparison } from '../analisis/comparison';
import { iconoWcl } from '../ui/enlaces';
import { compacto, num, pctSigno } from '../util/formato';

@Component({
  selector: 'cv-pestana-rendimiento',
  template: `
    @let c = this.c();
    <p>
      DPS: tú <strong>{{ compacto(c.mio.rendimiento.dps) }}</strong> · él <strong>{{ compacto(c.suyo.rendimiento.dps) }}</strong>
    </p>
    <table class="cv-tabla">
      <thead>
        <tr>
          <th>Hechizo</th>
          <th class="cv-num">% daño tú</th>
          <th class="cv-num">% daño él</th>
          <th class="cv-num">CPM tú</th>
          <th class="cv-num">CPM él</th>
          <th class="cv-num">Dif. CPM</th>
          <th class="cv-num">Daño/casteo tú</th>
          <th class="cv-num">Daño/casteo él</th>
        </tr>
      </thead>
      <tbody>
        @for (f of c.hechizos; track f.ref) {
          <tr [attr.data-ref]="f.ref" [class.cv-resaltada]="resaltada() === f.ref">
            <td>
              @if (iconoWcl(f.icono); as src) {
                <img class="cv-icono" [src]="src" alt="" />
              }
              {{ f.nombre }}
            </td>
            <td class="cv-num" [class.cv-peor]="f.difPorcentaje <= -5">{{ f.mio ? num(f.mio.porcentaje, 1) : '—' }}</td>
            <td class="cv-num">{{ f.suyo ? num(f.suyo.porcentaje, 1) : '—' }}</td>
            <td class="cv-num">{{ f.mio?.casteos ? num(f.mio!.cpm, 1) : '—' }}</td>
            <td class="cv-num">{{ f.suyo?.casteos ? num(f.suyo!.cpm, 1) : '—' }}</td>
            <td class="cv-num" [class.cv-peor]="(f.difCpmPct ?? 0) <= -15" [class.cv-mejor]="(f.difCpmPct ?? 0) >= 15">
              {{ f.difCpmPct === null ? '—' : pctSigno(f.difCpmPct) }}
            </td>
            <td class="cv-num">{{ f.mio?.danoPorCasteo ? compacto(f.mio!.danoPorCasteo) : '—' }}</td>
            <td class="cv-num">{{ f.suyo?.danoPorCasteo ? compacto(f.suyo!.danoPorCasteo) : '—' }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class PestanaRendimiento {
  readonly c = input.required<Comparison>();
  readonly resaltada = input<string | null>(null);
  protected readonly num = num;
  protected readonly compacto = compacto;
  protected readonly pctSigno = pctSigno;
  protected readonly iconoWcl = iconoWcl;
}
