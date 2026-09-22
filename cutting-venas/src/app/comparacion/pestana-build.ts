import { NgTemplateOutlet } from '@angular/common';
import { Component, afterNextRender, input } from '@angular/core';
import { Comparison } from '../analisis/comparison';
import { Pieza } from '../modelo/player-fight-data';
import {
  datosWowhead,
  enlaceHechizo,
  enlaceItem,
  iconoWcl,
  iconoZam,
  refrescarWowhead,
} from '../ui/enlaces';
import { num } from '../util/formato';

@Component({
  selector: 'cv-pestana-build',
  template: `
    @let c = this.c();
    @let t = c.talentos;
    @if (!c.mio.disponible.build) {
      <p class="cv-aviso">No hay datos de Build para tu combate</p>
    }
    @if (!c.suyo.disponible.build) {
      <p class="cv-aviso">No hay datos de Build para el combate a analizar</p>
    }
    <h3 data-ref="talentos" [class.cv-resaltada]="resaltada() === 'talentos'">Talentos</h3>
    <p>
      Héroe: tú <strong>{{ t.heroeMio ?? '—' }}</strong> · él
      <strong>{{ t.heroeSuyo ?? '—' }}</strong>
    </p>
    <div class="cv-grid-2">
      <div>
        <h4>Solo él ({{ t.soloSuyos.length }})</h4>
        <ul class="cv-lista-talentos">
          @for (x of t.soloSuyos; track x.entryId) {
            <li>
              @if (iconoZam(x.icono); as src) {
                <img class="cv-icono" [src]="src" alt="" />
              }
              <a [href]="enlaceHechizo(x.spellId)" target="_blank" rel="noopener">{{ x.nombre }}</a>
              @if (x.rango > 1) {
                <small>(rango {{ x.rango }})</small>
              }
            </li>
          }
        </ul>
      </div>
      <div>
        <h4>Solo tú ({{ t.soloMios.length }})</h4>
        <ul class="cv-lista-talentos">
          @for (x of t.soloMios; track x.entryId) {
            <li>
              @if (iconoZam(x.icono); as src) {
                <img class="cv-icono" [src]="src" alt="" />
              }
              <a [href]="enlaceHechizo(x.spellId)" target="_blank" rel="noopener">{{ x.nombre }}</a>
              @if (x.rango > 1) {
                <small>(rango {{ x.rango }})</small>
              }
            </li>
          }
        </ul>
      </div>
    </div>
    <details>
      <summary>Talentos comunes ({{ t.comunes.length }})</summary>
      <ul class="cv-lista-talentos cv-lista-talentos--compacta">
        @for (x of t.comunes; track x.entryId) {
          <li>{{ x.nombre }}</li>
        }
      </ul>
    </details>

    <h3 data-ref="equipo" [class.cv-resaltada]="resaltada() === 'equipo'">
      Equipo · ilvl medio {{ num(c.mio.build.ilvlMedio, 1) }} frente a
      {{ num(c.suyo.build.ilvlMedio, 1) }}
    </h3>
    <table class="cv-tabla">
      <thead>
        <tr>
          <th>Ranura</th>
          <th>Tú</th>
          <th>Él</th>
          <th class="cv-num">Dif. ilvl</th>
        </tr>
      </thead>
      <tbody>
        @for (f of c.equipo; track f.ref) {
          <tr [attr.data-ref]="f.ref" [class.cv-resaltada]="resaltada() === f.ref">
            <td>{{ f.nombreRanura }}</td>
            <td [class.cv-peor]="f.faltaEncantamiento || f.faltanGemas > 0">
              @if (f.mio; as p) {
                <ng-container *ngTemplateOutlet="pieza; context: { $implicit: p }" />
              } @else {
                —
              }
              @if (f.faltaEncantamiento) {
                <small>sin encantamiento</small>
              }
              @if (f.faltanGemas > 0) {
                <small>faltan {{ f.faltanGemas }} gemas</small>
              }
            </td>
            <td>
              @if (f.suyo; as p) {
                <ng-container *ngTemplateOutlet="pieza; context: { $implicit: p }" />
              } @else {
                —
              }
            </td>
            <td class="cv-num" [class.cv-peor]="f.difIlvl < 0" [class.cv-mejor]="f.difIlvl > 0">
              {{ f.difIlvl }}
            </td>
          </tr>
        }
      </tbody>
    </table>
    <ng-template #pieza let-p>
      <a
        [href]="enlaceItem(p)"
        [attr.data-wowhead]="datosWowhead(p)"
        target="_blank"
        rel="noopener"
      >
        <img class="cv-icono" [src]="iconoWcl(p.icono)" alt="" />
        {{ p.ilvl }}
      </a>
    </ng-template>

    <div class="cv-grid-2">
      <div>
        <h3>Estadísticas</h3>
        <table class="cv-tabla">
          <thead>
            <tr>
              <th>Estadística</th>
              <th class="cv-num">Tú</th>
              <th class="cv-num">Él</th>
              <th class="cv-num">Dif.</th>
            </tr>
          </thead>
          <tbody>
            @for (s of c.stats; track s.nombre) {
              <tr>
                <td>{{ s.nombre }}</td>
                <td class="cv-num">{{ num(s.mio) }}</td>
                <td class="cv-num">{{ num(s.suyo) }}</td>
                <td class="cv-num" [class.cv-peor]="s.dif < 0" [class.cv-mejor]="s.dif > 0">
                  {{ num(s.dif) }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div>
        <h3>Consumibles</h3>
        <table class="cv-tabla">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Tú</th>
              <th>Él</th>
            </tr>
          </thead>
          <tbody>
            @for (f of c.consumibles; track f.ref) {
              <tr [attr.data-ref]="f.ref" [class.cv-resaltada]="resaltada() === f.ref">
                <td>{{ f.etiqueta }}</td>
                <td [class.cv-peor]="!f.mio && !!f.suyo">{{ f.mio ? '✔ ' + f.mio : '✘' }}</td>
                <td>{{ f.suyo ? '✔ ' + f.suyo : '✘' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  imports: [NgTemplateOutlet],
})
export class PestanaBuild {
  readonly c = input.required<Comparison>();
  readonly resaltada = input<string | null>(null);
  protected readonly num = num;
  protected readonly iconoWcl = iconoWcl;
  protected readonly iconoZam = iconoZam;
  protected readonly enlaceHechizo = enlaceHechizo;
  protected readonly enlaceItem = enlaceItem;
  protected readonly datosWowhead = (p: Pieza) => datosWowhead(p);

  constructor() {
    // La pestaña se crea al seleccionarla: basta con refrescar los tooltips tras el primer pintado.
    afterNextRender(() => refrescarWowhead());
  }
}
