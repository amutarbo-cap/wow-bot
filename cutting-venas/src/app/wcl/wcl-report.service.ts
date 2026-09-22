import { Injectable, inject } from '@angular/core';
import { WclApiService } from './wcl-api.service';
import { WclError } from './wcl-errores';
import { QUERY_DETALLE, QUERY_EVENTOS, QUERY_JUGADORES, QUERY_RESUMEN, filtroPorNombre } from './wcl-queries';
import { WclDetalle, WclEvento, WclFight, WclJugadorDetalle, WclPlayerDetails, WclResumen } from './wcl-tipos';

type Envoltura<T> = { reportData: { report: T | null } };

/** Queries tipadas de WarcraftLogs que usa la app. */
@Injectable({ providedIn: 'root' })
export class WclReportService {
  private readonly api = inject(WclApiService);

  private async report<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const data = await this.api.consulta<Envoltura<T>>(query, variables);
    if (!data.reportData.report) throw new WclError('no-encontrado');
    return data.reportData.report;
  }

  resumen(code: string): Promise<WclResumen> {
    return this.report<WclResumen>(QUERY_RESUMEN, { code });
  }

  async jugadores(code: string, fight: number): Promise<WclJugadorDetalle[]> {
    const r = await this.report<{ playerDetails: WclPlayerDetails }>(QUERY_JUGADORES, { code, fight });
    const pd = r.playerDetails.data.playerDetails;
    return [...(pd.tanks ?? []), ...(pd.healers ?? []), ...(pd.dps ?? [])];
  }

  detalle(code: string, fight: number, source: number, nombre: string): Promise<WclDetalle> {
    return this.report<WclDetalle>(QUERY_DETALLE, { code, fights: [fight], source, filtro: filtroPorNombre(nombre) });
  }

  /** Todos los eventos de casteo (begincast y cast) del jugador en la pelea, siguiendo la paginación. */
  async eventosCasteo(code: string, fight: WclFight, source: number): Promise<WclEvento[]> {
    const eventos: WclEvento[] = [];
    let inicio: number | null = fight.startTime;
    while (inicio !== null) {
      const r: { events: { data: WclEvento[]; nextPageTimestamp: number | null } } = await this.report(QUERY_EVENTOS, {
        code,
        fight: fight.id,
        source,
        inicio,
        fin: fight.endTime,
      });
      eventos.push(...r.events.data);
      inicio = r.events.nextPageTimestamp ?? null;
    }
    return eventos;
  }
}
