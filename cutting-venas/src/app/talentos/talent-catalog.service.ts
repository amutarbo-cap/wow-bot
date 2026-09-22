import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SpecTalentos } from './talentos-tipos';

/** Catálogo de talentos de Raidbots (vía proxy /raidbots), descargado una sola vez por sesión. */
@Injectable({ providedIn: 'root' })
export class TalentCatalogService {
  private readonly http = inject(HttpClient);
  private catalogo: Promise<SpecTalentos[]> | null = null;

  /** Devuelve el árbol de la spec, o null si no se puede descargar (los talentos saldrán como "Talento #id"). */
  async spec(specId: number | null): Promise<SpecTalentos | null> {
    if (specId === null) return null;
    this.catalogo ??= firstValueFrom(this.http.get<SpecTalentos[]>('/raidbots/static/data/live/talents.json'));
    try {
      return (await this.catalogo).find((s) => s.specId === specId) ?? null;
    } catch {
      this.catalogo = null;
      return null;
    }
  }
}
