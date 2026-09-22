import { Component, inject, input, output, signal } from '@angular/core';
import { SeleccionCombate } from '../carga/player-fight-loader.service';
import { nombreDificultad, reloj } from '../util/formato';
import { parsearUrlReporte } from '../util/report-url';
import { WclError, mensajeDeError } from '../wcl/wcl-errores';
import { WclReportService } from '../wcl/wcl-report.service';
import { WclFight, WclJugadorDetalle } from '../wcl/wcl-tipos';

/** Un lado de la entrada: URL de WCL y, si faltan en la URL, desplegables de pelea y jugador. */
@Component({
  selector: 'cv-selector-combate',
  template: `
    <section class="cv-panel">
      <h2>{{ titulo() }}</h2>
      <label class="cv-campo">
        <span>URL del reporte de WarcraftLogs</span>
        <input
          class="cv-input"
          type="url"
          placeholder="https://www.warcraftlogs.com/reports/…#fight=…&source=…"
          [value]="url()"
          (change)="alCambiarUrl($any($event.target).value)"
        />
      </label>

      @if (cargando()) {
        <p class="cv-progreso">Leyendo reporte…</p>
      }
      @if (error(); as e) {
        <p class="cv-error">{{ e }}</p>
      }

      @if (peleas().length) {
        <label class="cv-campo">
          <span>Pelea</span>
          <select class="cv-select" [value]="fightId() ?? ''" (change)="elegirPelea(+$any($event.target).value)">
            <option value="" disabled>Elige una pelea</option>
            @for (f of peleas(); track f.id) {
              <option [value]="f.id">{{ etiquetaPelea(f) }}</option>
            }
          </select>
        </label>
      }

      @if (jugadores().length) {
        <label class="cv-campo">
          <span>Jugador</span>
          <select class="cv-select" [value]="sourceId() ?? ''" (change)="elegirJugador(+$any($event.target).value)">
            <option value="" disabled>Elige un jugador</option>
            @for (j of jugadores(); track j.id) {
              <option [value]="j.id">{{ j.name }} · {{ j.specs[0]?.spec }} {{ j.type }}</option>
            }
          </select>
        </label>
      }
    </section>
  `,
})
export class SelectorCombate {
  readonly titulo = input.required<string>();
  readonly seleccion = output<SeleccionCombate | null>();

  private readonly wcl = inject(WclReportService);
  protected readonly url = signal('');
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reportCode = signal<string | null>(null);
  protected readonly peleas = signal<WclFight[]>([]);
  protected readonly jugadores = signal<WclJugadorDetalle[]>([]);
  protected readonly fightId = signal<number | null>(null);
  protected readonly sourceId = signal<number | null>(null);

  protected etiquetaPelea(f: WclFight): string {
    const resultado = f.kill ? 'kill' : 'wipe';
    return `#${f.id} · ${f.name} · ${nombreDificultad(f.difficulty)} · ${resultado} · ${reloj(f.endTime - f.startTime)}`;
  }

  async alCambiarUrl(texto: string): Promise<void> {
    this.url.set(texto);
    this.error.set(null);
    this.peleas.set([]);
    this.jugadores.set([]);
    this.fightId.set(null);
    this.sourceId.set(null);
    this.emitir();
    if (!texto.trim()) return;
    const ref = parsearUrlReporte(texto);
    if (!ref) {
      this.error.set(new WclError('url').message);
      return;
    }
    this.reportCode.set(ref.reportCode);
    this.cargando.set(true);
    try {
      const resumen = await this.wcl.resumen(ref.reportCode);
      this.peleas.set(resumen.fights);
      if (ref.fightId !== null && resumen.fights.some((f) => f.id === ref.fightId)) {
        await this.elegirPelea(ref.fightId, ref.sourceId);
      }
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async elegirPelea(id: number, sourceInicial: number | null = null): Promise<void> {
    this.fightId.set(id);
    this.sourceId.set(null);
    this.jugadores.set([]);
    this.emitir();
    try {
      const jugadores = await this.wcl.jugadores(this.reportCode()!, id);
      this.jugadores.set(jugadores.sort((a, b) => a.name.localeCompare(b.name)));
      if (sourceInicial !== null) {
        if (jugadores.some((j) => j.id === sourceInicial)) this.elegirJugador(sourceInicial);
        else this.error.set(new WclError('jugador-ausente').message);
      }
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }

  elegirJugador(id: number): void {
    this.sourceId.set(id);
    this.emitir();
  }

  private emitir(): void {
    const code = this.reportCode();
    const f = this.fightId();
    const s = this.sourceId();
    this.seleccion.emit(code && f !== null && s !== null ? { reportCode: code, fightId: f, sourceId: s } : null);
  }
}
