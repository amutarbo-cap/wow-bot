import { Component, inject, signal } from '@angular/core';
import { comparar } from './analisis/motor';
import { Comparison } from './analisis/comparison';
import { PlayerFightLoader } from './carga/player-fight-loader.service';
import { ComparacionVista } from './comparacion/comparacion-vista';
import { Entrada, ParSeleccion } from './entrada/entrada';
import { WclAuthService } from './wcl/wcl-auth.service';
import { MENSAJES_ERROR, WclError, mensajeDeError } from './wcl/wcl-errores';

@Component({
  selector: 'app-root',
  imports: [Entrada, ComparacionVista],
  template: `
    <div class="cv-app">
      <header class="cv-cabecera">
        <h1 class="cv-marca">Cutting Venas</h1>
        <p class="cv-lema">Compara tu log con el de otro y descubre qué haces mal</p>
      </header>

      <main>
        @if (!configurado) {
          <section class="cv-panel cv-error">
            <h2>Falta configuración</h2>
            <p>{{ mensajeConfig }}</p>
          </section>
        } @else if (comparacion(); as c) {
          <div class="cv-acciones">
            <button class="cv-boton cv-boton--secundario" type="button" (click)="volver()">Nueva comparación</button>
          </div>
          <cv-comparacion [comparacion]="c" />
        } @else {
          <cv-entrada [ocupado]="cargando()" (comparar)="lanzar($event)" />
          @if (cargando()) {
            <div class="cv-grid-2 cv-progreso">
              <p>Tú: {{ progresoMio() }}</p>
              <p>Él: {{ progresoSuyo() }}</p>
            </div>
          }
          @if (error(); as e) {
            <div class="cv-error">
              <p>{{ e }}</p>
              @if (reintentable()) {
                <button class="cv-boton cv-boton--secundario" type="button" (click)="reintentar()">Reintentar</button>
              }
            </div>
          }
        }
      </main>
    </div>
  `,
})
export class App {
  private readonly loader = inject(PlayerFightLoader);
  protected readonly configurado = inject(WclAuthService).configurado();
  protected readonly mensajeConfig = MENSAJES_ERROR.config;

  protected readonly cargando = signal(false);
  protected readonly progresoMio = signal('');
  protected readonly progresoSuyo = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly reintentable = signal(false);
  protected readonly comparacion = signal<Comparison | null>(null);
  private ultima: ParSeleccion | null = null;

  async lanzar(par: ParSeleccion): Promise<void> {
    this.ultima = par;
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [mio, suyo] = await Promise.all([
        this.loader.cargar(par.mio, (p) => this.progresoMio.set(p)),
        this.loader.cargar(par.suyo, (p) => this.progresoSuyo.set(p)),
      ]);
      this.comparacion.set(comparar(mio, suyo));
    } catch (e) {
      this.error.set(mensajeDeError(e));
      this.reintentable.set(e instanceof WclError && (e.codigo === 'limite' || e.codigo === 'red'));
    } finally {
      this.cargando.set(false);
    }
  }

  reintentar(): void {
    if (this.ultima) void this.lanzar(this.ultima);
  }

  volver(): void {
    this.comparacion.set(null);
  }
}
