import { TestBed } from '@angular/core/testing';
import { WclReportService } from '../wcl/wcl-report.service';
import { WclFight, WclJugadorDetalle } from '../wcl/wcl-tipos';
import { SelectorCombate } from './selector-combate';

/** Una promesa que el test controla desde fuera: permite simular respuestas que llegan fuera de orden. */
function diferida<T>(): { promesa: Promise<T>; resolver: (v: T) => void } {
  let resolver!: (v: T) => void;
  const promesa = new Promise<T>((r) => (resolver = r));
  return { promesa, resolver };
}

const fight = (id: number): WclFight => ({
  id,
  name: `Pelea ${id}`,
  encounterID: 1,
  difficulty: 5,
  kill: true,
  startTime: 0,
  endTime: 1000,
  friendlyPlayers: null,
});

const jugador = (id: number): WclJugadorDetalle => ({
  name: `J${id}`,
  id,
  type: 'Mage',
  specs: [{ spec: 'Fire' }],
});

describe('SelectorCombate: peticiones obsoletas', () => {
  let wcl: { resumen: ReturnType<typeof vi.fn>; jugadores: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    wcl = { resumen: vi.fn(), jugadores: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: WclReportService, useValue: wcl }] });
  });

  function montar(): SelectorCombate {
    const fixture = TestBed.createComponent(SelectorCombate);
    fixture.componentRef.setInput('titulo', 'Tú');
    return fixture.componentInstance;
  }

  it('elegirPelea: una respuesta lenta de una petición anterior no pisa la de la petición más reciente', async () => {
    const c = montar();
    (c as unknown as { reportCode: { set(v: string): void } }).reportCode.set('AAAAAAAAAAAAAAAA');

    const lenta = diferida<WclJugadorDetalle[]>();
    const rapida = diferida<WclJugadorDetalle[]>();
    wcl.jugadores.mockReturnValueOnce(lenta.promesa).mockReturnValueOnce(rapida.promesa);

    const p1 = c.elegirPelea(1);
    const p2 = c.elegirPelea(2);

    // La rápida (segunda petición) resuelve primero...
    rapida.resolver([jugador(20)]);
    await p2;
    expect((c as unknown as { jugadores: { (): WclJugadorDetalle[] } }).jugadores()).toEqual([
      jugador(20),
    ]);

    // ...y cuando la lenta (primera petición, ya obsoleta) resuelve después, se ignora.
    lenta.resolver([jugador(10)]);
    await p1;
    expect((c as unknown as { jugadores: { (): WclJugadorDetalle[] } }).jugadores()).toEqual([
      jugador(20),
    ]);
    expect((c as unknown as { fightId: { (): number | null } }).fightId()).toBe(2);
  });

  it('alCambiarUrl: una respuesta lenta de una URL anterior no pisa la de la URL más reciente', async () => {
    const c = montar();
    const lenta = diferida<{ fights: WclFight[]; masterData: { actors: [] } }>();
    const rapida = diferida<{ fights: WclFight[]; masterData: { actors: [] } }>();
    wcl.resumen.mockReturnValueOnce(lenta.promesa).mockReturnValueOnce(rapida.promesa);

    const p1 = c.alCambiarUrl('https://www.warcraftlogs.com/reports/AAAAAAAAAAAAAAAA');
    const p2 = c.alCambiarUrl('https://www.warcraftlogs.com/reports/BBBBBBBBBBBBBBBB');

    rapida.resolver({ fights: [fight(2)], masterData: { actors: [] } });
    await p2;
    expect((c as unknown as { peleas: { (): WclFight[] } }).peleas()).toEqual([fight(2)]);

    lenta.resolver({ fights: [fight(1)], masterData: { actors: [] } });
    await p1;
    expect((c as unknown as { peleas: { (): WclFight[] } }).peleas()).toEqual([fight(2)]);
    expect((c as unknown as { cargando: { (): boolean } }).cargando()).toBe(false);
  });
});
