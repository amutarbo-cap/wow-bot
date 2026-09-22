import { Component, computed, input } from '@angular/core';
import { Comparison } from '../analisis/comparison';
import { num, reloj } from '../util/formato';
import { LineaTiempo } from './linea-tiempo';

const CASTEOS_OPENER = 20;

@Component({
  selector: 'cv-pestana-rotacion',
  imports: [LineaTiempo],
  template: `
    @let c = this.c();
    @if (!c.mio.disponible.rotacion) {
      <p class="cv-aviso">No hay datos de Rotación para tu combate</p>
    }
    @if (!c.suyo.disponible.rotacion) {
      <p class="cv-aviso">No hay datos de Rotación para el combate a analizar</p>
    }
    <h3 data-ref="downtime" [class.cv-resaltada]="resaltada() === 'downtime'">
      Downtime: tú {{ num(c.mio.timeline.downtimeMs / 1000) }} s ({{
        num(c.mio.timeline.downtimePct, 1)
      }}
      %) · él {{ num(c.suyo.timeline.downtimeMs / 1000) }} s ({{
        num(c.suyo.timeline.downtimePct, 1)
      }}
      %)
    </h3>
    <cv-linea-tiempo [c]="c" />

    <h3>Cooldowns</h3>
    <table class="cv-tabla">
      <thead>
        <tr>
          <th>Cooldown</th>
          <th>Tú</th>
          <th>Él</th>
        </tr>
      </thead>
      <tbody>
        @for (f of c.cooldowns; track f.ref) {
          <tr [attr.data-ref]="f.ref" [class.cv-resaltada]="resaltada() === f.ref">
            <td>{{ f.nombre }}</td>
            <td [class.cv-peor]="f.mio.length < f.suyo.length">
              {{ f.mio.length }} · {{ tiempos(f.mio) }}
            </td>
            <td>{{ f.suyo.length }} · {{ tiempos(f.suyo) }}</td>
          </tr>
        }
      </tbody>
    </table>

    <h3>Opener (primeros {{ opener().length }} casteos)</h3>
    <table class="cv-tabla">
      <thead>
        <tr>
          <th class="cv-num">#</th>
          <th>Tú</th>
          <th>Él</th>
        </tr>
      </thead>
      <tbody>
        @for (fila of opener(); track $index) {
          <tr [class.cv-peor]="fila.mio?.nombre !== fila.suyo?.nombre">
            <td class="cv-num">{{ $index + 1 }}</td>
            <td>{{ fila.mio ? reloj(fila.mio.fin) + ' ' + fila.mio.nombre : '—' }}</td>
            <td>{{ fila.suyo ? reloj(fila.suyo.fin) + ' ' + fila.suyo.nombre : '—' }}</td>
          </tr>
        }
      </tbody>
    </table>

    <h3>Uptime de buffs y debuffs</h3>
    <table class="cv-tabla">
      <thead>
        <tr>
          <th>Aura</th>
          <th>Tipo</th>
          <th class="cv-num">Tú</th>
          <th class="cv-num">Él</th>
          <th class="cv-num">Dif.</th>
        </tr>
      </thead>
      <tbody>
        @for (f of c.auras; track f.ref) {
          <tr [attr.data-ref]="f.ref" [class.cv-resaltada]="resaltada() === f.ref">
            <td>{{ f.nombre }}</td>
            <td>{{ f.tipo }}</td>
            <td class="cv-num">{{ f.mio === null ? '—' : num(f.mio) + ' %' }}</td>
            <td class="cv-num">{{ f.suyo === null ? '—' : num(f.suyo) + ' %' }}</td>
            <td class="cv-num" [class.cv-peor]="f.dif <= -10" [class.cv-mejor]="f.dif >= 10">
              {{ num(f.dif) }}
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class PestanaRotacion {
  readonly c = input.required<Comparison>();
  readonly resaltada = input<string | null>(null);
  protected readonly num = num;
  protected readonly reloj = reloj;

  protected readonly opener = computed(() => {
    const m = this.c().mio.timeline.casteos.slice(0, CASTEOS_OPENER);
    const s = this.c().suyo.timeline.casteos.slice(0, CASTEOS_OPENER);
    return Array.from({ length: Math.max(m.length, s.length) }, (_, i) => ({
      mio: i < m.length ? m[i] : null,
      suyo: i < s.length ? s[i] : null,
    }));
  });

  protected tiempos(ms: number[]): string {
    return ms.map(reloj).join(', ') || '—';
  }
}
