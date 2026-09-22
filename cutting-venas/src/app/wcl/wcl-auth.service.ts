import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { WclError, traducirErrorHttp } from './wcl-errores';

export interface CredencialesWcl {
  clientId: string;
  clientSecret: string;
}

export const WCL_CREDENCIALES = new InjectionToken<CredencialesWcl>('WCL_CREDENCIALES', {
  providedIn: 'root',
  factory: () => ({ clientId: environment.wclClientId, clientSecret: environment.wclClientSecret }),
});

/** Token OAuth de client credentials, pedido a través del proxy de ng serve (/wcl/oauth). */
@Injectable({ providedIn: 'root' })
export class WclAuthService {
  private readonly http = inject(HttpClient);
  private readonly credenciales = inject(WCL_CREDENCIALES);
  private token: { valor: string; expira: number } | null = null;

  configurado(): boolean {
    return !!this.credenciales.clientId && !!this.credenciales.clientSecret;
  }

  async obtenerToken(): Promise<string> {
    if (!this.configurado()) throw new WclError('config');
    if (this.token && Date.now() < this.token.expira) return this.token.valor;
    const basic = btoa(`${this.credenciales.clientId}:${this.credenciales.clientSecret}`);
    try {
      const r = await firstValueFrom(
        this.http.post<{ access_token: string; expires_in: number }>('/wcl/oauth', 'grant_type=client_credentials', {
          headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      this.token = { valor: r.access_token, expira: Date.now() + (r.expires_in - 60) * 1000 };
      return r.access_token;
    } catch (e) {
      throw traducirErrorHttp(e);
    }
  }

  invalidar(): void {
    this.token = null;
  }
}
