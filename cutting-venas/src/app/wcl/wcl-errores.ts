import { HttpErrorResponse } from '@angular/common/http';

export type CodigoErrorWcl =
  | 'config'
  | 'credenciales'
  | 'url'
  | 'no-encontrado'
  | 'jugador-ausente'
  | 'limite'
  | 'red'
  | 'graphql';

export const MENSAJES_ERROR: Record<CodigoErrorWcl, string> = {
  config: 'Faltan las claves de WarcraftLogs. Copia src/environments/environment.example.ts a environment.ts y rellénalas.',
  credenciales: 'Credenciales de WarcraftLogs inválidas',
  url: 'No parece una URL de reporte de WarcraftLogs',
  'no-encontrado': 'Reporte no encontrado o privado',
  'jugador-ausente': 'Ese jugador no participó en la pelea seleccionada',
  limite: 'Límite de peticiones de WCL alcanzado, espera un momento',
  red: 'No se pudo conectar con WarcraftLogs. ¿Está arrancado ng serve con el proxy?',
  graphql: 'WarcraftLogs devolvió un error inesperado',
};

export class WclError extends Error {
  readonly codigo: CodigoErrorWcl;

  constructor(codigo: CodigoErrorWcl, detalle?: string) {
    super(detalle ? `${MENSAJES_ERROR[codigo]}: ${detalle}` : MENSAJES_ERROR[codigo]);
    this.name = 'WclError';
    this.codigo = codigo;
  }
}

export function traducirErrorHttp(e: unknown): WclError {
  if (e instanceof WclError) return e;
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return new WclError('red');
    if (e.status === 400 || e.status === 401) return new WclError('credenciales');
    if (e.status === 404) return new WclError('no-encontrado');
    if (e.status === 429) return new WclError('limite');
    return new WclError('graphql', `HTTP ${e.status}`);
  }
  return new WclError('graphql', e instanceof Error ? e.message : String(e));
}

/** Mensaje en español para mostrar en la UI a partir de cualquier error. */
export function mensajeDeError(e: unknown): string {
  return traducirErrorHttp(e).message;
}
