import { Component, computed, input } from '@angular/core';
import { Comparison } from '../analisis/comparison';
import { PlayerFightData } from '../modelo/player-fight-data';
import { reloj } from '../util/formato';

const ANCHO = 1000;
const ALTO_CARRIL = 36;
const MARGEN_IZQ = 40;
const SERIES = 6;

interface Marca {
  x: number;
  serie: number;
  titulo: string;
}

interface Carril {
  etiqueta: string;
  y: number;
  ancho: number;
  huecos: { x: number; w: number; titulo: string }[];
  marcas: Marca[];
  muertes: { x: number; titulo: string }[];
}

/** Dos carriles alineados en tiempo: cooldowns (color por hechizo), huecos > 1,5 s y muertes. */
@Component({
  selector: 'cv-linea-tiempo',
  template: `
    <svg class="cv-linea-tiempo" [attr.viewBox]="'0 0 ' + (ancho + margen) + ' ' + alto()" role="img" aria-label="Línea de tiempo de cooldowns y huecos">
      @for (m of marcasTiempo(); track m.x) {
        <line class="lt-rejilla" [attr.x1]="m.x" [attr.x2]="m.x" y1="0" [attr.y2]="alto() - 14" />
        <text class="lt-texto" [attr.x]="m.x" [attr.y]="alto() - 2" text-anchor="middle">{{ m.etiqueta }}</text>
      }
      @for (c of carriles(); track c.etiqueta) {
        <text class="lt-texto" x="0" [attr.y]="c.y + 22">{{ c.etiqueta }}</text>
        <rect class="lt-carril" [attr.x]="margen" [attr.y]="c.y + 4" [attr.width]="c.ancho" [attr.height]="alturaCarril - 8" />
        @for (h of c.huecos; track h.x) {
          <rect class="lt-hueco" [attr.x]="h.x" [attr.y]="c.y + 4" [attr.width]="h.w" [attr.height]="alturaCarril - 8">
            <title>{{ h.titulo }}</title>
          </rect>
        }
        @for (m of c.marcas; track $index) {
          <rect class="lt-cd lt-serie-{{ m.serie }}" [attr.x]="m.x - 3" [attr.y]="c.y" width="6" [attr.height]="alturaCarril">
            <title>{{ m.titulo }}</title>
          </rect>
        }
        @for (d of c.muertes; track d.x) {
          <text class="lt-muerte" [attr.x]="d.x" [attr.y]="c.y + 24" text-anchor="middle">✝<title>{{ d.titulo }}</title></text>
        }
      }
    </svg>
    <ul class="lt-leyenda">
      <li><span class="lt-muestra lt-hueco"></span> Hueco &gt; 1,5 s</li>
      @for (n of cooldowns(); track n; let i = $index) {
        <li><span class="lt-muestra lt-cd lt-serie-{{ i % series }}"></span> {{ n }}</li>
      }
    </ul>
  `,
})
export class LineaTiempo {
  readonly c = input.required<Comparison>();
  protected readonly ancho = ANCHO;
  protected readonly margen = MARGEN_IZQ;
  protected readonly alturaCarril = ALTO_CARRIL;
  protected readonly series = SERIES;

  protected readonly cooldowns = computed(() => this.c().cooldowns.map((f) => f.nombre));
  private readonly duracion = computed(() => Math.max(this.c().mio.meta.duracionMs, this.c().suyo.meta.duracionMs));
  private readonly x = (ms: number) => MARGEN_IZQ + (ms / this.duracion()) * ANCHO;
  protected readonly alto = computed(() => ALTO_CARRIL * 2 + 24);

  protected readonly carriles = computed<Carril[]>(() => [
    this.carril('Tú', this.c().mio, 0),
    this.carril('Él', this.c().suyo, ALTO_CARRIL + 4),
  ]);

  protected readonly marcasTiempo = computed(() => {
    const res: { x: number; etiqueta: string }[] = [];
    for (let ms = 0; ms <= this.duracion(); ms += 60000) res.push({ x: this.x(ms), etiqueta: reloj(ms) });
    return res;
  });

  private carril(etiqueta: string, d: PlayerFightData, y: number): Carril {
    const indices = new Map(this.cooldowns().map((n, i) => [n, i % SERIES]));
    return {
      etiqueta,
      y,
      ancho: (d.meta.duracionMs / this.duracion()) * ANCHO,
      huecos: d.timeline.huecos.map((h) => ({
        x: this.x(h.desde),
        w: Math.max(1, this.x(h.hasta) - this.x(h.desde)),
        titulo: `${reloj(h.desde)} · hueco de ${(h.duracion / 1000).toFixed(1)} s tras ${h.tras}`,
      })),
      marcas: d.timeline.casteos
        .filter((c) => indices.has(c.nombre))
        .map((c) => ({ x: this.x(c.fin), serie: indices.get(c.nombre)!, titulo: `${reloj(c.fin)} · ${c.nombre}` })),
      muertes: d.supervivencia.muertes.map((m) => ({ x: this.x(m.t), titulo: `${reloj(m.t)} · muerte por ${m.causa}` })),
    };
  }
}
