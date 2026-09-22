import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WclAuthService } from './wcl-auth.service';
import { WclError, traducirErrorHttp } from './wcl-errores';

interface RespuestaGraphql<T> {
  data?: T | null;
  errors?: { message: string }[];
}

/** Ejecuta queries GraphQL contra la API v2 a través del proxy (/wcl/api). No sabe nada del dominio. */
@Injectable({ providedIn: 'root' })
export class WclApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(WclAuthService);

  async consulta<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const token = await this.auth.obtenerToken();
    let r: RespuestaGraphql<T>;
    try {
      r = await firstValueFrom(
        this.http.post<RespuestaGraphql<T>>('/wcl/api', { query, variables }, { headers: { Authorization: `Bearer ${token}` } }),
      );
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 401) this.auth.invalidar();
      throw traducirErrorHttp(e);
    }
    if (r.errors?.length) {
      const mensaje = r.errors.map((x) => x.message).join('; ');
      if (/does not exist|permission|private/i.test(mensaje)) throw new WclError('no-encontrado');
      if (!r.data) throw new WclError('graphql', mensaje);
      // Datos parciales: una tabla falló pero el resto es válido; el normalizador marca el bloque como no disponible.
      console.warn('[WCL] errores parciales:', mensaje);
    }
    if (!r.data) throw new WclError('graphql', 'respuesta vacía');
    return r.data;
  }
}
