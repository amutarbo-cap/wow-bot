import { Injectable, inject } from '@angular/core';
import { normalizar } from '../analisis/normalizar';
import { PlayerFightData } from '../modelo/player-fight-data';
import { TalentCatalogService } from '../talentos/talent-catalog.service';
import { WclError } from '../wcl/wcl-errores';
import { WclReportService } from '../wcl/wcl-report.service';

export interface SeleccionCombate {
  reportCode: string;
  fightId: number;
  sourceId: number;
}

/** Descarga todo lo necesario de un jugador en una pelea y lo normaliza a PlayerFightData. */
@Injectable({ providedIn: 'root' })
export class PlayerFightLoader {
  private readonly wcl = inject(WclReportService);
  private readonly talentos = inject(TalentCatalogService);

  async cargar(sel: SeleccionCombate, progreso: (paso: string) => void = () => {}): Promise<PlayerFightData> {
    progreso('Leyendo reporte…');
    const resumen = await this.wcl.resumen(sel.reportCode);
    const fight = resumen.fights.find((f) => f.id === sel.fightId);
    if (!fight) throw new WclError('no-encontrado', `la pelea ${sel.fightId} no existe en el reporte`);
    const actor = resumen.masterData.actors.find((a) => a.id === sel.sourceId);
    if (!actor || (fight.friendlyPlayers && !fight.friendlyPlayers.includes(sel.sourceId))) {
      throw new WclError('jugador-ausente');
    }

    progreso('Descargando talentos, equipo y tablas…');
    const [jugadores, detalle] = await Promise.all([
      this.wcl.jugadores(sel.reportCode, fight.id),
      this.wcl.detalle(sel.reportCode, fight.id, sel.sourceId, actor.name),
    ]);

    progreso('Descargando casteos…');
    const eventos = await this.wcl.eventosCasteo(sel.reportCode, fight, sel.sourceId);

    progreso('Resolviendo talentos…');
    const spec = await this.talentos.spec(detalle.combatantInfo?.data[0]?.specID ?? null);

    return normalizar(
      {
        reportCode: sel.reportCode,
        fight,
        actor,
        detallesJugador: jugadores.find((j) => j.id === sel.sourceId) ?? null,
        detalle,
        eventos,
      },
      spec,
    );
  }
}
