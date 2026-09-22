import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WclApiService } from './wcl-api.service';
import { WCL_CREDENCIALES, WclAuthService } from './wcl-auth.service';
import { WclError } from './wcl-errores';

function configurar(clientId = 'id', clientSecret = 'secreto') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: WCL_CREDENCIALES, useValue: { clientId, clientSecret } },
    ],
  });
  return {
    api: TestBed.inject(WclApiService),
    auth: TestBed.inject(WclAuthService),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('WclAuthService', () => {
  it('falla con código config si faltan claves', async () => {
    const { auth } = configurar('', '');
    await expect(auth.obtenerToken()).rejects.toMatchObject({ codigo: 'config' });
  });

  it('pide el token con Basic auth y lo reutiliza', async () => {
    const { auth, http } = configurar();
    const p = auth.obtenerToken();
    const req = http.expectOne('/wcl/oauth');
    expect(req.request.headers.get('Authorization')).toBe(`Basic ${btoa('id:secreto')}`);
    expect(req.request.body).toBe('grant_type=client_credentials');
    req.flush({ access_token: 'tok', expires_in: 3600 });
    expect(await p).toBe('tok');
    expect(await auth.obtenerToken()).toBe('tok');
    http.verify();
  });

  it('traduce un 401 a credenciales inválidas', async () => {
    const { auth, http } = configurar();
    const p = auth.obtenerToken();
    http.expectOne('/wcl/oauth').flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(p).rejects.toMatchObject({ codigo: 'credenciales', message: 'Credenciales de WarcraftLogs inválidas' });
  });
});

describe('WclApiService', () => {
  async function conToken(api: WclApiService, http: HttpTestingController) {
    const p = api.consulta<{ x: number }>('query { x }', { a: 1 });
    http.expectOne('/wcl/oauth').flush({ access_token: 'tok', expires_in: 3600 });
    const req = await vi.waitFor(() => http.expectOne('/wcl/api'));
    return { p, req };
  }

  it('envía la query con Bearer y devuelve data', async () => {
    const { api, http } = configurar();
    const { p, req } = await conToken(api, http);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    expect(req.request.body).toEqual({ query: 'query { x }', variables: { a: 1 } });
    req.flush({ data: { x: 5 } });
    expect(await p).toEqual({ x: 5 });
  });

  it('reporte privado o inexistente → no-encontrado', async () => {
    const { api, http } = configurar();
    const { p, req } = await conToken(api, http);
    req.flush({ data: null, errors: [{ message: 'This report does not exist.' }] });
    await expect(p).rejects.toMatchObject({ codigo: 'no-encontrado' });
  });

  it('429 → límite de peticiones', async () => {
    const { api, http } = configurar();
    const { p, req } = await conToken(api, http);
    req.flush({}, { status: 429, statusText: 'Too Many Requests' });
    await expect(p).rejects.toBeInstanceOf(WclError);
    await expect(p).rejects.toMatchObject({ codigo: 'limite' });
  });

  it('con errores parciales devuelve los datos que sí llegaron', async () => {
    const { api, http } = configurar();
    const { p, req } = await conToken(api, http);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    req.flush({ data: { x: 1 }, errors: [{ message: 'table failed' }] });
    expect(await p).toEqual({ x: 1 });
  });
});
