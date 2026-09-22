import { TestBed } from '@angular/core/testing';
import { RAW, SPECS } from '../../testing/fabrica';
import { TalentCatalogService } from '../talentos/talent-catalog.service';
import { WclReportService } from '../wcl/wcl-report.service';
import { PlayerFightLoader } from './player-fight-loader.service';

describe('PlayerFightLoader', () => {
  const raw = RAW.rokka;
  const wcl = {
    resumen: vi.fn(async () => ({ title: 'x', fights: [raw.fight], masterData: { actors: [raw.actor] } })),
    jugadores: vi.fn(async () => [raw.detallesJugador!]),
    detalle: vi.fn(async () => raw.detalle),
    eventosCasteo: vi.fn(async () => raw.eventos),
  };
  const talentos = { spec: vi.fn(async () => SPECS.elemental) };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: WclReportService, useValue: wcl },
        { provide: TalentCatalogService, useValue: talentos },
      ],
    });
  });

  it('descarga, filtra por el nombre del jugador y normaliza', async () => {
    const pasos: string[] = [];
    const d = await TestBed.inject(PlayerFightLoader).cargar(
      { reportCode: 'DFwWK2hHpCcq4t8R', fightId: 14, sourceId: 17 },
      (p) => pasos.push(p),
    );
    expect(wcl.detalle).toHaveBeenCalledWith('DFwWK2hHpCcq4t8R', 14, 17, 'Rokka');
    expect(talentos.spec).toHaveBeenCalledWith(262);
    expect(d.meta.nombre).toBe('Rokka');
    expect(d.build.heroe).toBe('Farseer');
    expect(pasos).toEqual([
      'Leyendo reporte…',
      'Descargando talentos, equipo y tablas…',
      'Descargando casteos…',
      'Resolviendo talentos…',
    ]);
  });

  it('falla con jugador-ausente si el jugador no estuvo en la pelea', async () => {
    await expect(
      TestBed.inject(PlayerFightLoader).cargar({ reportCode: 'DFwWK2hHpCcq4t8R', fightId: 14, sourceId: 999 }),
    ).rejects.toMatchObject({ codigo: 'jugador-ausente' });
  });

  it('falla con no-encontrado si la pelea no existe', async () => {
    await expect(
      TestBed.inject(PlayerFightLoader).cargar({ reportCode: 'DFwWK2hHpCcq4t8R', fightId: 99, sourceId: 17 }),
    ).rejects.toMatchObject({ codigo: 'no-encontrado' });
  });
});
