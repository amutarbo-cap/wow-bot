# Cutting Venas: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App Angular local, en español, que compara a un jugador contra otro a partir de dos logs de WarcraftLogs (cada uno de su propio reporte, pelea y personaje) y explica qué se hace peor: primero un veredicto ordenado por impacto y después el detalle por bloques.

**Architecture:** Solo Angular, sin backend. `ng serve` hace de proxy hacia WarcraftLogs (OAuth + GraphQL v2) y Raidbots (catálogo de talentos) para evitar CORS. Las capas son estas:
- servicios HTTP finos;
- un normalizador puro que convierte lo que devuelve WCL en `PlayerFightData`;
- un motor de reglas puro que produce un `Comparison`;
- componentes que solo pintan.

**Tech Stack:** Angular 21.2 (standalone, signals, zoneless), Vitest 4 (runner por defecto de `ng test`), SCSS, TypeScript 5.9 y Node 24.14.

**Spec:** `docs/superpowers/specs/2026-09-22-cutting-venas-design.md`

## Restricciones globales

- **Angular 21**, no 22: Angular 22 exige Node ≥ 24.15 y el equipo tiene Node 24.14.0.
- **Solo local**: se arranca con `npm start` (`ng serve` con `proxy.conf.json`). No hay backend.
- **Credenciales**:
  - La app las lee de `src/environments/environment.ts` (`wclClientId`, `wclClientSecret`). Ese archivo está en `.gitignore` y se versiona `environment.example.ts`.
  - Los scripts de `wcl-fetch/` las leen de `wcl-fetch/.env`, que también está en `.gitignore`.
- **Textos**:
  - Toda la interfaz en español, escrita directamente en las plantillas (sin i18n).
  - Los nombres de hechizos, talentos y bosses se muestran en inglés, tal como vienen de WCL.
- **Nada específico de una clase.** Clase, especialización, talentos, cooldowns y consumibles salen de los datos de WCL y Raidbots. Las únicas listas por nombre están en `catalogo-habilidades.ts` y cubren todas las clases.
- **Dos logs independientes.** Cada lado tiene su propia URL de WCL (reporte, pelea y jugador); no se asume que ambos estén en el mismo reporte.
- **Tiempos y tasas.** Todos los tiempos van relativos al inicio del pull, en ms. Todas las tasas son por minuto de combate.
- **Casteos.** Solo cuentan los eventos `cast`. Un `begincast` previo solo marca el inicio del casteo para no contar el tiempo de casteo como hueco.
- **Look & feel**: lo define la skill **hallmark** (Task 8), usando el contrato de clases `cv-*` y `lt-*` que figura en esa tarea.
- **Código verificado.** Todo el código de este plan se ha compilado y probado (77 tests en verde) contra datos reales de dos reportes distintos antes de escribir el plan. Hay que copiarlo tal cual.

## Mapa de archivos

```
wcl-tools/                                  (raíz del repo git)
├── .gitignore
├── docs/superpowers/{specs,plans}/
├── wcl-fetch/                              scripts Node existentes
│   ├── .env / .env.example                 credenciales (T1)
│   ├── wcl-fetch-casts.js                  lee process.env (T1)
│   └── wcl-dump-sequence.js                lee process.env (T1)
└── cutting-venas/                          app Angular (T2)
    ├── proxy.conf.json                     /wcl/oauth, /wcl/api, /raidbots → destinos reales
    ├── scripts/capturar-fixture.ts         descarga RawJugador reales para tests (T4)
    └── src/
        ├── environments/environment(.example).ts
        ├── index.html                      lang=es, título, tooltips de Wowhead (T8)
        ├── styles.scss                     sistema visual Hallmark (T8)
        ├── testing/
        │   ├── fabrica.ts                  fixtures + crearJugador() para tests
        │   └── fixtures/*.json             3 jugadores reales + 2 specs de talentos
        └── app/
            ├── util/formato.ts             números, tiempos y dificultad en español
            ├── util/report-url.ts          URL de WCL → { reportCode, fightId, sourceId }
            ├── wcl/wcl-tipos.ts            formas crudas de la API + RawJugador
            ├── wcl/wcl-queries.ts          las 4 queries GraphQL
            ├── wcl/wcl-errores.ts          WclError + mensajes en español
            ├── wcl/wcl-auth.service.ts     token OAuth (client credentials)
            ├── wcl/wcl-api.service.ts      POST GraphQL, errores, datos parciales
            ├── wcl/wcl-report.service.ts   queries tipadas + paginación de eventos
            ├── talentos/talentos-tipos.ts  forma del JSON de Raidbots
            ├── talentos/talent-catalog.service.ts
            ├── modelo/player-fight-data.ts modelo normalizado
            ├── analisis/catalogo-habilidades.ts  listas editables (utilidad, defensivos, consumibles)
            ├── analisis/timeline.ts        casteos, huecos, cooldowns
            ├── analisis/normalizar.ts      RawJugador + SpecTalentos → PlayerFightData
            ├── analisis/comparison.ts      tipos de Comparison, Hallazgo y Regla
            ├── analisis/filas.ts           filas tú | él | diferencia (usadas por reglas y UI)
            ├── analisis/reglas/*.ts        impacto + reglas por bloque
            ├── analisis/motor.ts           comparar(mio, suyo) → Comparison
            ├── carga/player-fight-loader.service.ts
            ├── ui/enlaces.ts               iconos, enlaces a Wowhead y WCL
            ├── entrada/{selector-combate,entrada}.ts
            ├── comparacion/{comparacion-vista,veredicto,pestana-*,linea-tiempo}.ts
            ├── app.config.ts
            └── app.ts                      estado: entrada → cargando → comparación
```

## Cómo ejecutar tests

Desde `cutting-venas/`:
- Todos: `npx ng test --watch=false`
- Uno solo: `npx ng test --watch=false --include src/app/util/formato.spec.ts`

---

### Task 1: Repositorio git y claves fuera de los scripts

**Files:**
- Create: `.gitignore` (raíz `wcl-tools/`), `wcl-fetch/.env.example`, `wcl-fetch/.env`
- Modify: `wcl-fetch/wcl-fetch-casts.js:1-15`, `wcl-fetch/wcl-dump-sequence.js:1-18`

**Interfaces:**
- Produces: `wcl-fetch/.env` con `WCL_CLIENT_ID` y `WCL_CLIENT_SECRET`. La T4 lo usa para capturar fixtures (`node --env-file=../wcl-fetch/.env …`).

- [ ] **Step 1: Crear `.gitignore` en la raíz `wcl-tools/`**

```gitignore
node_modules/
dist/
.angular/
.env
cutting-venas/src/environments/environment.ts
```

- [ ] **Step 2: Crear `wcl-fetch/.env.example`**

```dotenv
# Credenciales de cliente de https://www.warcraftlogs.com/api/clients
WCL_CLIENT_ID=
WCL_CLIENT_SECRET=
```

- [ ] **Step 3: Crear `wcl-fetch/.env` con los valores que hoy están escritos directamente en `wcl-fetch-casts.js` (`CLIENT_ID` y `CLIENT_SECRET`)**

```dotenv
WCL_CLIENT_ID=<valor actual de CLIENT_ID en wcl-fetch-casts.js>
WCL_CLIENT_SECRET=<valor actual de CLIENT_SECRET en wcl-fetch-casts.js>
```

- [ ] **Step 4: En `wcl-fetch/wcl-fetch-casts.js` y en `wcl-fetch/wcl-dump-sequence.js`, sustituir las dos líneas `const CLIENT_ID = …` / `const CLIENT_SECRET = …` por:**

```js
const CLIENT_ID = process.env.WCL_CLIENT_ID;
const CLIENT_SECRET = process.env.WCL_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan WCL_CLIENT_ID / WCL_CLIENT_SECRET. Crea wcl-fetch/.env (ver .env.example) y ejecuta con: node --env-file=.env <script>');
  process.exit(1);
}
```

En el comentario de cabecera de ambos, sustituir la línea de debajo de `Uso:` (`WCL_CLIENT_ID=xxx WCL_CLIENT_SECRET=yyy node …`) por:

```js
 *   node --env-file=.env wcl-fetch-casts.js
```

(En `wcl-dump-sequence.js`, con su propio nombre de archivo.)

- [ ] **Step 5: Verificar que ya no queda ningún secreto en el código y que el script sigue funcionando**

Run: `grep -n "CLIENT_ID = '\|CLIENT_SECRET = '" wcl-fetch/*.js` → Expected: no output
Run (desde `wcl-fetch/`): `node --env-file=.env wcl-dump-sequence.js` → Expected: `Guardado wcl-secuencia-completa.txt con … casteos.`

- [ ] **Step 6: Iniciar git y hacer commit (raíz `wcl-tools/`)**

```bash
git init
git add .gitignore wcl-fetch/.env.example wcl-fetch/*.js wcl-fetch/*.txt wcl-fetch/*.json docs/
git status   # comprobar que wcl-fetch/.env NO aparece
git commit -m "chore: repo inicial, spec de Cutting Venas y credenciales fuera del código"
```

- [ ] **Step 7: Avisar al usuario** de que el secret antiguo estuvo escrito en los scripts y conviene regenerarlo en https://www.warcraftlogs.com/api/clients (y después actualizar `wcl-fetch/.env` y `environment.ts`).

---

### Task 2: Scaffold de la app Angular, proxy, entorno y utilidades de formato

**Files:**
- Create: `cutting-venas/` (vía CLI), `cutting-venas/proxy.conf.json`, `src/environments/environment.example.ts`, `src/environments/environment.ts`, `src/app/util/formato.ts`, `src/app/util/report-url.ts`, `src/app/util/formato.spec.ts`, `src/app/util/report-url.spec.ts`
- Modify: `angular.json` (serve.options.proxyConfig), `tsconfig.json` (resolveJsonModule), `package.json` (script `capturar`), `src/app/app.config.ts`, `src/app/app.ts`
- Delete: `src/app/app.html`, `src/app/app.scss`, `src/app/app.routes.ts`, `src/app/app.spec.ts`

**Interfaces:**
- Produces:
  - `num(n: number, dec = 0): string`
  - `reloj(ms: number): string`
  - `compacto(n: number): string`
  - `pctSigno(p: number): string`
  - `lista(nombres: string[], max = 4): string`
  - `nombreDificultad(d: number | null): string`
  - `interface ReferenciaCombate { reportCode: string; fightId: number | null; sourceId: number | null }`
  - `parsearUrlReporte(texto: string): ReferenciaCombate | null`
  - Rutas de proxy: `/wcl/oauth`, `/wcl/api`, `/raidbots/...`

- [ ] **Step 1: Crear la app (desde `wcl-tools/`)**

```bash
npx -y @angular/cli@21 new cutting-venas --style=scss --ssr=false --skip-git --defaults --interactive=false
cd cutting-venas
```

Expected: `✔ Packages installed successfully.` y `package.json` con `@angular/core ^21.2`, `vitest ^4`.

- [ ] **Step 2: Borrar los archivos de ejemplo del CLI**

```bash
rm src/app/app.html src/app/app.scss src/app/app.routes.ts src/app/app.spec.ts
```

- [ ] **Step 3: `src/app/app.config.ts` (sin router; con HttpClient)**

```ts
import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideHttpClient()],
};
```

- [ ] **Step 4: `src/app/app.ts` provisional (la versión final llega en la Task 7)**

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `<h1>Cutting Venas</h1>`,
})
export class App {}
```

- [ ] **Step 5: `proxy.conf.json` y registrarlo en `angular.json`**

```json
{
  "/wcl/oauth": {
    "target": "https://www.warcraftlogs.com",
    "secure": true,
    "changeOrigin": true,
    "pathRewrite": { "^/wcl/oauth": "/oauth/token" }
  },
  "/wcl/api": {
    "target": "https://www.warcraftlogs.com",
    "secure": true,
    "changeOrigin": true,
    "pathRewrite": { "^/wcl/api": "/api/v2/client" }
  },
  "/raidbots": {
    "target": "https://www.raidbots.com",
    "secure": true,
    "changeOrigin": true,
    "pathRewrite": { "^/raidbots": "" }
  }
}
```

```bash
node -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync('angular.json'));a.projects['cutting-venas'].architect.serve.options={proxyConfig:'proxy.conf.json'};fs.writeFileSync('angular.json',JSON.stringify(a,null,2)+'\n')"
```

- [ ] **Step 6: Permitir importar JSON (los fixtures de test) en `tsconfig.json`**

En `compilerOptions`, justo después de `"module": "preserve"`, añadir:

```json
    "resolveJsonModule": true
```

(con la coma correspondiente en la línea anterior).

- [ ] **Step 7: Entorno con credenciales**

`src/environments/environment.example.ts`:

```ts
// Copia este archivo a environment.ts y rellena tus credenciales de cliente de WarcraftLogs
// (https://www.warcraftlogs.com/api/clients). environment.ts está en .gitignore.
export const environment = {
  wclClientId: '',
  wclClientSecret: '',
};
```

Después copiarlo a `src/environments/environment.ts` y rellenar `wclClientId` y `wclClientSecret` con los valores de `wcl-fetch/.env`:

```bash
cp src/environments/environment.example.ts src/environments/environment.ts
```

- [ ] **Step 8: Script para capturar fixtures en `package.json`**

En `"scripts"`, añadir:

```json
    "capturar": "node --env-file=../wcl-fetch/.env scripts/capturar-fixture.ts"
```

- [ ] **Step 9: Escribir los tests de utilidades (fallarán: los módulos no existen)**

`src/app/util/formato.spec.ts`:

```ts
import { compacto, lista, nombreDificultad, num, pctSigno, reloj } from './formato';

describe('formato', () => {
  it('num usa formato español', () => {
    expect(num(8.1, 1)).toBe('8,1');
    expect(num(12345)).toBe('12.345');
  });

  it('reloj convierte ms a m:ss', () => {
    expect(reloj(0)).toBe('0:00');
    expect(reloj(62000)).toBe('1:02');
    expect(reloj(494870)).toBe('8:14');
  });

  it('compacto abrevia miles y millones', () => {
    expect(compacto(412345)).toBe('412,3 k');
    expect(compacto(1500000)).toBe('1,50 M');
    expect(compacto(950)).toBe('950');
  });

  it('pctSigno redondea y pone signo', () => {
    expect(pctSigno(-23.4)).toBe('−23 %');
    expect(pctSigno(44.6)).toBe('+45 %');
    expect(pctSigno(0.2)).toBe('0 %');
  });

  it('lista corta a partir de 4 elementos', () => {
    expect(lista(['a', 'b'])).toBe('a, b');
    expect(lista(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('a, b, c, d y 2 más');
  });

  it('nombreDificultad traduce los ids de WCL', () => {
    expect(nombreDificultad(4)).toBe('Heroico');
    expect(nombreDificultad(5)).toBe('Mítico');
    expect(nombreDificultad(null)).toBe('—');
    expect(nombreDificultad(99)).toBe('Dificultad 99');
  });
});
```

`src/app/util/report-url.spec.ts`:

```ts
import { parsearUrlReporte } from './report-url';

describe('parsearUrlReporte', () => {
  it('extrae reporte, pelea y jugador de una URL completa', () => {
    expect(parsearUrlReporte('https://www.warcraftlogs.com/reports/DFwWK2hHpCcq4t8R#fight=14&type=damage-done&source=17')).toEqual({
      reportCode: 'DFwWK2hHpCcq4t8R',
      fightId: 14,
      sourceId: 17,
    });
  });

  it('acepta parámetros con ? y espacios alrededor', () => {
    expect(parsearUrlReporte('  https://www.warcraftlogs.com/reports/DkNt713VdTzjrPZA?fight=2&source=85 ')).toEqual({
      reportCode: 'DkNt713VdTzjrPZA',
      fightId: 2,
      sourceId: 85,
    });
  });

  it('deja fight y source a null si faltan o si fight=last', () => {
    expect(parsearUrlReporte('https://www.warcraftlogs.com/reports/DFwWK2hHpCcq4t8R')).toEqual({
      reportCode: 'DFwWK2hHpCcq4t8R',
      fightId: null,
      sourceId: null,
    });
    expect(parsearUrlReporte('https://www.warcraftlogs.com/reports/DFwWK2hHpCcq4t8R#fight=last')?.fightId).toBeNull();
  });

  it('acepta un código de reporte suelto', () => {
    expect(parsearUrlReporte('DFwWK2hHpCcq4t8R')?.reportCode).toBe('DFwWK2hHpCcq4t8R');
  });

  it('devuelve null si no es una URL de reporte', () => {
    expect(parsearUrlReporte('https://www.google.com')).toBeNull();
    expect(parsearUrlReporte('')).toBeNull();
    expect(parsearUrlReporte('https://www.warcraftlogs.com/character/eu/uldum/rokka')).toBeNull();
  });
});
```

- [ ] **Step 10: Ejecutarlos y ver que fallan**

Run: `npx ng test --watch=false`
Expected: FAIL, no se puede resolver `./formato` ni `./report-url`

- [ ] **Step 11: Implementar `src/app/util/formato.ts`**

```ts
const formateadores = new Map<number, Intl.NumberFormat>();

export function num(n: number, dec = 0): string {
  let f = formateadores.get(dec);
  if (!f) {
    f = new Intl.NumberFormat('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    formateadores.set(dec, f);
  }
  return f.format(n);
}

export function reloj(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function compacto(n: number): string {
  if (Math.abs(n) >= 1e6) return `${num(n / 1e6, 2)} M`;
  if (Math.abs(n) >= 1e3) return `${num(n / 1e3, 1)} k`;
  return num(n);
}

export function pctSigno(p: number): string {
  const r = Math.round(p);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)} %`;
}

export function lista(nombres: string[], max = 4): string {
  if (nombres.length <= max) return nombres.join(', ');
  return `${nombres.slice(0, max).join(', ')} y ${nombres.length - max} más`;
}

const DIFICULTADES: Record<number, string> = { 1: 'LFR', 3: 'Normal', 4: 'Heroico', 5: 'Mítico', 10: 'Mítica+' };

export function nombreDificultad(d: number | null): string {
  return d === null ? '—' : (DIFICULTADES[d] ?? `Dificultad ${d}`);
}
```

- [ ] **Step 12: Implementar `src/app/util/report-url.ts`**

```ts
export interface ReferenciaCombate {
  reportCode: string;
  fightId: number | null;
  sourceId: number | null;
}

const RE_URL = /warcraftlogs\.com\/reports\/([A-Za-z0-9]{16})/i;
const RE_CODIGO = /^([A-Za-z0-9]{16})$/;

/** Extrae reporte, pelea y jugador de una URL de WarcraftLogs (o de un código de reporte suelto). */
export function parsearUrlReporte(texto: string): ReferenciaCombate | null {
  const t = texto.trim();
  const m = RE_URL.exec(t) ?? RE_CODIGO.exec(t);
  if (!m) return null;
  const fight = /[#?&]fight=(\d+)/.exec(t);
  const source = /[#?&]source=(\d+)/.exec(t);
  return {
    reportCode: m[1],
    fightId: fight ? Number(fight[1]) : null,
    sourceId: source ? Number(source[1]) : null,
  };
}
```

- [ ] **Step 13: Tests y build en verde**

Run: `npx ng test --watch=false` → Expected: `Test Files 2 passed`, `Tests 11 passed`
Run: `npx ng build` → Expected: `Application bundle generation complete.` sin errores

- [ ] **Step 14: Comprobar el proxy contra WCL y Raidbots**

Arrancar `npm start` en otra terminal y, cuando esté escuchando en `http://localhost:4200`, ejecutar desde `cutting-venas/`:

```bash
node --env-file=../wcl-fetch/.env -e "
const b='http://localhost:4200';
const t=await fetch(b+'/wcl/oauth',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(process.env.WCL_CLIENT_ID+':'+process.env.WCL_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
const {access_token}=await t.json(); console.log('oauth',t.status,!!access_token);
const a=await fetch(b+'/wcl/api',{method:'POST',headers:{Authorization:'Bearer '+access_token,'Content-Type':'application/json'},body:JSON.stringify({query:'{ rateLimitData { limitPerHour } }'})});
console.log('api',a.status); const r=await fetch(b+'/raidbots/static/data/live/talents.json'); console.log('raidbots',r.status,(await r.json()).length);
" --input-type=module
```

Expected: `oauth 200 true`, `api 200`, `raidbots 200 40`. Después, parar `npm start`.

- [ ] **Step 15: Commit**

```bash
git add cutting-venas
git status   # comprobar que src/environments/environment.ts NO aparece
git commit -m "feat(cutting-venas): scaffold Angular 21, proxy WCL/Raidbots y utilidades de formato"
```

---

### Task 3: Capa WarcraftLogs (tipos, queries, errores, auth, API, report service)

**Files:**
- Create: `src/app/wcl/wcl-tipos.ts`, `src/app/wcl/wcl-queries.ts`, `src/app/wcl/wcl-errores.ts`, `src/app/wcl/wcl-auth.service.ts`, `src/app/wcl/wcl-api.service.ts`, `src/app/wcl/wcl-report.service.ts`
- Test: `src/app/wcl/wcl-api.service.spec.ts`

**Interfaces:**
- Consumes: `environment` (T2).
- Produces:
  - **Tipos crudos**: `WclFight`, `WclActor`, `WclResumen`, `WclJugadorDetalle`, `WclDetalle`, `WclEvento`, `WclCombatantInfo`, `RawJugador { reportCode; fight; actor; detallesJugador; detalle; eventos }`.
  - **Queries**: `QUERY_RESUMEN`, `QUERY_JUGADORES`, `QUERY_DETALLE`, `QUERY_EVENTOS` y `filtroPorNombre(nombre)`.
  - **Errores**:
    - `class WclError { codigo: CodigoErrorWcl; message }`
    - `CodigoErrorWcl = 'config'|'credenciales'|'url'|'no-encontrado'|'jugador-ausente'|'limite'|'red'|'graphql'`
    - `MENSAJES_ERROR`, `traducirErrorHttp(e)`, `mensajeDeError(e): string`
  - **Autenticación**: `WCL_CREDENCIALES` (InjectionToken) y `WclAuthService { configurado(): boolean; obtenerToken(): Promise<string>; invalidar() }`.
  - **API**: `WclApiService { consulta<T>(query, variables): Promise<T> }`.
  - **Reportes** (`WclReportService`):
    - `resumen(code): Promise<WclResumen>`
    - `jugadores(code, fight): Promise<WclJugadorDetalle[]>`
    - `detalle(code, fight, source, nombre): Promise<WclDetalle>`
    - `eventosCasteo(code, fight: WclFight, source): Promise<WclEvento[]>`

Notas sobre la API de WCL, verificadas con datos reales:
- `Buffs` con `sourceID` devuelve los buffs que lleva el jugador, se los ponga quien se los ponga. Por eso se filtra con `filterExpression: source.name = "<nombre>"` para quedarse con los que se aplica él mismo.
- Los debuffs que el jugador aplica a enemigos solo se obtienen con `hostilityType: Enemies` + `filterExpression: source.name = "<nombre>"`. Ni `sourceID` ni `source.id` devuelven nada ahí.
- `events(dataType: Casts)` devuelve `begincast` y `cast`, y pagina con `nextPageTimestamp`.

- [ ] **Step 1: Tipos y queries (no tienen lógica, así que no llevan test propio)**

`src/app/wcl/wcl-tipos.ts`:

```ts
// Formas de las respuestas crudas de la API v2 de WarcraftLogs (solo los campos que usamos).

export interface WclFight {
  id: number;
  name: string;
  encounterID: number;
  difficulty: number | null;
  kill: boolean | null;
  startTime: number;
  endTime: number;
  friendlyPlayers: number[] | null;
}

export interface WclActor {
  id: number;
  name: string;
  subType: string;
}

export interface WclResumen {
  title: string;
  fights: WclFight[];
  masterData: { actors: WclActor[] };
}

export interface WclJugadorDetalle {
  name: string;
  id: number;
  type: string;
  specs: { spec: string }[];
  potionUse?: number;
  healthstoneUse?: number;
}

export interface WclPlayerDetails {
  data: {
    playerDetails: {
      tanks?: WclJugadorDetalle[];
      healers?: WclJugadorDetalle[];
      dps?: WclJugadorDetalle[];
    };
  };
}

export interface WclEntradaTabla {
  name: string;
  guid: number;
  type: number;
  total: number;
  uses?: number;
  abilityIcon?: string;
  actorName?: string;
}

export interface WclTablaEntradas {
  data: { entries: WclEntradaTabla[]; totalTime: number };
}

export interface WclAuraTabla {
  name: string;
  guid: number;
  totalUptime: number;
  abilityIcon?: string;
}

export interface WclTablaAuras {
  data: { auras: WclAuraTabla[]; totalTime: number };
}

export interface WclMuerte {
  timestamp: number;
  killingBlow?: { name: string } | null;
}

export interface WclTablaMuertes {
  data: { entries: WclMuerte[] };
}

export interface WclPieza {
  id: number;
  itemLevel: number;
  icon: string;
  permanentEnchant?: number;
  gems?: { id: number }[];
  bonusIDs?: number[];
}

export interface WclCombatantInfo {
  specID: number;
  gear: WclPieza[];
  talentTree: { id: number; rank: number; nodeID: number }[];
  strength: number;
  agility: number;
  intellect: number;
  critMelee: number;
  critRanged: number;
  critSpell: number;
  hasteMelee: number;
  hasteRanged: number;
  hasteSpell: number;
  mastery: number;
  versatilityDamageDone: number;
}

export interface WclDetalle {
  masterData: { abilities: { gameID: number; name: string; icon: string }[] };
  danoHecho: WclTablaEntradas | null;
  casteos: WclTablaEntradas | null;
  buffs: WclTablaAuras | null;
  debuffs: WclTablaAuras | null;
  danoRecibido: WclTablaEntradas | null;
  muertes: WclTablaMuertes | null;
  combatantInfo: { data: WclCombatantInfo[] } | null;
}

export interface WclEvento {
  timestamp: number;
  type: string;
  sourceID: number;
  abilityGameID: number;
}

/** Todo lo descargado de un jugador en una pelea, antes de normalizar. */
export interface RawJugador {
  reportCode: string;
  fight: WclFight;
  actor: WclActor;
  detallesJugador: WclJugadorDetalle | null;
  detalle: WclDetalle;
  eventos: WclEvento[];
}
```

`src/app/wcl/wcl-queries.ts`:

```ts
export const QUERY_RESUMEN = `
query Resumen($code: String!) {
  reportData {
    report(code: $code) {
      title
      fights(killType: Encounters) { id name encounterID difficulty kill startTime endTime friendlyPlayers }
      masterData { actors(type: "Player") { id name subType } }
    }
  }
}`;

export const QUERY_JUGADORES = `
query Jugadores($code: String!, $fight: Int!) {
  reportData {
    report(code: $code) {
      playerDetails(fightIDs: [$fight])
    }
  }
}`;

export const QUERY_DETALLE = `
query Detalle($code: String!, $fights: [Int]!, $source: Int!, $filtro: String!) {
  reportData {
    report(code: $code) {
      masterData { abilities { gameID name icon } }
      danoHecho: table(fightIDs: $fights, sourceID: $source, dataType: DamageDone)
      casteos: table(fightIDs: $fights, sourceID: $source, dataType: Casts)
      buffs: table(fightIDs: $fights, sourceID: $source, dataType: Buffs, filterExpression: $filtro)
      debuffs: table(fightIDs: $fights, dataType: Debuffs, hostilityType: Enemies, filterExpression: $filtro)
      danoRecibido: table(fightIDs: $fights, sourceID: $source, dataType: DamageTaken)
      muertes: table(fightIDs: $fights, sourceID: $source, dataType: Deaths)
      combatantInfo: events(fightIDs: $fights, sourceID: $source, dataType: CombatantInfo, limit: 5) { data }
    }
  }
}`;

export const QUERY_EVENTOS = `
query Eventos($code: String!, $fight: Int!, $source: Int!, $inicio: Float!, $fin: Float!) {
  reportData {
    report(code: $code) {
      events(fightIDs: [$fight], sourceID: $source, dataType: Casts, startTime: $inicio, endTime: $fin, limit: 10000) {
        data
        nextPageTimestamp
      }
    }
  }
}`;

export function filtroPorNombre(nombre: string): string {
  return `source.name = "${nombre.replace(/"/g, '')}"`;
}
```

- [ ] **Step 2: Escribir el test de auth y API**

`src/app/wcl/wcl-api.service.spec.ts`:

```ts
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
```

- [ ] **Step 3: Ver que falla**

Run: `npx ng test --watch=false --include src/app/wcl/wcl-api.service.spec.ts`
Expected: FAIL, no se resuelven `./wcl-api.service`, `./wcl-auth.service` ni `./wcl-errores`

- [ ] **Step 4: Implementar errores, auth y API**

`src/app/wcl/wcl-errores.ts`:

```ts
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
```

`src/app/wcl/wcl-auth.service.ts`:

```ts
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
```

`src/app/wcl/wcl-api.service.ts`:

```ts
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
```

- [ ] **Step 5: Implementar `src/app/wcl/wcl-report.service.ts`** (lo prueban la T5, con mocks, y la T10, en real)

```ts
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
```

- [ ] **Step 6: Tests en verde**

Run: `npx ng test --watch=false --include src/app/wcl/wcl-api.service.spec.ts`
Expected: `Tests 7 passed`

- [ ] **Step 7: Commit**

```bash
git add cutting-venas/src/app/wcl
git commit -m "feat(cutting-venas): capa WCL con OAuth, GraphQL, errores en español y queries tipadas"
```

---

### Task 4: Fixtures reales y normalización a `PlayerFightData`

**Files:**
- Create: `scripts/capturar-fixture.ts`, `src/testing/fixtures/*.json` (generados), `src/testing/fabrica.ts`, `src/app/modelo/player-fight-data.ts`, `src/app/talentos/talentos-tipos.ts`, `src/app/analisis/catalogo-habilidades.ts`, `src/app/analisis/timeline.ts`, `src/app/analisis/normalizar.ts`
- Test: `src/app/analisis/timeline.spec.ts`, `src/app/analisis/normalizar.spec.ts`

**Interfaces:**
- Consumes: `RawJugador` y el resto de tipos de `wcl-tipos.ts`; `QUERY_*` y `filtroPorNombre` (T3).
- Produces:
  - **Modelo**: `PlayerFightData`, con `meta`, `disponible: Record<Bloque, boolean>`, `build`, `rendimiento`, `timeline`, `auras` y `supervivencia`.
  - **Tipos del modelo**: `Bloque = 'build'|'rendimiento'|'rotacion'|'supervivencia'`, `Talento`, `Pieza`, `Hechizo`, `Casteo {inicio, fin, guid, nombre}`, `Hueco`, `Aura`, `Muerte`, etc.
  - **Talentos**: `SpecTalentos`, `RbNodo`, `RbEntrada`.
  - **Línea de tiempo**:
    - `construirCasteos(eventos, inicioPelea, nombres): Casteo[]`
    - `detectarHuecos(casteos, duracionMs): Hueco[]`
    - `detectarCooldowns(casteosPorNombre, buffsPropios, duracionMs): string[]`
  - **Normalización**:
    - `normalizar(raw: RawJugador, spec: SpecTalentos | null): PlayerFightData`
    - `resolverTalentos(arbol, spec): { talentos; heroe }`
  - **Catálogo**: `UTILIDAD`, `DEFENSIVOS`, `REGEX_FLASK|COMIDA|RUNA`, `POCIONES_DPS`, `esPocionDps`, `esAuraConsumible`, `esBuffRelevante(nombre, claves)`, `NOMBRES_RANURA` y `RANURAS_IGNORADAS`.
  - **Tests** (`fabrica.ts`):
    - `RAW.{rokka,diamades,brujo}` y `SPECS.{elemental,afliccion}`
    - `rokka()`, `diamades()`, `brujo()`
    - `crearJugador(cambios)`
    - `hechizo(nombre, dano, casteos)`

- [ ] **Step 1: Script de captura `scripts/capturar-fixture.ts`**

```ts
// Descarga un RawJugador real y el catálogo de talentos de su spec como fixtures de test.
// Uso (desde cutting-venas/):
//   node --env-file=../wcl-fetch/.env scripts/capturar-fixture.ts <reportCode> <fightId> <sourceId>
import { writeFileSync, mkdirSync } from 'node:fs';
import {
  QUERY_DETALLE,
  QUERY_EVENTOS,
  QUERY_JUGADORES,
  QUERY_RESUMEN,
  filtroPorNombre,
} from '../src/app/wcl/wcl-queries.ts';

const [code, fightArg, sourceArg] = process.argv.slice(2);
if (!code || !fightArg || !sourceArg) {
  console.error('Uso: node --env-file=../wcl-fetch/.env scripts/capturar-fixture.ts <reportCode> <fightId> <sourceId>');
  process.exit(1);
}
const fightId = Number(fightArg);
const sourceId = Number(sourceArg);
const { WCL_CLIENT_ID, WCL_CLIENT_SECRET } = process.env;
if (!WCL_CLIENT_ID || !WCL_CLIENT_SECRET) throw new Error('Faltan WCL_CLIENT_ID / WCL_CLIENT_SECRET en el entorno');

const tokenRes = await fetch('https://www.warcraftlogs.com/oauth/token', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from(`${WCL_CLIENT_ID}:${WCL_CLIENT_SECRET}`).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
});
const { access_token } = (await tokenRes.json()) as { access_token: string };

async function gql(query: string, variables: Record<string, unknown>): Promise<any> {
  const res = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as any;
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.reportData.report;
}

const resumen = await gql(QUERY_RESUMEN, { code });
const fight = resumen.fights.find((f: any) => f.id === fightId);
const actor = resumen.masterData.actors.find((a: any) => a.id === sourceId);
if (!fight || !actor) throw new Error('Pelea o jugador no encontrados');

const jugadores = await gql(QUERY_JUGADORES, { code, fight: fightId });
const pd = jugadores.playerDetails.data.playerDetails;
const detallesJugador =
  [...(pd.tanks ?? []), ...(pd.healers ?? []), ...(pd.dps ?? [])].find((p: any) => p.id === sourceId) ?? null;

const detalle = await gql(QUERY_DETALLE, {
  code,
  fights: [fightId],
  source: sourceId,
  filtro: filtroPorNombre(actor.name),
});

const eventos: any[] = [];
let inicio: number | null = fight.startTime;
while (inicio !== null) {
  const r = await gql(QUERY_EVENTOS, { code, fight: fightId, source: sourceId, inicio, fin: fight.endTime });
  eventos.push(...r.events.data);
  inicio = r.events.nextPageTimestamp ?? null;
}

const raw = { reportCode: code, fight, actor, detallesJugador, detalle, eventos };
mkdirSync('src/testing/fixtures', { recursive: true });
writeFileSync(`src/testing/fixtures/jugador-${code}-${fightId}-${sourceId}.json`, JSON.stringify(raw));

const specId = detalle.combatantInfo.data[0]?.specID;
const talentos = (await (await fetch('https://www.raidbots.com/static/data/live/talents.json')).json()) as any[];
const spec = talentos.find((t) => t.specId === specId);
writeFileSync(`src/testing/fixtures/talentos-${specId}.json`, JSON.stringify(spec));

console.log(`OK: ${eventos.length} eventos, spec ${specId}, jugador ${actor.name}`);
```

- [ ] **Step 2: Capturar los tres jugadores, de dos reportes distintos y dos clases**

```bash
npm run capturar -- DFwWK2hHpCcq4t8R 14 17
npm run capturar -- DFwWK2hHpCcq4t8R 14 22
npm run capturar -- DkNt713VdTzjrPZA 2 85
```

Expected, una línea por cada comando:
- `OK: 506 eventos, spec 262, jugador Rokka`
- `OK: 665 eventos, spec 265, jugador Mutgagarín`
- `OK: 545 eventos, spec 262, jugador Diamades`

Resultado en `src/testing/fixtures/`:
- `jugador-DFwWK2hHpCcq4t8R-14-17.json`
- `jugador-DFwWK2hHpCcq4t8R-14-22.json`
- `jugador-DkNt713VdTzjrPZA-2-85.json`
- `talentos-262.json`
- `talentos-265.json`

(Un aviso `MODULE_TYPELESS_PACKAGE_JSON` en la salida es inofensivo.)

- [ ] **Step 3: Modelo y tipos de talentos**

`src/app/modelo/player-fight-data.ts`:

```ts
export type Bloque = 'build' | 'rendimiento' | 'rotacion' | 'supervivencia';

export interface MetaPelea {
  reportCode: string;
  fightId: number;
  sourceId: number;
  nombre: string;
  clase: string;
  spec: string;
  specId: number | null;
  boss: string;
  encounterId: number;
  dificultad: number | null;
  kill: boolean;
  duracionMs: number;
}

export interface Talento {
  entryId: number;
  nodeId: number;
  nombre: string;
  rango: number;
  arbol: 'clase' | 'spec' | 'heroe';
  spellId: number | null;
  icono: string | null;
}

export interface Pieza {
  ranura: number;
  itemId: number;
  ilvl: number;
  encantamiento: number | null;
  gemas: number[];
  bonusIds: number[];
  icono: string;
}

export interface Stats {
  principal: number;
  critico: number;
  celeridad: number;
  maestria: number;
  versatilidad: number;
}

export interface Consumibles {
  flask: string | null;
  comida: string | null;
  runa: string | null;
  pocionDps: string | null;
}

export interface Build {
  talentos: Talento[];
  heroe: string | null;
  equipo: Pieza[];
  ilvlMedio: number;
  stats: Stats;
  consumibles: Consumibles;
}

export interface Hechizo {
  guid: number;
  nombre: string;
  icono: string | null;
  dano: number;
  porcentaje: number;
  casteos: number;
  cpm: number;
  danoPorCasteo: number;
}

export interface Rendimiento {
  dps: number;
  danoTotal: number;
  hechizos: Hechizo[];
}

export interface Casteo {
  inicio: number;
  fin: number;
  guid: number;
  nombre: string;
}

export interface Hueco {
  desde: number;
  hasta: number;
  duracion: number;
  tras: string;
}

export interface Timeline {
  casteos: Casteo[];
  huecos: Hueco[];
  downtimeMs: number;
  downtimePct: number;
  cooldowns: string[];
}

export interface Aura {
  guid: number;
  nombre: string;
  tipo: 'buff' | 'debuff';
  uptimePct: number;
}

export interface DanoRecibido {
  guid: number;
  nombre: string;
  origen: string;
  total: number;
  porMinuto: number;
}

export interface Muerte {
  t: number;
  causa: string;
}

export interface UsoDefensivo {
  nombre: string;
  usos: number;
}

export interface Supervivencia {
  danoRecibido: DanoRecibido[];
  totalRecibido: number;
  muertes: Muerte[];
  defensivos: UsoDefensivo[];
  pocionesVida: number;
  piedrasVida: number;
}

export interface PlayerFightData {
  meta: MetaPelea;
  disponible: Record<Bloque, boolean>;
  build: Build;
  rendimiento: Rendimiento;
  timeline: Timeline;
  auras: Aura[];
  supervivencia: Supervivencia;
}
```

`src/app/talentos/talentos-tipos.ts`:

```ts
// Forma del catálogo público de Raidbots: https://www.raidbots.com/static/data/live/talents.json

export interface RbEntrada {
  id: number;
  name?: string;
  spellId?: number;
  icon?: string;
  type?: string;
}

export interface RbNodo {
  id: number;
  name: string;
  entries: RbEntrada[];
}

export interface SpecTalentos {
  specId: number;
  className: string;
  specName: string;
  classNodes: RbNodo[];
  specNodes: RbNodo[];
  heroNodes: RbNodo[];
  subTreeNodes: RbNodo[];
}
```

- [ ] **Step 4: Test de la línea de tiempo**

`src/app/analisis/timeline.spec.ts`:

```ts
import { WclEvento } from '../wcl/wcl-tipos';
import { construirCasteos, detectarCooldowns, detectarHuecos } from './timeline';

const ev = (timestamp: number, type: string, abilityGameID: number): WclEvento => ({
  timestamp,
  type,
  sourceID: 1,
  abilityGameID,
});
const nombres = new Map([
  [1, 'Fireball'],
  [2, 'Combustion'],
]);

describe('construirCasteos', () => {
  it('empareja begincast con cast y no duplica', () => {
    const casteos = construirCasteos([ev(1000, 'begincast', 1), ev(3000, 'cast', 1), ev(3500, 'cast', 2)], 1000, nombres);
    expect(casteos).toEqual([
      { inicio: 0, fin: 2000, guid: 1, nombre: 'Fireball' },
      { inicio: 2500, fin: 2500, guid: 2, nombre: 'Combustion' },
    ]);
  });

  it('ignora un begincast de hace más de 10 s', () => {
    const [c] = construirCasteos([ev(0, 'begincast', 1), ev(20000, 'cast', 1)], 0, nombres);
    expect(c.inicio).toBe(20000);
  });

  it('pone #id si la habilidad no tiene nombre', () => {
    expect(construirCasteos([ev(0, 'cast', 99)], 0, nombres)[0].nombre).toBe('#99');
  });
});

describe('detectarHuecos', () => {
  const c = (inicio: number, fin: number) => ({ inicio, fin, guid: 1, nombre: 'Fireball' });

  it('el tiempo de casteo no cuenta como hueco', () => {
    expect(detectarHuecos([c(0, 2500), c(2600, 5000)], 5000)).toEqual([]);
  });

  it('detecta huecos de más de 1,5 s, incluido el tramo final', () => {
    const huecos = detectarHuecos([c(0, 1000), c(4000, 4000)], 10000);
    expect(huecos).toEqual([
      { desde: 1000, hasta: 4000, duracion: 3000, tras: 'Fireball' },
      { desde: 4000, hasta: 10000, duracion: 6000, tras: 'Fireball' },
    ]);
  });

  it('un hueco de exactamente 1,5 s no cuenta', () => {
    expect(detectarHuecos([c(0, 1000), c(2500, 2500)], 2500)).toEqual([]);
  });
});

describe('detectarCooldowns', () => {
  it('exige frecuencia baja y buff propio con el mismo nombre', () => {
    const casteos = new Map([
      ['Combustion', 3],
      ['Fireball', 120],
      ['Scorch', 2],
    ]);
    expect(detectarCooldowns(casteos, new Set(['Combustion', 'Fireball']), 300000)).toEqual(['Combustion']);
  });

  it('excluye utilidad, defensivos y pociones', () => {
    const casteos = new Map([
      ['Ghost Wolf', 1],
      ['Ice Block', 1],
      ["Light's Potential", 1],
    ]);
    expect(detectarCooldowns(casteos, new Set(casteos.keys()), 300000)).toEqual([]);
  });
});
```

- [ ] **Step 5: Ver que falla**

Run: `npx ng test --watch=false --include src/app/analisis/timeline.spec.ts`
Expected: FAIL, no se resuelve `./timeline`

- [ ] **Step 6: Implementar el catálogo y la línea de tiempo**

`src/app/analisis/catalogo-habilidades.ts`:

```ts
// Listas editables por nombre (inglés, tal como vienen de WCL).
// Ampliar aquí cuando aparezcan falsos positivos o negativos.

/** Movilidad, utilidad y buffs de banda: nunca cuentan como cooldown ofensivo. */
export const UTILIDAD = new Set<string>([
  'Ghost Wolf', 'Gust of Wind', "Spiritwalker's Grace", 'Skyfury', 'Wind Rush Totem', 'Tremor Totem',
  'Reincarnation', 'Time Warp', 'Bloodlust', 'Heroism', 'Primal Rage', 'Fury of the Aspects',
  'Blink', 'Shimmer', 'Sprint', 'Dash', 'Stampeding Roar', 'Heroic Leap', 'Disengage', 'Roll',
  'Chi Torpedo', "Tiger's Lust", 'Hover', 'Door of Shadows', 'Leap of Faith', 'Angelic Feather',
  'Divine Steed', "Death's Advance", 'Wraith Walk', 'Fel Rush', 'Vengeful Retreat', 'Shadowstep',
  'Arcane Intellect', 'Mark of the Wild', 'Battle Shout', 'Power Word: Fortitude', 'Blessing of the Bronze',
]);

/** Defensivos personales: se listan en Supervivencia y no cuentan como cooldown ofensivo. */
export const DEFENSIVOS = new Set<string>([
  'Astral Shift', 'Ice Block', 'Ice Cold', 'Mirror Image', 'Alter Time', 'Greater Invisibility',
  'Divine Shield', 'Divine Protection', 'Shield of Vengeance', 'Blessing of Protection',
  'Unending Resolve', 'Dark Pact', 'Survival Instincts', 'Barkskin', 'Renewal',
  'Obsidian Scales', 'Renewing Blaze', 'Aspect of the Turtle', 'Survival of the Fittest', 'Exhilaration',
  'Die by the Sword', 'Enraged Regeneration', 'Ignore Pain', 'Rallying Cry', 'Spell Reflection', 'Shield Wall',
  'Icebound Fortitude', 'Anti-Magic Shell', 'Anti-Magic Zone', 'Lichborne', 'Death Pact',
  'Blur', 'Netherwalk', 'Darkness', 'Fortifying Brew', 'Diffuse Magic', 'Dampen Harm', 'Touch of Karma',
  'Desperate Prayer', 'Dispersion', 'Fade', 'Vampiric Embrace', 'Evasion', 'Cloak of Shadows', 'Feint',
  'Crimson Vial', 'Stone Bulwark Totem', 'Earth Elemental',
]);

export const REGEX_FLASK = /^(Flask|Phial) of/i;
export const REGEX_COMIDA = /Well Fed|Hearty/i;
export const REGEX_RUNA = /Augment/i;
export const POCIONES_DPS = new Set<string>([
  "Light's Potential", 'Tempered Potion', 'Potion of Unwavering Focus', 'Elemental Potion of Ultimate Power',
]);

export function esPocionDps(nombre: string): boolean {
  return POCIONES_DPS.has(nombre) || (/Potion/i.test(nombre) && !/Heal|Health|Mana|Invisib/i.test(nombre));
}

export const NOMBRES_RANURA = [
  'Cabeza', 'Cuello', 'Hombros', 'Camisa', 'Pecho', 'Cintura', 'Piernas', 'Pies', 'Muñecas', 'Manos',
  'Anillo 1', 'Anillo 2', 'Abalorio 1', 'Abalorio 2', 'Espalda', 'Mano principal', 'Mano secundaria', 'Tabardo',
];

/** Ranuras que no aportan (camisa y tabardo). */
export const RANURAS_IGNORADAS = new Set([3, 17]);

/** Auras de consumibles (flask, comida, runas, pociones): las cubre la regla de consumibles, no la de uptime. */
export function esAuraConsumible(nombre: string): boolean {
  return REGEX_FLASK.test(nombre) || REGEX_COMIDA.test(nombre) || REGEX_RUNA.test(nombre) || /^Rune of/i.test(nombre) || esPocionDps(nombre);
}

/**
 * Un buff cuenta para la regla de uptime si coincide con un hechizo casteado o un talento
 * ("Elemental Blast: Haste" coincide con "Elemental Blast") y no es utilidad, defensivo ni consumible.
 * Así se descartan procs de abalorios, buffs de banda y mecánicas del boss.
 */
export function esBuffRelevante(nombre: string, claves: Set<string>): boolean {
  if (UTILIDAD.has(nombre) || DEFENSIVOS.has(nombre) || esAuraConsumible(nombre)) return false;
  if (claves.has(nombre)) return true;
  const base = nombre.split(':')[0].trim();
  return base !== nombre && claves.has(base);
}
```

`src/app/analisis/timeline.ts`:

```ts
import { Casteo, Hueco } from '../modelo/player-fight-data';
import { WclEvento } from '../wcl/wcl-tipos';
import { DEFENSIVOS, UTILIDAD, esPocionDps } from './catalogo-habilidades';

export const UMBRAL_HUECO_MS = 1500;
const MAX_CASTEO_MS = 10000;
const INTERVALO_MIN_COOLDOWN_MS = 45000;

/**
 * Convierte eventos begincast/cast en casteos con inicio y fin relativos al pull.
 * Un cast con begincast previo de la misma habilidad (≤ 10 s) empieza en el begincast;
 * así el tiempo de casteo no cuenta como hueco y no hay duplicados.
 */
export function construirCasteos(
  eventos: WclEvento[],
  inicioPelea: number,
  nombres: Map<number, string>,
): Casteo[] {
  const ordenados = [...eventos].sort((a, b) => a.timestamp - b.timestamp);
  const pendientes = new Map<number, number>();
  const casteos: Casteo[] = [];
  for (const e of ordenados) {
    if (e.type === 'begincast') {
      pendientes.set(e.abilityGameID, e.timestamp);
      continue;
    }
    if (e.type !== 'cast') continue;
    const empezo = pendientes.get(e.abilityGameID);
    pendientes.delete(e.abilityGameID);
    const inicio = empezo !== undefined && e.timestamp - empezo <= MAX_CASTEO_MS ? empezo : e.timestamp;
    casteos.push({
      inicio: inicio - inicioPelea,
      fin: e.timestamp - inicioPelea,
      guid: e.abilityGameID,
      nombre: nombres.get(e.abilityGameID) ?? `#${e.abilityGameID}`,
    });
  }
  return casteos;
}

/** Huecos > 1,5 s entre el fin de un casteo y el inicio del siguiente, incluido el tramo final hasta el fin de la pelea. */
export function detectarHuecos(casteos: Casteo[], duracionMs: number): Hueco[] {
  const huecos: Hueco[] = [];
  for (let i = 1; i < casteos.length; i++) {
    const desde = casteos[i - 1].fin;
    const hasta = casteos[i].inicio;
    if (hasta - desde > UMBRAL_HUECO_MS) {
      huecos.push({ desde, hasta, duracion: hasta - desde, tras: casteos[i - 1].nombre });
    }
  }
  const ultimo = casteos.at(-1);
  if (ultimo && duracionMs - ultimo.fin > UMBRAL_HUECO_MS) {
    huecos.push({ desde: ultimo.fin, hasta: duracionMs, duracion: duracionMs - ultimo.fin, tras: ultimo.nombre });
  }
  return huecos;
}

/**
 * Cooldown = hechizo casteado de media como mucho una vez cada 45 s que además
 * da un buff propio con el mismo nombre, excluyendo utilidad, defensivos y pociones.
 */
export function detectarCooldowns(
  casteosPorNombre: Map<string, number>,
  buffsPropios: Set<string>,
  duracionMs: number,
): string[] {
  const res: string[] = [];
  for (const [nombre, total] of casteosPorNombre) {
    if (total <= 0) continue;
    if (duracionMs / total < INTERVALO_MIN_COOLDOWN_MS) continue;
    if (!buffsPropios.has(nombre)) continue;
    if (UTILIDAD.has(nombre) || DEFENSIVOS.has(nombre) || esPocionDps(nombre)) continue;
    res.push(nombre);
  }
  return res.sort();
}
```

- [ ] **Step 7: En verde**

Run: `npx ng test --watch=false --include src/app/analisis/timeline.spec.ts`
Expected: `Tests 8 passed`

- [ ] **Step 8: Fábrica de tests y test del normalizador**

`src/testing/fabrica.ts`:

```ts
import { normalizar } from '../app/analisis/normalizar';
import { Hechizo, PlayerFightData } from '../app/modelo/player-fight-data';
import { SpecTalentos } from '../app/talentos/talentos-tipos';
import { RawJugador } from '../app/wcl/wcl-tipos';
import rawBrujo from './fixtures/jugador-DFwWK2hHpCcq4t8R-14-22.json';
import rawRokka from './fixtures/jugador-DFwWK2hHpCcq4t8R-14-17.json';
import rawDiamades from './fixtures/jugador-DkNt713VdTzjrPZA-2-85.json';
import talentos262 from './fixtures/talentos-262.json';
import talentos265 from './fixtures/talentos-265.json';

/** Fixtures reales capturados con scripts/capturar-fixture.ts (dos reportes distintos). */
export const RAW = {
  /** Chamán elemental, reporte DFwWK2hHpCcq4t8R, pelea 14, muere a las 8:14 y usa Reincarnation. */
  rokka: rawRokka as unknown as RawJugador,
  /** Chamán elemental top de otro reporte (DkNt713VdTzjrPZA), mismo boss. */
  diamades: rawDiamades as unknown as RawJugador,
  /** Brujo de aflicción, mismo reporte que Rokka; nombre con tilde. */
  brujo: rawBrujo as unknown as RawJugador,
};

export const SPECS = {
  elemental: talentos262 as unknown as SpecTalentos,
  afliccion: talentos265 as unknown as SpecTalentos,
};

export const rokka = () => normalizar(RAW.rokka, SPECS.elemental);
export const diamades = () => normalizar(RAW.diamades, SPECS.elemental);
export const brujo = () => normalizar(RAW.brujo, SPECS.afliccion);

/** Jugador vacío de 5 minutos con todos los bloques disponibles; los tests sobrescriben lo que necesitan. */
export function crearJugador(
  cambios: {
    meta?: Partial<PlayerFightData['meta']>;
    build?: Partial<PlayerFightData['build']>;
    rendimiento?: Partial<PlayerFightData['rendimiento']>;
    timeline?: Partial<PlayerFightData['timeline']>;
    auras?: PlayerFightData['auras'];
    supervivencia?: Partial<PlayerFightData['supervivencia']>;
    disponible?: Partial<PlayerFightData['disponible']>;
  } = {},
): PlayerFightData {
  return {
    meta: {
      reportCode: 'AAAAAAAAAAAAAAAA',
      fightId: 1,
      sourceId: 1,
      nombre: 'Prueba',
      clase: 'Mage',
      spec: 'Fire',
      specId: 63,
      boss: 'Boss',
      encounterId: 1,
      dificultad: 5,
      kill: true,
      duracionMs: 300000,
      ...cambios.meta,
    },
    disponible: { build: true, rendimiento: true, rotacion: true, supervivencia: true, ...cambios.disponible },
    build: {
      talentos: [],
      heroe: null,
      equipo: [],
      ilvlMedio: 0,
      stats: { principal: 0, critico: 0, celeridad: 0, maestria: 0, versatilidad: 0 },
      consumibles: { flask: null, comida: null, runa: null, pocionDps: null },
      ...cambios.build,
    },
    rendimiento: { dps: 100000, danoTotal: 30000000, hechizos: [], ...cambios.rendimiento },
    timeline: { casteos: [], huecos: [], downtimeMs: 0, downtimePct: 0, cooldowns: [], ...cambios.timeline },
    auras: cambios.auras ?? [],
    supervivencia: {
      danoRecibido: [],
      totalRecibido: 0,
      muertes: [],
      defensivos: [],
      pocionesVida: 0,
      piedrasVida: 0,
      ...cambios.supervivencia,
    },
  };
}

/** Hechizo de una pelea de 5 min con 30 M de daño total. */
export function hechizo(nombre: string, dano: number, casteos: number): Hechizo {
  return {
    guid: nombre.length,
    nombre,
    icono: null,
    dano,
    porcentaje: (dano / 30000000) * 100,
    casteos,
    cpm: casteos / 5,
    danoPorCasteo: casteos > 0 ? dano / casteos : 0,
  };
}
```

`src/app/analisis/normalizar.spec.ts`:

```ts
import { brujo, RAW, rokka, SPECS } from '../../testing/fabrica';
import { normalizar, resolverTalentos } from './normalizar';

describe('normalizar (fixture real: chamán elemental)', () => {
  const d = rokka();

  it('rellena meta a partir de la pelea y el jugador', () => {
    expect(d.meta).toMatchObject({
      reportCode: 'DFwWK2hHpCcq4t8R',
      fightId: 14,
      sourceId: 17,
      nombre: 'Rokka',
      clase: 'Shaman',
      spec: 'Elemental',
      specId: 262,
      boss: 'The Coiled Altar',
      encounterId: 3429,
      kill: true,
      duracionMs: 507735,
    });
    expect(d.disponible).toEqual({ build: true, rendimiento: true, rotacion: true, supervivencia: true });
  });

  it('calcula DPS y el desglose por hechizo', () => {
    expect(d.rendimiento.danoTotal).toBe(51709052);
    expect(d.rendimiento.dps).toBeCloseTo(101842.6, 0);
    const lvb = d.rendimiento.hechizos.find((h) => h.nombre === 'Lava Burst')!;
    expect(lvb.casteos).toBe(46);
    expect(lvb.porcentaje).toBeCloseTo(16.97, 1);
    expect(lvb.danoPorCasteo).toBeCloseTo(190725, 0);
  });

  it('resuelve talentos con nombre, héroe, equipo, stats y consumibles', () => {
    expect(d.build.talentos).toHaveLength(78);
    expect(d.build.talentos.some((t) => t.nombre.startsWith('Talento #'))).toBe(false);
    expect(d.build.heroe).toBe('Farseer');
    expect(d.build.equipo).toHaveLength(15);
    expect(d.build.ilvlMedio).toBeCloseTo(313.4, 1);
    expect(d.build.stats.principal).toBe(3275);
    expect(d.build.consumibles).toEqual({
      flask: 'Flask of the Shattered Sun',
      comida: 'Well Fed',
      runa: null,
      pocionDps: "Light's Potential",
    });
  });

  it('construye la línea de tiempo solo con casts y detecta cooldowns', () => {
    expect(d.timeline.casteos).toHaveLength(265);
    expect(d.timeline.huecos.length).toBeGreaterThan(0);
    expect(d.timeline.cooldowns).toEqual(['Ancestral Swiftness', 'Ascendance', 'Stormkeeper']);
  });

  it('calcula el uptime de los debuffs que aplica', () => {
    const fs = d.auras.find((a) => a.tipo === 'debuff' && a.nombre === 'Flame Shock')!;
    expect(fs.uptimePct).toBeCloseTo(62.3, 1);
  });

  it('recoge muertes, daño recibido y defensivos', () => {
    expect(d.supervivencia.muertes).toEqual([{ t: 494870, causa: 'Grim Guillotine' }]);
    expect(d.supervivencia.totalRecibido).toBe(35985818);
    expect(d.supervivencia.defensivos.map((x) => x.nombre)).toContain('Astral Shift');
  });
});

describe('normalizar (otra clase: brujo de aflicción)', () => {
  it('no depende de la clase', () => {
    const d = brujo();
    expect(d.meta).toMatchObject({ nombre: 'Mutgagarín', clase: 'Warlock', spec: 'Affliction', specId: 265 });
    expect(d.build.talentos.length).toBeGreaterThan(60);
    expect(d.build.heroe).toBe('Hellcaller');
    expect(d.timeline.cooldowns).toContain('Summon Darkglare');
    expect(d.auras.find((a) => a.nombre === 'Agony')!.uptimePct).toBeGreaterThan(90);
  });
});

describe('normalizar con datos parciales', () => {
  it('marca bloques no disponibles si faltan tablas', () => {
    const raw = { ...RAW.rokka, detalle: { ...RAW.rokka.detalle, danoHecho: null, combatantInfo: null } };
    const d = normalizar(raw, SPECS.elemental);
    expect(d.disponible.rendimiento).toBe(false);
    expect(d.disponible.build).toBe(false);
    expect(d.rendimiento.hechizos).toEqual([]);
    expect(d.build.talentos).toEqual([]);
  });

  it('sin catálogo de talentos usa el id como nombre', () => {
    const { talentos, heroe } = resolverTalentos([{ id: 5, rank: 1, nodeID: 9 }], null);
    expect(talentos[0].nombre).toBe('Talento #5');
    expect(heroe).toBeNull();
  });
});
```

- [ ] **Step 9: Ver que falla**

Run: `npx ng test --watch=false --include src/app/analisis/normalizar.spec.ts`
Expected: FAIL, no se resuelve `./normalizar`

- [ ] **Step 10: Implementar `src/app/analisis/normalizar.ts`**

```ts
import {
  Aura,
  Build,
  Consumibles,
  Hechizo,
  PlayerFightData,
  Rendimiento,
  Supervivencia,
  Talento,
  Timeline,
} from '../modelo/player-fight-data';
import { RbEntrada, RbNodo, SpecTalentos } from '../talentos/talentos-tipos';
import { RawJugador, WclCombatantInfo, WclDetalle } from '../wcl/wcl-tipos';
import {
  DEFENSIVOS,
  RANURAS_IGNORADAS,
  REGEX_COMIDA,
  REGEX_FLASK,
  REGEX_RUNA,
  esPocionDps,
} from './catalogo-habilidades';
import { construirCasteos, detectarCooldowns, detectarHuecos } from './timeline';

export function normalizar(raw: RawJugador, spec: SpecTalentos | null): PlayerFightData {
  const { fight, detalle } = raw;
  const duracionMs = fight.endTime - fight.startTime;
  const minutos = duracionMs / 60000;
  const ci = detalle.combatantInfo?.data[0] ?? null;
  const nombres = new Map(detalle.masterData.abilities.map((a) => [a.gameID, a.name]));
  const casteosPorNombre = new Map((detalle.casteos?.data.entries ?? []).map((e) => [e.name, e.total]));
  const buffsPropios = new Set((detalle.buffs?.data.auras ?? []).map((a) => a.name));

  const casteos = construirCasteos(raw.eventos, fight.startTime, nombres);
  const huecos = detectarHuecos(casteos, duracionMs);
  const downtimeMs = huecos.reduce((acc, h) => acc + h.duracion, 0);
  const timeline: Timeline = {
    casteos,
    huecos,
    downtimeMs,
    downtimePct: duracionMs > 0 ? (downtimeMs / duracionMs) * 100 : 0,
    cooldowns: detectarCooldowns(casteosPorNombre, buffsPropios, duracionMs),
  };

  return {
    meta: {
      reportCode: raw.reportCode,
      fightId: fight.id,
      sourceId: raw.actor.id,
      nombre: raw.actor.name,
      clase: raw.detallesJugador?.type ?? raw.actor.subType,
      spec: raw.detallesJugador?.specs[0]?.spec ?? '',
      specId: ci?.specID ?? null,
      boss: fight.name,
      encounterId: fight.encounterID,
      dificultad: fight.difficulty,
      kill: !!fight.kill,
      duracionMs,
    },
    disponible: {
      build: !!ci,
      rendimiento: !!detalle.danoHecho,
      rotacion: raw.eventos.length > 0,
      supervivencia: !!detalle.danoRecibido && !!detalle.muertes,
    },
    build: normalizarBuild(ci, spec, detalle, casteosPorNombre),
    rendimiento: normalizarRendimiento(detalle, minutos, duracionMs),
    timeline,
    auras: normalizarAuras(detalle, duracionMs),
    supervivencia: normalizarSupervivencia(raw, minutos, casteosPorNombre),
  };
}

export function resolverTalentos(
  arbol: WclCombatantInfo['talentTree'],
  spec: SpecTalentos | null,
): { talentos: Talento[]; heroe: string | null } {
  const porEntrada = new Map<number, { nodo: RbNodo; entrada: RbEntrada; arbol: Talento['arbol'] }>();
  const indexar = (nodos: RbNodo[], tipo: Talento['arbol']) => {
    for (const nodo of nodos) for (const entrada of nodo.entries) porEntrada.set(entrada.id, { nodo, entrada, arbol: tipo });
  };
  if (spec) {
    indexar(spec.classNodes, 'clase');
    indexar(spec.specNodes, 'spec');
    indexar(spec.heroNodes, 'heroe');
  }
  const subarboles = new Map<number, string>();
  for (const nodo of spec?.subTreeNodes ?? []) for (const e of nodo.entries) subarboles.set(e.id, e.name ?? nodo.name);

  let heroe: string | null = null;
  const talentos: Talento[] = [];
  for (const t of arbol) {
    const sub = subarboles.get(t.id);
    if (sub) {
      heroe = sub;
      continue;
    }
    const m = porEntrada.get(t.id);
    talentos.push({
      entryId: t.id,
      nodeId: t.nodeID,
      nombre: m ? (m.entrada.name ?? m.nodo.name) : `Talento #${t.id}`,
      rango: t.rank,
      arbol: m?.arbol ?? 'spec',
      spellId: m?.entrada.spellId ?? null,
      icono: m?.entrada.icon ?? null,
    });
  }
  return { talentos, heroe };
}

function normalizarBuild(
  ci: WclCombatantInfo | null,
  spec: SpecTalentos | null,
  detalle: WclDetalle,
  casteosPorNombre: Map<string, number>,
): Build {
  const { talentos, heroe } = ci ? resolverTalentos(ci.talentTree, spec) : { talentos: [], heroe: null };
  const equipo = (ci?.gear ?? [])
    .map((g, ranura) => ({
      ranura,
      itemId: g.id,
      ilvl: g.itemLevel,
      encantamiento: g.permanentEnchant ?? null,
      gemas: (g.gems ?? []).map((x) => x.id),
      bonusIds: g.bonusIDs ?? [],
      icono: g.icon,
    }))
    .filter((p) => p.itemId > 0 && !RANURAS_IGNORADAS.has(p.ranura));
  const ilvlMedio = equipo.length ? equipo.reduce((a, p) => a + p.ilvl, 0) / equipo.length : 0;
  const buffs = (detalle.buffs?.data.auras ?? []).map((a) => a.name);
  const buscar = (re: RegExp) => buffs.find((n) => re.test(n)) ?? null;
  const consumibles: Consumibles = {
    flask: buscar(REGEX_FLASK),
    comida: buscar(REGEX_COMIDA),
    runa: buscar(REGEX_RUNA),
    pocionDps: [...buffs, ...casteosPorNombre.keys()].find(esPocionDps) ?? null,
  };
  return {
    talentos,
    heroe,
    equipo,
    ilvlMedio,
    stats: {
      principal: ci ? Math.max(ci.strength, ci.agility, ci.intellect) : 0,
      critico: ci ? Math.max(ci.critMelee, ci.critRanged, ci.critSpell) : 0,
      celeridad: ci ? Math.max(ci.hasteMelee, ci.hasteRanged, ci.hasteSpell) : 0,
      maestria: ci?.mastery ?? 0,
      versatilidad: ci?.versatilityDamageDone ?? 0,
    },
    consumibles,
  };
}

function normalizarRendimiento(detalle: WclDetalle, minutos: number, duracionMs: number): Rendimiento {
  const entradas = detalle.danoHecho?.data.entries ?? [];
  const casteos = detalle.casteos?.data.entries ?? [];
  const casteosPorGuid = new Map(casteos.map((c) => [c.guid, c.total]));
  const casteosPorNombre = new Map(casteos.map((c) => [c.name, c.total]));
  const danoTotal = entradas.reduce((a, e) => a + e.total, 0);
  const hechizos: Hechizo[] = entradas
    .map((e) => {
      const n = e.uses ?? casteosPorGuid.get(e.guid) ?? casteosPorNombre.get(e.name) ?? 0;
      return {
        guid: e.guid,
        nombre: e.name,
        icono: e.abilityIcon ?? null,
        dano: e.total,
        porcentaje: danoTotal > 0 ? (e.total / danoTotal) * 100 : 0,
        casteos: n,
        cpm: minutos > 0 ? n / minutos : 0,
        danoPorCasteo: n > 0 ? e.total / n : 0,
      };
    })
    .sort((a, b) => b.dano - a.dano);
  return { dps: duracionMs > 0 ? danoTotal / (duracionMs / 1000) : 0, danoTotal, hechizos };
}

function normalizarAuras(detalle: WclDetalle, duracionMs: number): Aura[] {
  const pct = (uptime: number) => (duracionMs > 0 ? Math.min(100, (uptime / duracionMs) * 100) : 0);
  return [
    ...(detalle.buffs?.data.auras ?? []).map((a) => ({ guid: a.guid, nombre: a.name, tipo: 'buff' as const, uptimePct: pct(a.totalUptime) })),
    ...(detalle.debuffs?.data.auras ?? []).map((a) => ({ guid: a.guid, nombre: a.name, tipo: 'debuff' as const, uptimePct: pct(a.totalUptime) })),
  ];
}

function normalizarSupervivencia(raw: RawJugador, minutos: number, casteosPorNombre: Map<string, number>): Supervivencia {
  const entradas = raw.detalle.danoRecibido?.data.entries ?? [];
  const danoRecibido = entradas
    .map((e) => ({
      guid: e.guid,
      nombre: e.name,
      origen: e.actorName ?? '',
      total: e.total,
      porMinuto: minutos > 0 ? e.total / minutos : 0,
    }))
    .sort((a, b) => b.total - a.total);
  return {
    danoRecibido,
    totalRecibido: danoRecibido.reduce((a, d) => a + d.total, 0),
    muertes: (raw.detalle.muertes?.data.entries ?? []).map((m) => ({
      t: m.timestamp - raw.fight.startTime,
      causa: m.killingBlow?.name ?? 'Desconocido',
    })),
    defensivos: [...casteosPorNombre]
      .filter(([nombre]) => DEFENSIVOS.has(nombre))
      .map(([nombre, usos]) => ({ nombre, usos })),
    pocionesVida: raw.detallesJugador?.potionUse ?? 0,
    piedrasVida: raw.detallesJugador?.healthstoneUse ?? 0,
  };
}
```

- [ ] **Step 11: En verde**

Run: `npx ng test --watch=false --include src/app/analisis/normalizar.spec.ts`
Expected: `Tests 9 passed`

- [ ] **Step 12: Commit**

```bash
git add cutting-venas/scripts cutting-venas/src/testing cutting-venas/src/app/modelo cutting-venas/src/app/talentos/talentos-tipos.ts cutting-venas/src/app/analisis
git commit -m "feat(cutting-venas): normalización de logs reales a PlayerFightData con fixtures de dos reportes"
```

---

### Task 5: Catálogo de talentos y cargador de jugador

**Files:**
- Create: `src/app/talentos/talent-catalog.service.ts`, `src/app/carga/player-fight-loader.service.ts`
- Test: `src/app/talentos/talent-catalog.service.spec.ts`, `src/app/carga/player-fight-loader.service.spec.ts`

**Interfaces:**
- Consumes: `WclReportService` y `WclError` (T3); `normalizar` y `SpecTalentos` (T4); `RAW` y `SPECS` de la fábrica (T4).
- Produces:
  - `TalentCatalogService { spec(specId: number | null): Promise<SpecTalentos | null> }`
  - `interface SeleccionCombate { reportCode: string; fightId: number; sourceId: number }`
  - `PlayerFightLoader { cargar(sel, progreso?: (paso: string) => void): Promise<PlayerFightData> }`

- [ ] **Step 1: Tests**

`src/app/talentos/talent-catalog.service.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SPECS } from '../../testing/fabrica';
import { TalentCatalogService } from './talent-catalog.service';

describe('TalentCatalogService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }),
  );

  it('descarga el catálogo una vez y busca por specId', async () => {
    const svc = TestBed.inject(TalentCatalogService);
    const http = TestBed.inject(HttpTestingController);
    const p1 = svc.spec(262);
    const p2 = svc.spec(265);
    http.expectOne('/raidbots/static/data/live/talents.json').flush([SPECS.elemental, SPECS.afliccion]);
    expect((await p1)?.specName).toBe('Elemental');
    expect((await p2)?.specName).toBe('Affliction');
    http.verify();
  });

  it('devuelve null si la descarga falla o no hay specId', async () => {
    const svc = TestBed.inject(TalentCatalogService);
    expect(await svc.spec(null)).toBeNull();
    const p = svc.spec(262);
    TestBed.inject(HttpTestingController)
      .expectOne('/raidbots/static/data/live/talents.json')
      .flush({}, { status: 500, statusText: 'Error' });
    expect(await p).toBeNull();
  });
});
```

`src/app/carga/player-fight-loader.service.spec.ts`:

```ts
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
```

- [ ] **Step 2: Ver que fallan**

Run: `npx ng test --watch=false`
Expected: FAIL en `talent-catalog.service.spec.ts` y `player-fight-loader.service.spec.ts` (no se resuelven los servicios); el resto, en verde

- [ ] **Step 3: Implementar**

`src/app/talentos/talent-catalog.service.ts`:

```ts
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
```

`src/app/carga/player-fight-loader.service.ts`:

```ts
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
```

- [ ] **Step 4: En verde**

Run: `npx ng test --watch=false` → Expected: `Test Files 7 passed`, `Tests 45 passed`

- [ ] **Step 5: Commit**

```bash
git add cutting-venas/src/app/talentos cutting-venas/src/app/carga
git commit -m "feat(cutting-venas): catálogo de talentos de Raidbots y cargador de jugador con progreso"
```

---

### Task 6: Motor de comparación (filas, reglas y veredicto)

**Files:**
- Create: `src/app/analisis/comparison.ts`, `src/app/analisis/filas.ts`, `src/app/analisis/reglas/impacto.ts`, `src/app/analisis/reglas/reglas-rendimiento.ts`, `src/app/analisis/reglas/reglas-rotacion.ts`, `src/app/analisis/reglas/reglas-build.ts`, `src/app/analisis/reglas/reglas-supervivencia.ts`, `src/app/analisis/motor.ts`
- Test: `src/app/analisis/reglas/reglas-*.spec.ts` (4), `src/app/analisis/motor.spec.ts`

**Interfaces:**
- Consumes: `PlayerFightData` y los tipos del modelo, `esBuffRelevante`, `NOMBRES_RANURA` (T4); `num`, `reloj`, `pctSigno` y `lista` (T2); la fábrica (T4).
- Produces:
  - **Veredicto**:
    - `Hallazgo { id; bloque: Bloque; severidad: 'alta'|'media'|'baja'; texto; impacto: number; refFila?: string }`
    - `Regla = (mio, suyo) => Hallazgo[]`
  - **Comparación**: `Comparison { mio; suyo; avisos: string[]; hallazgos; hechizos: FilaHechizo[]; talentos: DiffTalentos; equipo: FilaEquipo[]; stats: FilaStat[]; consumibles: FilaConsumible[]; cooldowns: FilaCooldown[]; auras: FilaAura[]; danoRecibido: FilaDanoRecibido[] }`
  - **Entrada del motor**: `comparar(mio, suyo): Comparison`, con `REGLAS: Record<Bloque, Regla[]>`.
  - **Contrato de `refFila`**: cada fila tiene un `ref` con el que la UI resalta el hallazgo correspondiente.

    | Bloque | Formato del `ref` |
    |---|---|
    | Rendimiento | `hechizo:<nombre>` |
    | Rotación | `cd:<nombre>`, `aura:<tipo>:<nombre>`, `downtime` |
    | Build | `talentos`, `equipo`, `ranura:<n>`, `consumible:<tipo>` |
    | Supervivencia | `muertes`, `dano:<nombre>` |

Criterios que fija el spec y que siguen las reglas:
- **Todas las reglas genéricas**: CPM, reparto de daño, hechizo ausente, usos de cooldowns, retraso del primer cooldown, downtime, uptime, talentos, equipo, consumibles y supervivencia.
- **Impacto** en unidades de "DPS estimado" y **severidad** según impacto / tu DPS: alta ≥ 5 %, media ≥ 2 %.
- **Muertes**: siempre severidad alta.
- **Refinamientos sobre el spec**, validados con los logs reales:
  - **Uptime** solo cuenta los debuffs que aplica el jugador y los buffs ligados a un hechizo casteado o a un talento de alguno de los dos. Así se evita el ruido de procs de abalorios, buffs de banda y mecánicas del boss.
  - **Consumibles** no pasan por la regla de uptime; ya los cubre su propia regla.
  - **Usos de cooldowns** se comparan por minuto cuando las duraciones de las peleas difieren en más de un 10 %.

- [ ] **Step 1: Tipos de la comparación (sin lógica)**

`src/app/analisis/comparison.ts`:

```ts
import { Bloque, Consumibles, Hechizo, Pieza, PlayerFightData, Talento } from '../modelo/player-fight-data';

export type Severidad = 'alta' | 'media' | 'baja';

export interface Hallazgo {
  id: string;
  bloque: Bloque;
  severidad: Severidad;
  texto: string;
  impacto: number;
  refFila?: string;
}

export type Regla = (mio: PlayerFightData, suyo: PlayerFightData) => Hallazgo[];

export interface FilaHechizo {
  ref: string;
  nombre: string;
  icono: string | null;
  mio: Hechizo | null;
  suyo: Hechizo | null;
  difCpmPct: number | null;
  difPorcentaje: number;
}

export interface DiffTalentos {
  soloMios: Talento[];
  soloSuyos: Talento[];
  comunes: Talento[];
  heroeMio: string | null;
  heroeSuyo: string | null;
}

export interface FilaEquipo {
  ref: string;
  ranura: number;
  nombreRanura: string;
  mio: Pieza | null;
  suyo: Pieza | null;
  difIlvl: number;
  faltaEncantamiento: boolean;
  faltanGemas: number;
}

export interface FilaStat {
  nombre: string;
  mio: number;
  suyo: number;
  dif: number;
}

export interface FilaConsumible {
  ref: string;
  tipo: keyof Consumibles;
  etiqueta: string;
  mio: string | null;
  suyo: string | null;
}

export interface FilaCooldown {
  ref: string;
  nombre: string;
  mio: number[];
  suyo: number[];
}

export interface FilaAura {
  ref: string;
  nombre: string;
  tipo: 'buff' | 'debuff';
  mio: number | null;
  suyo: number | null;
  dif: number;
}

export interface FilaDanoRecibido {
  ref: string;
  nombre: string;
  origen: string;
  mioPorMinuto: number;
  suyoPorMinuto: number;
  ratio: number | null;
}

export interface Comparison {
  mio: PlayerFightData;
  suyo: PlayerFightData;
  avisos: string[];
  hallazgos: Hallazgo[];
  hechizos: FilaHechizo[];
  talentos: DiffTalentos;
  equipo: FilaEquipo[];
  stats: FilaStat[];
  consumibles: FilaConsumible[];
  cooldowns: FilaCooldown[];
  auras: FilaAura[];
  danoRecibido: FilaDanoRecibido[];
}
```

- [ ] **Step 2: Tests de las reglas**

`src/app/analisis/reglas/reglas-rendimiento.spec.ts`:

```ts
import { crearJugador, hechizo } from '../../../testing/fabrica';
import { reglaCpm, reglaHechizoAusente, reglaReparto } from './reglas-rendimiento';

const con = (...hechizos: ReturnType<typeof hechizo>[]) => crearJugador({ rendimiento: { hechizos } });

describe('reglaCpm', () => {
  it('salta si el CPM difiere ≥ 15 % en un hechizo con ≥ 3 % del daño', () => {
    const [h] = reglaCpm(con(hechizo('Fireball', 6000000, 40)), con(hechizo('Fireball', 6000000, 50)));
    expect(h.texto).toBe('Fireball: 8,0/min frente a 10,0/min (−20 %)');
    expect(h.bloque).toBe('rendimiento');
    expect(h.refFila).toBe('hechizo:Fireball');
    // |8 - 10| CPM × 120.000 de daño por casteo / 60
    expect(h.impacto).toBeCloseTo(4000, 0);
  });

  it('no salta por debajo del 15 %', () => {
    expect(reglaCpm(con(hechizo('Fireball', 6000000, 45)), con(hechizo('Fireball', 6000000, 50)))).toEqual([]);
  });

  it('ignora hechizos con < 3 % del daño en ambos', () => {
    expect(reglaCpm(con(hechizo('Scorch', 300000, 5)), con(hechizo('Scorch', 300000, 20)))).toEqual([]);
  });
});

describe('reglaReparto', () => {
  it('salta si el % de daño difiere ≥ 5 puntos', () => {
    const [h] = reglaReparto(con(hechizo('Pyroblast', 3000000, 10)), con(hechizo('Pyroblast', 6000000, 10)));
    expect(h.texto).toBe('Pyroblast es el 20,0 % de su daño y el 10,0 % del tuyo');
  });

  it('no salta con 4 puntos', () => {
    expect(reglaReparto(con(hechizo('Pyroblast', 3000000, 10)), con(hechizo('Pyroblast', 4200000, 10)))).toEqual([]);
  });
});

describe('reglaHechizoAusente', () => {
  it('salta si él usa un hechizo con ≥ 1 % del daño y tú no', () => {
    const [h] = reglaHechizoAusente(con(), con(hechizo('Meteor', 900000, 3)));
    expect(h.texto).toBe('No usas Meteor (3,0 % de su daño)');
  });

  it('no salta por debajo del 1 %', () => {
    expect(reglaHechizoAusente(con(), con(hechizo('Meteor', 150000, 1)))).toEqual([]);
  });
});
```

`src/app/analisis/reglas/reglas-rotacion.spec.ts`:

```ts
import { crearJugador } from '../../../testing/fabrica';
import { Casteo } from '../../modelo/player-fight-data';
import { reglaDowntime, reglaPrimerCooldown, reglaUptime, reglaUsosCooldown } from './reglas-rotacion';

const usos = (nombre: string, ...tiempos: number[]): Casteo[] =>
  tiempos.map((t) => ({ inicio: t, fin: t, guid: 1, nombre }));
const conCd = (casteos: Casteo[], duracionMs = 300000) =>
  crearJugador({ meta: { duracionMs }, timeline: { casteos, cooldowns: ['Combustion'] } });

describe('reglaUsosCooldown', () => {
  it('cuenta usos de menos con la misma duración', () => {
    const [h] = reglaUsosCooldown(conCd(usos('Combustion', 0)), conCd(usos('Combustion', 0, 120000, 240000)));
    expect(h.texto).toBe('Combustion: 1 usos frente a 3');
    expect(h.impacto).toBeCloseTo(100000 * 0.05 * 2, 0);
    expect(h.refFila).toBe('cd:Combustion');
  });

  it('dice "No usas" si no lo usas nunca', () => {
    const [h] = reglaUsosCooldown(conCd([]), conCd(usos('Combustion', 0, 120000)));
    expect(h.texto).toBe('No usas Combustion (él: 2 usos)');
  });

  it('con duraciones distintas compara usos por minuto', () => {
    const [h] = reglaUsosCooldown(conCd(usos('Combustion', 0, 120000), 600000), conCd(usos('Combustion', 0, 120000), 300000));
    expect(h.texto).toBe('Combustion: 0,20 usos/min frente a 0,40/min (2 en 10:00 frente a 2 en 5:00)');
  });

  it('no salta si usas los mismos', () => {
    expect(reglaUsosCooldown(conCd(usos('Combustion', 0, 120000)), conCd(usos('Combustion', 0, 120000)))).toEqual([]);
  });
});

describe('reglaPrimerCooldown', () => {
  it('salta si tu primer uso llega ≥ 5 s tarde', () => {
    const [h] = reglaPrimerCooldown(conCd(usos('Combustion', 42000)), conCd(usos('Combustion', 0)));
    expect(h.texto).toBe('Primer Combustion a los 0:42; el suyo, a los 0:00');
  });

  it('no salta con 4 s de retraso', () => {
    expect(reglaPrimerCooldown(conCd(usos('Combustion', 4000)), conCd(usos('Combustion', 0)))).toEqual([]);
  });
});

describe('reglaDowntime', () => {
  const dt = (downtimeMs: number, downtimePct: number) => crearJugador({ timeline: { downtimeMs, downtimePct } });

  it('salta si tu downtime es ≥ 3 puntos mayor', () => {
    const [h] = reglaDowntime(dt(14000, 4.7), dt(3000, 1));
    expect(h.texto).toBe('Downtime: 14 s (4,7 %) frente a 3 s (1,0 %)');
    expect(h.impacto).toBeCloseTo(3700, 0);
  });

  it('no salta si el tuyo es menor', () => {
    expect(reglaDowntime(dt(3000, 1), dt(14000, 4.7))).toEqual([]);
  });
});

describe('reglaUptime', () => {
  const conAuras = (uptime: number, nombre = 'Living Bomb', tipo: 'buff' | 'debuff' = 'debuff') =>
    crearJugador({
      auras: [{ guid: 1, nombre, tipo, uptimePct: uptime }],
      timeline: { casteos: usos('Combustion', 0) },
    });

  it('salta con un debuff tuyo ≥ 10 puntos por debajo', () => {
    const [h] = reglaUptime(conAuras(62), conAuras(97));
    expect(h.texto).toBe('Living Bomb: 62 % de uptime frente a 97 %');
  });

  it('cuenta buffs ligados a un hechizo casteado ("Combustion: X")', () => {
    expect(reglaUptime(conAuras(20, 'Combustion: Haste', 'buff'), conAuras(50, 'Combustion: Haste', 'buff'))).toHaveLength(1);
  });

  it('ignora buffs ajenos (procs, banda) y consumibles', () => {
    expect(reglaUptime(conAuras(0, 'Soul Fang Alacrity', 'buff'), conAuras(54, 'Soul Fang Alacrity', 'buff'))).toEqual([]);
    expect(reglaUptime(conAuras(0, 'Flask of the Magisters', 'buff'), conAuras(100, 'Flask of the Magisters', 'buff'))).toEqual([]);
  });
});
```

`src/app/analisis/reglas/reglas-build.spec.ts`:

```ts
import { crearJugador } from '../../../testing/fabrica';
import { Pieza, Talento } from '../../modelo/player-fight-data';
import { reglaConsumibles, reglaEquipo, reglaTalentos } from './reglas-build';

const talento = (entryId: number, nombre: string): Talento => ({
  entryId,
  nodeId: entryId,
  nombre,
  rango: 1,
  arbol: 'spec',
  spellId: null,
  icono: null,
});
const pieza = (ranura: number, ilvl: number, encantamiento: number | null = null, gemas: number[] = []): Pieza => ({
  ranura,
  itemId: 1000 + ranura,
  ilvl,
  encantamiento,
  gemas,
  bonusIds: [],
  icono: 'x.jpg',
});

describe('reglaTalentos', () => {
  it('agrupa los talentos distintos en un solo hallazgo', () => {
    const mio = crearJugador({ build: { talentos: [talento(1, 'A'), talento(2, 'B')] } });
    const suyo = crearJugador({ build: { talentos: [talento(1, 'A'), talento(3, 'C')] } });
    const [h] = reglaTalentos(mio, suyo);
    expect(h.texto).toBe('Talentos distintos: él lleva C; tú llevas B');
    expect(h.refFila).toBe('talentos');
  });

  it('avisa si el héroe es distinto', () => {
    const r = reglaTalentos(crearJugador({ build: { heroe: 'Farseer' } }), crearJugador({ build: { heroe: 'Stormbringer' } }));
    expect(r.map((h) => h.texto)).toEqual(['Héroe distinto: tú Farseer, él Stormbringer']);
  });

  it('no salta con los mismos talentos', () => {
    const b = { build: { talentos: [talento(1, 'A')] } };
    expect(reglaTalentos(crearJugador(b), crearJugador(b))).toEqual([]);
  });
});

describe('reglaEquipo', () => {
  it('detecta ilvl ≥ 3 por debajo, encantamientos y gemas que faltan', () => {
    const mio = crearJugador({ build: { ilvlMedio: 310, equipo: [pieza(10, 310, null, [])] } });
    const suyo = crearJugador({ build: { ilvlMedio: 320, equipo: [pieza(10, 320, 7995, [1, 2])] } });
    expect(reglaEquipo(mio, suyo).map((h) => h.texto)).toEqual([
      'Tu ilvl medio es 310,0 frente a 320,0',
      'Te falta el encantamiento de anillo 1',
      'Te faltan 2 gemas en anillo 1',
    ]);
  });

  it('no salta con el mismo equipo', () => {
    const b = { build: { ilvlMedio: 320, equipo: [pieza(10, 320, 7995, [1])] } };
    expect(reglaEquipo(crearJugador(b), crearJugador(b))).toEqual([]);
  });
});

describe('reglaConsumibles', () => {
  it('salta por cada consumible que él usa y tú no', () => {
    const mio = crearJugador({ build: { consumibles: { flask: 'Flask A', comida: null, runa: null, pocionDps: null } } });
    const suyo = crearJugador({ build: { consumibles: { flask: 'Flask B', comida: 'Well Fed', runa: null, pocionDps: 'Tempered Potion' } } });
    expect(reglaConsumibles(mio, suyo).map((h) => h.texto)).toEqual([
      'No usaste comida (él: Well Fed)',
      'No usaste poción de dps (él: Tempered Potion)',
    ]);
  });
});
```

`src/app/analisis/reglas/reglas-supervivencia.spec.ts`:

```ts
import { crearJugador } from '../../../testing/fabrica';
import { reglaDanoRecibido, reglaMuertes } from './reglas-supervivencia';

const recibe = (nombre: string, total: number) =>
  crearJugador({
    supervivencia: { danoRecibido: [{ guid: 1, nombre, origen: 'Boss', total, porMinuto: total / 5 }], totalRecibido: total },
  });

describe('reglaMuertes', () => {
  it('salta con severidad alta si mueres más que él', () => {
    const mio = crearJugador({ supervivencia: { muertes: [{ t: 494870, causa: 'Grim Guillotine' }] } });
    const [h] = reglaMuertes(mio, crearJugador());
    expect(h.texto).toBe('Mueres 1 vez (8:14 por Grim Guillotine) y él no muere');
    expect(h.severidad).toBe('alta');
  });

  it('no salta si mueres lo mismo', () => {
    const m = { supervivencia: { muertes: [{ t: 1000, causa: 'X' }] } };
    expect(reglaMuertes(crearJugador(m), crearJugador(m))).toEqual([]);
  });
});

describe('reglaDanoRecibido', () => {
  it('salta si recibes ≥ 1,5× más daño por minuto de una habilidad', () => {
    const [h] = reglaDanoRecibido(recibe('Volatile Venom', 2000000), recibe('Volatile Venom', 1000000));
    expect(h.texto).toBe('Recibes 2,0× más daño de Volatile Venom');
  });

  it('dice "y él no" si él no la recibe', () => {
    const [h] = reglaDanoRecibido(recibe('Gravebound', 1000000), crearJugador());
    expect(h.texto).toBe('Recibes daño de Gravebound y él no');
  });

  it('no salta por debajo de 1,5×', () => {
    expect(reglaDanoRecibido(recibe('Venomfang', 1400000), recibe('Venomfang', 1000000))).toEqual([]);
  });
});
```

- [ ] **Step 3: Ver que fallan**

Run: `npx ng test --watch=false --include "src/app/analisis/reglas/*.spec.ts"`
Expected: FAIL, no se resuelven los módulos de reglas

- [ ] **Step 4: Impacto y filas**

`src/app/analisis/reglas/impacto.ts`:

```ts
import { Bloque, PlayerFightData } from '../../modelo/player-fight-data';
import { Hallazgo, Severidad } from '../comparison';

/** Pesos fijos, expresados como fracción de tu DPS. */
export const PESOS = {
  muerte: 1,
  usoCooldown: 0.05,
  retrasoCooldown: 0.02,
  uptime: 0.1,
  consumible: 0.03,
  encantamiento: 0.01,
  gema: 0.01,
  ilvlPorPunto: 0.005,
  talento: 0.005,
  heroe: 0.02,
  danoRecibido: 0.02,
  reparto: 0.5,
} as const;

export function dpsBase(d: PlayerFightData): number {
  return d.rendimiento.dps > 0 ? d.rendimiento.dps : 1;
}

export function severidadDe(impacto: number, miDps: number): Severidad {
  const r = impacto / miDps;
  if (r >= 0.05) return 'alta';
  if (r >= 0.02) return 'media';
  return 'baja';
}

export function hallazgo(
  mio: PlayerFightData,
  bloque: Bloque,
  id: string,
  texto: string,
  impacto: number,
  refFila?: string,
  severidad?: Severidad,
): Hallazgo {
  return { id, bloque, texto, impacto, refFila, severidad: severidad ?? severidadDe(impacto, dpsBase(mio)) };
}
```

`src/app/analisis/filas.ts`:

```ts
// Construcción de las filas "tú | él | diferencia" que usan tanto las reglas como la UI.
import { PlayerFightData } from '../modelo/player-fight-data';
import { NOMBRES_RANURA } from './catalogo-habilidades';
import {
  DiffTalentos,
  FilaAura,
  FilaConsumible,
  FilaCooldown,
  FilaDanoRecibido,
  FilaEquipo,
  FilaHechizo,
  FilaStat,
} from './comparison';

function unirPorClave<T>(a: T[], b: T[], clave: (x: T) => string): [string, T | null, T | null][] {
  const ma = new Map(a.map((x) => [clave(x), x]));
  const mb = new Map(b.map((x) => [clave(x), x]));
  const claves = [...new Set([...ma.keys(), ...mb.keys()])];
  return claves.map((k) => [k, ma.get(k) ?? null, mb.get(k) ?? null]);
}

export function filasHechizos(mio: PlayerFightData, suyo: PlayerFightData): FilaHechizo[] {
  return unirPorClave(mio.rendimiento.hechizos, suyo.rendimiento.hechizos, (h) => h.nombre)
    .map(([nombre, m, s]) => ({
      ref: `hechizo:${nombre}`,
      nombre,
      icono: m?.icono ?? s?.icono ?? null,
      mio: m,
      suyo: s,
      difCpmPct: m && s && s.cpm > 0 && m.cpm > 0 ? ((m.cpm - s.cpm) / s.cpm) * 100 : null,
      difPorcentaje: (m?.porcentaje ?? 0) - (s?.porcentaje ?? 0),
    }))
    .sort((a, b) => Math.abs(b.difPorcentaje) - Math.abs(a.difPorcentaje));
}

export function diffTalentos(mio: PlayerFightData, suyo: PlayerFightData): DiffTalentos {
  const clave = (t: { entryId: number; rango: number }) => `${t.entryId}:${t.rango}`;
  const suyos = new Set(suyo.build.talentos.map(clave));
  const mios = new Set(mio.build.talentos.map(clave));
  return {
    soloMios: mio.build.talentos.filter((t) => !suyos.has(clave(t))),
    soloSuyos: suyo.build.talentos.filter((t) => !mios.has(clave(t))),
    comunes: mio.build.talentos.filter((t) => suyos.has(clave(t))),
    heroeMio: mio.build.heroe,
    heroeSuyo: suyo.build.heroe,
  };
}

export function filasEquipo(mio: PlayerFightData, suyo: PlayerFightData): FilaEquipo[] {
  return unirPorClave(mio.build.equipo, suyo.build.equipo, (p) => String(p.ranura))
    .map(([k, m, s]) => {
      const ranura = Number(k);
      return {
        ref: `ranura:${ranura}`,
        ranura,
        nombreRanura: NOMBRES_RANURA[ranura] ?? `Ranura ${ranura}`,
        mio: m,
        suyo: s,
        difIlvl: (m?.ilvl ?? 0) - (s?.ilvl ?? 0),
        faltaEncantamiento: !!s?.encantamiento && !m?.encantamiento,
        faltanGemas: Math.max(0, (s?.gemas.length ?? 0) - (m?.gemas.length ?? 0)),
      };
    })
    .sort((a, b) => a.ranura - b.ranura);
}

export function filasStats(mio: PlayerFightData, suyo: PlayerFightData): FilaStat[] {
  const nombres: [keyof PlayerFightData['build']['stats'], string][] = [
    ['principal', 'Atributo principal'],
    ['critico', 'Crítico'],
    ['celeridad', 'Celeridad'],
    ['maestria', 'Maestría'],
    ['versatilidad', 'Versatilidad'],
  ];
  return nombres.map(([k, nombre]) => ({
    nombre,
    mio: mio.build.stats[k],
    suyo: suyo.build.stats[k],
    dif: mio.build.stats[k] - suyo.build.stats[k],
  }));
}

export const ETIQUETAS_CONSUMIBLE: Record<FilaConsumible['tipo'], string> = {
  flask: 'Flask',
  comida: 'Comida',
  runa: 'Runa de aumento',
  pocionDps: 'Poción de DPS',
};

export function filasConsumibles(mio: PlayerFightData, suyo: PlayerFightData): FilaConsumible[] {
  return (Object.keys(ETIQUETAS_CONSUMIBLE) as FilaConsumible['tipo'][]).map((tipo) => ({
    ref: `consumible:${tipo}`,
    tipo,
    etiqueta: ETIQUETAS_CONSUMIBLE[tipo],
    mio: mio.build.consumibles[tipo],
    suyo: suyo.build.consumibles[tipo],
  }));
}

export function filasCooldowns(mio: PlayerFightData, suyo: PlayerFightData): FilaCooldown[] {
  const nombres = [...new Set([...mio.timeline.cooldowns, ...suyo.timeline.cooldowns])].sort();
  const usos = (d: PlayerFightData, nombre: string) =>
    d.timeline.casteos.filter((c) => c.nombre === nombre).map((c) => c.fin);
  return nombres.map((nombre) => ({ ref: `cd:${nombre}`, nombre, mio: usos(mio, nombre), suyo: usos(suyo, nombre) }));
}

export function filasAuras(mio: PlayerFightData, suyo: PlayerFightData): FilaAura[] {
  return unirPorClave(mio.auras, suyo.auras, (a) => `${a.tipo}:${a.nombre}`)
    .map(([k, m, s]) => ({
      ref: `aura:${k}`,
      nombre: (m ?? s)!.nombre,
      tipo: (m ?? s)!.tipo,
      mio: m?.uptimePct ?? null,
      suyo: s?.uptimePct ?? null,
      dif: (m?.uptimePct ?? 0) - (s?.uptimePct ?? 0),
    }))
    .sort((a, b) => a.dif - b.dif);
}

export function filasDanoRecibido(mio: PlayerFightData, suyo: PlayerFightData): FilaDanoRecibido[] {
  return unirPorClave(mio.supervivencia.danoRecibido, suyo.supervivencia.danoRecibido, (d) => d.nombre)
    .map(([nombre, m, s]) => {
      const mioPorMinuto = m?.porMinuto ?? 0;
      const suyoPorMinuto = s?.porMinuto ?? 0;
      return {
        ref: `dano:${nombre}`,
        nombre,
        origen: m?.origen || s?.origen || '',
        mioPorMinuto,
        suyoPorMinuto,
        ratio: suyoPorMinuto > 0 ? mioPorMinuto / suyoPorMinuto : null,
      };
    })
    .sort((a, b) => b.mioPorMinuto - b.suyoPorMinuto - (a.mioPorMinuto - a.suyoPorMinuto));
}
```

- [ ] **Step 5: Reglas**

`src/app/analisis/reglas/reglas-rendimiento.ts`:

```ts
import { num, pctSigno } from '../../util/formato';
import { Regla } from '../comparison';
import { filasHechizos } from '../filas';
import { PESOS, dpsBase, hallazgo } from './impacto';

export const reglaCpm: Regla = (mio, suyo) =>
  filasHechizos(mio, suyo)
    .filter((f) => f.mio && f.suyo && f.difCpmPct !== null)
    .filter((f) => Math.max(f.mio!.porcentaje, f.suyo!.porcentaje) >= 3 && Math.abs(f.difCpmPct!) >= 15)
    .map((f) => {
      const m = f.mio!;
      const s = f.suyo!;
      const porCasteo = s.danoPorCasteo || m.danoPorCasteo;
      return hallazgo(
        mio,
        'rendimiento',
        `cpm:${f.nombre}`,
        `${f.nombre}: ${num(m.cpm, 1)}/min frente a ${num(s.cpm, 1)}/min (${pctSigno(f.difCpmPct!)})`,
        (Math.abs(m.cpm - s.cpm) * porCasteo) / 60,
        f.ref,
      );
    });

export const reglaReparto: Regla = (mio, suyo) =>
  filasHechizos(mio, suyo)
    .filter((f) => f.mio && f.suyo && Math.abs(f.difPorcentaje) >= 5)
    .map((f) =>
      hallazgo(
        mio,
        'rendimiento',
        `reparto:${f.nombre}`,
        `${f.nombre} es el ${num(f.suyo!.porcentaje, 1)} % de su daño y el ${num(f.mio!.porcentaje, 1)} % del tuyo`,
        (Math.abs(f.difPorcentaje) / 100) * dpsBase(mio) * PESOS.reparto,
        f.ref,
      ),
    );

export const reglaHechizoAusente: Regla = (mio, suyo) =>
  filasHechizos(mio, suyo)
    .filter((f) => f.suyo && f.suyo.porcentaje >= 1 && (!f.mio || f.mio.dano === 0))
    .map((f) =>
      hallazgo(
        mio,
        'rendimiento',
        `ausente:${f.nombre}`,
        `No usas ${f.nombre} (${num(f.suyo!.porcentaje, 1)} % de su daño)`,
        (f.suyo!.porcentaje / 100) * suyo.rendimiento.dps,
        f.ref,
      ),
    );

export const REGLAS_RENDIMIENTO: Regla[] = [reglaCpm, reglaReparto, reglaHechizoAusente];
```

`src/app/analisis/reglas/reglas-rotacion.ts`:

```ts
import { num, reloj } from '../../util/formato';
import { PlayerFightData } from '../../modelo/player-fight-data';
import { esBuffRelevante } from '../catalogo-habilidades';
import { Hallazgo, Regla } from '../comparison';
import { filasAuras, filasCooldowns } from '../filas';
import { PESOS, dpsBase, hallazgo } from './impacto';

export const reglaUsosCooldown: Regla = (mio, suyo) => {
  const minM = mio.meta.duracionMs / 60000;
  const minS = suyo.meta.duracionMs / 60000;
  const mismaDuracion = Math.abs(minM - minS) / Math.max(minM, minS) <= 0.1;
  const res: Hallazgo[] = [];
  for (const f of filasCooldowns(mio, suyo)) {
    const faltan = Math.round((f.suyo.length / minS) * minM - f.mio.length);
    if (faltan < 1) continue;
    let texto: string;
    if (f.mio.length === 0) texto = `No usas ${f.nombre} (él: ${f.suyo.length} usos)`;
    else if (mismaDuracion) texto = `${f.nombre}: ${f.mio.length} usos frente a ${f.suyo.length}`;
    else
      texto =
        `${f.nombre}: ${num(f.mio.length / minM, 2)} usos/min frente a ${num(f.suyo.length / minS, 2)}/min ` +
        `(${f.mio.length} en ${reloj(mio.meta.duracionMs)} frente a ${f.suyo.length} en ${reloj(suyo.meta.duracionMs)})`;
    res.push(hallazgo(mio, 'rotacion', `cd-usos:${f.nombre}`, texto, dpsBase(mio) * PESOS.usoCooldown * faltan, f.ref));
  }
  return res;
};

export const reglaPrimerCooldown: Regla = (mio, suyo) =>
  filasCooldowns(mio, suyo)
    .filter((f) => f.mio.length > 0 && f.suyo.length > 0 && f.mio[0] - f.suyo[0] >= 5000)
    .map((f) => {
      const retraso = f.mio[0] - f.suyo[0];
      return hallazgo(
        mio,
        'rotacion',
        `cd-primero:${f.nombre}`,
        `Primer ${f.nombre} a los ${reloj(f.mio[0])}; el suyo, a los ${reloj(f.suyo[0])}`,
        dpsBase(mio) * PESOS.retrasoCooldown * Math.min(retraso / 10000, 3),
        f.ref,
      );
    });

export const reglaDowntime: Regla = (mio, suyo) => {
  const dif = mio.timeline.downtimePct - suyo.timeline.downtimePct;
  if (dif < 3) return [];
  const seg = (ms: number) => num(ms / 1000, 0);
  return [
    hallazgo(
      mio,
      'rotacion',
      'downtime',
      `Downtime: ${seg(mio.timeline.downtimeMs)} s (${num(mio.timeline.downtimePct, 1)} %) frente a ${seg(suyo.timeline.downtimeMs)} s (${num(suyo.timeline.downtimePct, 1)} %)`,
      (dif / 100) * dpsBase(mio),
      'downtime',
    ),
  ];
};

/** Nombres de hechizos casteados y talentos de ambos jugadores: los buffs ligados a ellos son los que importan. */
function clavesBuff(mio: PlayerFightData, suyo: PlayerFightData): Set<string> {
  const claves = new Set<string>();
  for (const d of [mio, suyo]) {
    for (const c of d.timeline.casteos) claves.add(c.nombre);
    for (const t of d.build.talentos) claves.add(t.nombre);
  }
  return claves;
}

export const reglaUptime: Regla = (mio, suyo) =>
  filasAuras(mio, suyo)
    .filter((f) => f.suyo !== null && f.suyo - (f.mio ?? 0) >= 10)
    .filter((f) => f.tipo === 'debuff' || esBuffRelevante(f.nombre, clavesBuff(mio, suyo)))
    .map((f) =>
      hallazgo(
        mio,
        'rotacion',
        `uptime:${f.tipo}:${f.nombre}`,
        `${f.nombre}: ${num(f.mio ?? 0, 0)} % de uptime frente a ${num(f.suyo!, 0)} %`,
        dpsBase(mio) * PESOS.uptime * ((f.suyo! - (f.mio ?? 0)) / 100),
        f.ref,
      ),
    );

export const REGLAS_ROTACION: Regla[] = [reglaUsosCooldown, reglaPrimerCooldown, reglaDowntime, reglaUptime];
```

`src/app/analisis/reglas/reglas-build.ts`:

```ts
import { lista, num } from '../../util/formato';
import { Hallazgo, Regla } from '../comparison';
import { diffTalentos, filasConsumibles, filasEquipo } from '../filas';
import { PESOS, dpsBase, hallazgo } from './impacto';

export const reglaTalentos: Regla = (mio, suyo) => {
  const d = diffTalentos(mio, suyo);
  const res: Hallazgo[] = [];
  if (d.heroeMio && d.heroeSuyo && d.heroeMio !== d.heroeSuyo) {
    res.push(
      hallazgo(mio, 'build', 'heroe', `Héroe distinto: tú ${d.heroeMio}, él ${d.heroeSuyo}`, dpsBase(mio) * PESOS.heroe, 'talentos'),
    );
  }
  const n = d.soloMios.length + d.soloSuyos.length;
  if (n > 0) {
    const partes: string[] = [];
    if (d.soloSuyos.length) partes.push(`él lleva ${lista(d.soloSuyos.map((t) => t.nombre))}`);
    if (d.soloMios.length) partes.push(`tú llevas ${lista(d.soloMios.map((t) => t.nombre))}`);
    res.push(
      hallazgo(mio, 'build', 'talentos', `Talentos distintos: ${partes.join('; ')}`, dpsBase(mio) * PESOS.talento * n, 'talentos'),
    );
  }
  return res;
};

export const reglaEquipo: Regla = (mio, suyo) => {
  const res: Hallazgo[] = [];
  const difIlvl = suyo.build.ilvlMedio - mio.build.ilvlMedio;
  if (difIlvl >= 3) {
    res.push(
      hallazgo(
        mio,
        'build',
        'ilvl',
        `Tu ilvl medio es ${num(mio.build.ilvlMedio, 1)} frente a ${num(suyo.build.ilvlMedio, 1)}`,
        dpsBase(mio) * PESOS.ilvlPorPunto * difIlvl,
        'equipo',
      ),
    );
  }
  for (const f of filasEquipo(mio, suyo)) {
    if (f.faltaEncantamiento) {
      res.push(
        hallazgo(mio, 'build', `encantamiento:${f.ranura}`, `Te falta el encantamiento de ${f.nombreRanura.toLowerCase()}`, dpsBase(mio) * PESOS.encantamiento, f.ref),
      );
    }
    if (f.faltanGemas > 0) {
      res.push(
        hallazgo(
          mio,
          'build',
          `gemas:${f.ranura}`,
          `Te ${f.faltanGemas === 1 ? 'falta 1 gema' : `faltan ${f.faltanGemas} gemas`} en ${f.nombreRanura.toLowerCase()}`,
          dpsBase(mio) * PESOS.gema * f.faltanGemas,
          f.ref,
        ),
      );
    }
  }
  return res;
};

export const reglaConsumibles: Regla = (mio, suyo) =>
  filasConsumibles(mio, suyo)
    .filter((f) => f.suyo && !f.mio)
    .map((f) =>
      hallazgo(mio, 'build', `consumible:${f.tipo}`, `No usaste ${f.etiqueta.toLowerCase()} (él: ${f.suyo})`, dpsBase(mio) * PESOS.consumible, f.ref),
    );

export const REGLAS_BUILD: Regla[] = [reglaTalentos, reglaEquipo, reglaConsumibles];
```

`src/app/analisis/reglas/reglas-supervivencia.ts`:

```ts
import { num, reloj } from '../../util/formato';
import { Hallazgo, Regla } from '../comparison';
import { filasDanoRecibido } from '../filas';
import { PESOS, dpsBase, hallazgo } from './impacto';

export const reglaMuertes: Regla = (mio, suyo) => {
  const m = mio.supervivencia.muertes;
  const s = suyo.supervivencia.muertes;
  if (m.length <= s.length) return [];
  const detalle = m.map((x) => `${reloj(x.t)} por ${x.causa}`).join(', ');
  const texto = `Mueres ${m.length === 1 ? '1 vez' : `${m.length} veces`} (${detalle}) y él ${s.length === 0 ? 'no muere' : `${s.length}`}`;
  return [hallazgo(mio, 'supervivencia', 'muertes', texto, dpsBase(mio) * PESOS.muerte, 'muertes', 'alta')];
};

export const reglaDanoRecibido: Regla = (mio, suyo) => {
  const total = mio.supervivencia.totalRecibido;
  const minutos = mio.meta.duracionMs / 60000;
  const res: Hallazgo[] = [];
  for (const f of filasDanoRecibido(mio, suyo)) {
    if (total <= 0 || (f.mioPorMinuto * minutos) / total < 0.02) continue;
    if (f.suyoPorMinuto > 0 && f.mioPorMinuto < 1.5 * f.suyoPorMinuto) continue;
    const ratio = f.ratio ?? 5;
    const texto =
      f.ratio === null
        ? `Recibes daño de ${f.nombre} y él no`
        : `Recibes ${num(f.ratio, 1)}× más daño de ${f.nombre}`;
    res.push(hallazgo(mio, 'supervivencia', `dano:${f.nombre}`, texto, dpsBase(mio) * PESOS.danoRecibido * Math.min(ratio, 5), f.ref));
  }
  return res;
};

export const REGLAS_SUPERVIVENCIA: Regla[] = [reglaMuertes, reglaDanoRecibido];
```

- [ ] **Step 6: Reglas en verde**

Run: `npx ng test --watch=false --include "src/app/analisis/reglas/*.spec.ts"`
Expected: `Test Files 4 passed`, `Tests 29 passed`

- [ ] **Step 7: Test del motor**

`src/app/analisis/motor.spec.ts`:

```ts
import { brujo, crearJugador, diamades, rokka } from '../../testing/fabrica';
import { comparar } from './motor';

describe('comparar', () => {
  it('un jugador contra sí mismo no da hallazgos ni avisos', () => {
    const r = rokka();
    const c = comparar(r, r);
    expect(c.hallazgos).toEqual([]);
    expect(c.avisos).toEqual([]);
  });

  it('dos logs de reportes distintos: ordena por impacto y la muerte va primero', () => {
    const c = comparar(rokka(), diamades());
    expect(c.avisos).toEqual([]);
    expect(c.hallazgos.length).toBeGreaterThan(10);
    expect(c.hallazgos[0]).toMatchObject({ bloque: 'supervivencia', severidad: 'alta', refFila: 'muertes' });
    const impactos = c.hallazgos.map((h) => h.impacto);
    expect(impactos).toEqual([...impactos].sort((a, b) => b - a));
    expect(c.hallazgos.some((h) => h.id === 'downtime')).toBe(true);
    expect(c.hallazgos.some((h) => h.id === 'cpm:Lava Burst')).toBe(true);
  });

  it('rellena las filas de todas las pestañas', () => {
    const c = comparar(rokka(), diamades());
    expect(c.hechizos.length).toBeGreaterThan(5);
    expect(c.talentos.soloSuyos.length).toBeGreaterThan(0);
    expect(c.equipo.length).toBe(16); // Diamades lleva mano secundaria
    expect(c.stats).toHaveLength(5);
    expect(c.consumibles).toHaveLength(4);
    expect(c.cooldowns.map((f) => f.nombre)).toContain('Ascendance');
    expect(c.auras.length).toBeGreaterThan(0);
    expect(c.danoRecibido.length).toBeGreaterThan(0);
  });

  it('avisa si la spec o el boss son distintos, sin bloquear', () => {
    const c = comparar(rokka(), brujo());
    expect(c.avisos).toEqual(['Comparas especializaciones distintas (Elemental Shaman y Affliction Warlock)']);
    const otroBoss = comparar(crearJugador(), crearJugador({ meta: { encounterId: 2, boss: 'Otro' } }));
    expect(otroBoss.avisos).toEqual(['Las peleas son de bosses distintos (Boss y Otro)']);
  });

  it('omite los hallazgos de un bloque no disponible y lo avisa', () => {
    const sinSuperv = { ...rokka(), disponible: { build: true, rendimiento: true, rotacion: true, supervivencia: false } };
    const c = comparar(sinSuperv, diamades());
    expect(c.hallazgos.some((h) => h.bloque === 'supervivencia')).toBe(false);
    expect(c.avisos).toContain('Datos de supervivencia no disponibles: se omiten sus hallazgos');
  });
});
```

- [ ] **Step 8: Ver que falla**

Run: `npx ng test --watch=false --include src/app/analisis/motor.spec.ts`
Expected: FAIL, no se resuelve `./motor`

- [ ] **Step 9: Implementar `src/app/analisis/motor.ts`**

```ts
import { Bloque, PlayerFightData } from '../modelo/player-fight-data';
import { Comparison, Hallazgo, Regla } from './comparison';
import {
  diffTalentos,
  filasAuras,
  filasConsumibles,
  filasCooldowns,
  filasDanoRecibido,
  filasEquipo,
  filasHechizos,
  filasStats,
} from './filas';
import { REGLAS_BUILD } from './reglas/reglas-build';
import { REGLAS_RENDIMIENTO } from './reglas/reglas-rendimiento';
import { REGLAS_ROTACION } from './reglas/reglas-rotacion';
import { REGLAS_SUPERVIVENCIA } from './reglas/reglas-supervivencia';

export const REGLAS: Record<Bloque, Regla[]> = {
  build: REGLAS_BUILD,
  rendimiento: REGLAS_RENDIMIENTO,
  rotacion: REGLAS_ROTACION,
  supervivencia: REGLAS_SUPERVIVENCIA,
};

export function avisos(mio: PlayerFightData, suyo: PlayerFightData): string[] {
  const res: string[] = [];
  if (mio.meta.encounterId !== suyo.meta.encounterId) {
    res.push(`Las peleas son de bosses distintos (${mio.meta.boss} y ${suyo.meta.boss})`);
  } else if (mio.meta.dificultad !== suyo.meta.dificultad) {
    res.push('Las peleas son de dificultades distintas');
  }
  if (mio.meta.clase !== suyo.meta.clase || mio.meta.spec !== suyo.meta.spec) {
    res.push(`Comparas especializaciones distintas (${mio.meta.spec} ${mio.meta.clase} y ${suyo.meta.spec} ${suyo.meta.clase})`);
  }
  for (const b of Object.keys(REGLAS) as Bloque[]) {
    if (!mio.disponible[b] || !suyo.disponible[b]) res.push(`Datos de ${b} no disponibles: se omiten sus hallazgos`);
  }
  return res;
}

export function comparar(mio: PlayerFightData, suyo: PlayerFightData): Comparison {
  const hallazgos: Hallazgo[] = [];
  for (const b of Object.keys(REGLAS) as Bloque[]) {
    if (!mio.disponible[b] || !suyo.disponible[b]) continue;
    for (const regla of REGLAS[b]) hallazgos.push(...regla(mio, suyo));
  }
  hallazgos.sort((a, b) => b.impacto - a.impacto);
  return {
    mio,
    suyo,
    avisos: avisos(mio, suyo),
    hallazgos,
    hechizos: filasHechizos(mio, suyo),
    talentos: diffTalentos(mio, suyo),
    equipo: filasEquipo(mio, suyo),
    stats: filasStats(mio, suyo),
    consumibles: filasConsumibles(mio, suyo),
    cooldowns: filasCooldowns(mio, suyo),
    auras: filasAuras(mio, suyo),
    danoRecibido: filasDanoRecibido(mio, suyo),
  };
}
```

- [ ] **Step 10: Suite completa en verde**

Run: `npx ng test --watch=false`
Expected: `Test Files 12 passed`, `Tests 74 passed`

- [ ] **Step 11: Commit**

```bash
git add cutting-venas/src/app/analisis
git commit -m "feat(cutting-venas): motor de comparación con reglas genéricas y veredicto por impacto"
```

---

### Task 7: Interfaz (entrada, estado de la app y vista de comparación)

**Files:**
- Create: `src/app/ui/enlaces.ts`, `src/app/entrada/selector-combate.ts`, `src/app/entrada/entrada.ts`
- Modify: `src/app/app.ts` (sustituye al provisional de la T2)

**Interfaces:**
- Consumes: `WclReportService`, `WclError`, `mensajeDeError`, `MENSAJES_ERROR` y `WclAuthService` (T3); `PlayerFightLoader` y `SeleccionCombate` (T5); `comparar` y `Comparison` (T6); `parsearUrlReporte`, `nombreDificultad` y `reloj` (T2).
- Produces:
  - **Enlaces** (`ui/enlaces.ts`): `iconoWcl`, `iconoZam`, `enlaceHechizo`, `enlaceItem`, `datosWowhead`, `enlaceReporte` y `refrescarWowhead`.
  - **Selector**: `<cv-selector-combate titulo (seleccion)>`.
  - **Entrada**: `<cv-entrada [ocupado] (comparar)>`, que emite `ParSeleccion { mio: SeleccionCombate; suyo: SeleccionCombate }`.
  - **Raíz**: `App`, que usa `<cv-comparacion [comparacion]>`. Ese componente lo crea la parte B de esta misma tarea.

Comportamiento:
- **Cada lado es independiente.** Pegas la URL de WCL y, al hacer blur o pulsar Enter (`change`), se lee el reporte.
  - Si la URL trae `fight`, se carga esa pelea; si además trae `source`, se preselecciona ese jugador.
  - Si falta alguno de los dos, aparecen desplegables: peleas del reporte como "#id · boss · dificultad · kill/wipe · duración" y jugadores de la pelea como "nombre · spec clase".
- **Comparar** se activa cuando los dos lados están completos. Cada lado muestra su progreso por pasos.
- **Errores**: salen en español. Con `limite` y `red` aparece además un botón **Reintentar**.
- **Sin claves en `environment.ts`**: se muestra la pantalla de configuración.

- [ ] **Step 1: `src/app/ui/enlaces.ts`**

```ts
import { Pieza } from '../modelo/player-fight-data';

export function iconoWcl(icono: string | null): string | null {
  return icono ? `https://assets.rpglogs.com/img/warcraft/abilities/${icono}` : null;
}

export function iconoZam(icono: string | null): string | null {
  return icono ? `https://wow.zamimg.com/images/wow/icons/medium/${icono}.jpg` : null;
}

export function enlaceHechizo(spellId: number | null): string | null {
  return spellId ? `https://www.wowhead.com/spell=${spellId}` : null;
}

export function enlaceItem(p: Pieza): string {
  return `https://www.wowhead.com/item=${p.itemId}`;
}

/** Parámetros data-wowhead para que el tooltip muestre la pieza exacta (ilvl, bonus, encantamiento, gemas). */
export function datosWowhead(p: Pieza): string {
  return [
    `ilvl=${p.ilvl}`,
    p.bonusIds.length ? `bonus=${p.bonusIds.join(':')}` : '',
    p.encantamiento ? `ench=${p.encantamiento}` : '',
    p.gemas.length ? `gems=${p.gemas.join(':')}` : '',
  ]
    .filter(Boolean)
    .join('&');
}

export function enlaceReporte(code: string, fightId: number, sourceId: number): string {
  return `https://www.warcraftlogs.com/reports/${code}#fight=${fightId}&source=${sourceId}`;
}

/** Vuelve a escanear los enlaces de Wowhead tras pintar contenido nuevo. */
export function refrescarWowhead(): void {
  (globalThis as { $WowheadPower?: { refreshLinks(): void } }).$WowheadPower?.refreshLinks();
}
```

- [ ] **Step 2: `src/app/entrada/selector-combate.ts`**

```ts
import { Component, inject, input, output, signal } from '@angular/core';
import { SeleccionCombate } from '../carga/player-fight-loader.service';
import { nombreDificultad, reloj } from '../util/formato';
import { parsearUrlReporte } from '../util/report-url';
import { WclError, mensajeDeError } from '../wcl/wcl-errores';
import { WclReportService } from '../wcl/wcl-report.service';
import { WclFight, WclJugadorDetalle } from '../wcl/wcl-tipos';

/** Un lado de la entrada: URL de WCL y, si faltan en la URL, desplegables de pelea y jugador. */
@Component({
  selector: 'cv-selector-combate',
  template: `
    <section class="cv-panel">
      <h2>{{ titulo() }}</h2>
      <label class="cv-campo">
        <span>URL del reporte de WarcraftLogs</span>
        <input
          class="cv-input"
          type="url"
          placeholder="https://www.warcraftlogs.com/reports/…#fight=…&source=…"
          [value]="url()"
          (change)="alCambiarUrl($any($event.target).value)"
        />
      </label>

      @if (cargando()) {
        <p class="cv-progreso">Leyendo reporte…</p>
      }
      @if (error(); as e) {
        <p class="cv-error">{{ e }}</p>
      }

      @if (peleas().length) {
        <label class="cv-campo">
          <span>Pelea</span>
          <select class="cv-select" [value]="fightId() ?? ''" (change)="elegirPelea(+$any($event.target).value)">
            <option value="" disabled>Elige una pelea</option>
            @for (f of peleas(); track f.id) {
              <option [value]="f.id">{{ etiquetaPelea(f) }}</option>
            }
          </select>
        </label>
      }

      @if (jugadores().length) {
        <label class="cv-campo">
          <span>Jugador</span>
          <select class="cv-select" [value]="sourceId() ?? ''" (change)="elegirJugador(+$any($event.target).value)">
            <option value="" disabled>Elige un jugador</option>
            @for (j of jugadores(); track j.id) {
              <option [value]="j.id">{{ j.name }} · {{ j.specs[0]?.spec }} {{ j.type }}</option>
            }
          </select>
        </label>
      }
    </section>
  `,
})
export class SelectorCombate {
  readonly titulo = input.required<string>();
  readonly seleccion = output<SeleccionCombate | null>();

  private readonly wcl = inject(WclReportService);
  protected readonly url = signal('');
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reportCode = signal<string | null>(null);
  protected readonly peleas = signal<WclFight[]>([]);
  protected readonly jugadores = signal<WclJugadorDetalle[]>([]);
  protected readonly fightId = signal<number | null>(null);
  protected readonly sourceId = signal<number | null>(null);

  protected etiquetaPelea(f: WclFight): string {
    const resultado = f.kill ? 'kill' : 'wipe';
    return `#${f.id} · ${f.name} · ${nombreDificultad(f.difficulty)} · ${resultado} · ${reloj(f.endTime - f.startTime)}`;
  }

  async alCambiarUrl(texto: string): Promise<void> {
    this.url.set(texto);
    this.error.set(null);
    this.peleas.set([]);
    this.jugadores.set([]);
    this.fightId.set(null);
    this.sourceId.set(null);
    this.emitir();
    if (!texto.trim()) return;
    const ref = parsearUrlReporte(texto);
    if (!ref) {
      this.error.set(new WclError('url').message);
      return;
    }
    this.reportCode.set(ref.reportCode);
    this.cargando.set(true);
    try {
      const resumen = await this.wcl.resumen(ref.reportCode);
      this.peleas.set(resumen.fights);
      if (ref.fightId !== null && resumen.fights.some((f) => f.id === ref.fightId)) {
        await this.elegirPelea(ref.fightId, ref.sourceId);
      }
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async elegirPelea(id: number, sourceInicial: number | null = null): Promise<void> {
    this.fightId.set(id);
    this.sourceId.set(null);
    this.jugadores.set([]);
    this.emitir();
    try {
      const jugadores = await this.wcl.jugadores(this.reportCode()!, id);
      this.jugadores.set(jugadores.sort((a, b) => a.name.localeCompare(b.name)));
      if (sourceInicial !== null) {
        if (jugadores.some((j) => j.id === sourceInicial)) this.elegirJugador(sourceInicial);
        else this.error.set(new WclError('jugador-ausente').message);
      }
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }

  elegirJugador(id: number): void {
    this.sourceId.set(id);
    this.emitir();
  }

  private emitir(): void {
    const code = this.reportCode();
    const f = this.fightId();
    const s = this.sourceId();
    this.seleccion.emit(code && f !== null && s !== null ? { reportCode: code, fightId: f, sourceId: s } : null);
  }
}
```

- [ ] **Step 3: `src/app/entrada/entrada.ts`**

```ts
import { Component, computed, input, output, signal } from '@angular/core';
import { SeleccionCombate } from '../carga/player-fight-loader.service';
import { SelectorCombate } from './selector-combate';

export interface ParSeleccion {
  mio: SeleccionCombate;
  suyo: SeleccionCombate;
}

@Component({
  selector: 'cv-entrada',
  imports: [SelectorCombate],
  template: `
    <div class="cv-grid-2">
      <cv-selector-combate titulo="Tu combate" (seleccion)="mio.set($event)" />
      <cv-selector-combate titulo="Combate a analizar" (seleccion)="suyo.set($event)" />
    </div>
    <div class="cv-acciones">
      <button class="cv-boton" type="button" [disabled]="!listo() || ocupado()" (click)="enviar()">Comparar</button>
    </div>
  `,
})
export class Entrada {
  readonly ocupado = input(false);
  readonly comparar = output<ParSeleccion>();
  protected readonly mio = signal<SeleccionCombate | null>(null);
  protected readonly suyo = signal<SeleccionCombate | null>(null);
  protected readonly listo = computed(() => !!this.mio() && !!this.suyo());

  protected enviar(): void {
    const mio = this.mio();
    const suyo = this.suyo();
    if (mio && suyo) this.comparar.emit({ mio, suyo });
  }
}
```

- [ ] **Step 4: `src/app/app.ts` (versión final)**

```ts
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
```

#### Parte B: vista de comparación (veredicto, pestañas y línea de tiempo)

`app.ts` importa `./comparacion/comparacion-vista`, así que no compila hasta terminar esta parte.

**Files (parte B):**
- Create: `src/app/comparacion/veredicto.ts`, `src/app/comparacion/comparacion-vista.ts`, `src/app/comparacion/pestana-build.ts`, `src/app/comparacion/pestana-rendimiento.ts`, `src/app/comparacion/pestana-rotacion.ts`, `src/app/comparacion/linea-tiempo.ts`, `src/app/comparacion/pestana-supervivencia.ts`
- Test: `src/app/comparacion/comparacion-vista.spec.ts`

**Interfaces (parte B):**
- Consumes: `Comparison` y `Hallazgo` (T6); `enlaces.ts` (parte A); `formato.ts` (T2); la fábrica y `comparar` para el smoke test.
- Produces: `<cv-comparacion [comparacion]>`; cada pestaña recibe `[c]` y `[resaltada]`.

Comportamiento (parte B):
- **Cabecera "Tú / Él"**: nombre, con enlace al log en WCL; spec y clase; DPS; boss, dificultad, kill/wipe y duración.
- **Avisos**: se muestran en amarillo y no bloquean nada.
- **Veredicto**: los 8 primeros hallazgos, con la opción "Ver todos (N)".
- **Clic en un hallazgo**: cambia a su pestaña, resalta la fila con `data-ref` = `refFila` (clase `cv-resaltada`) y la desplaza al centro de la vista.
- **Pestaña inicial**: Rendimiento.
- **Línea de tiempo**: SVG con dos carriles en la misma escala de tiempo (la duración mayor de las dos peleas).
  - Cada carril marca los cooldowns, con un color por hechizo (`lt-serie-0..5`), los huecos de más de 1,5 s (`lt-hueco`) y las muertes (✝).
  - Hay leyenda y rejilla por minutos.

- [ ] **Step 5: Smoke test**

`src/app/comparacion/comparacion-vista.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { diamades, rokka } from '../../testing/fabrica';
import { comparar } from '../analisis/motor';
import { ComparacionVista } from './comparacion-vista';

describe('ComparacionVista (smoke)', () => {
  async function montar() {
    const fixture = TestBed.createComponent(ComparacionVista);
    fixture.componentRef.setInput('comparacion', comparar(rokka(), diamades()));
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('pinta la cabecera, el veredicto con 8 hallazgos y las 4 pestañas', async () => {
    const { el } = await montar();
    expect(el.querySelector('.cv-duelo')?.textContent).toContain('Rokka');
    expect(el.querySelector('.cv-duelo')?.textContent).toContain('Diamades');
    expect(el.querySelectorAll('.cv-hallazgo')).toHaveLength(8);
    expect([...el.querySelectorAll('.cv-pestana')].map((b) => b.textContent?.trim())).toEqual([
      'Build',
      'Rendimiento',
      'Rotación',
      'Supervivencia',
    ]);
  });

  it('al pulsar un hallazgo abre su pestaña y resalta la fila', async () => {
    const { fixture, el } = await montar();
    (el.querySelector('.cv-hallazgo') as HTMLButtonElement).click(); // el primero es la muerte
    await fixture.whenStable();
    expect(el.querySelector('.cv-pestana[aria-selected="true"]')?.textContent?.trim()).toBe('Supervivencia');
    expect(el.querySelector('[data-ref="muertes"]')?.classList).toContain('cv-resaltada');
  });

  it('todas las pestañas se pintan sin errores', async () => {
    const { fixture, el } = await montar();
    for (const b of [...el.querySelectorAll<HTMLButtonElement>('.cv-pestana')]) {
      b.click();
      await fixture.whenStable();
      expect(el.querySelector('[role="tabpanel"]')?.children.length).toBeGreaterThan(0);
    }
    expect(el.querySelector('.cv-linea-tiempo')).toBeNull(); // la última pestaña es Supervivencia
  });
});
```

- [ ] **Step 6: Ver que falla**

Run: `npx ng test --watch=false --include src/app/comparacion/comparacion-vista.spec.ts`
Expected: FAIL, no se resuelve `./comparacion-vista`

- [ ] **Step 7: Veredicto y vista principal**

`src/app/comparacion/veredicto.ts`:

```ts
import { Component, computed, input, output, signal } from '@angular/core';
import { Hallazgo } from '../analisis/comparison';
import { Bloque } from '../modelo/player-fight-data';

export const NOMBRES_BLOQUE: Record<Bloque, string> = {
  build: 'Build',
  rendimiento: 'Rendimiento',
  rotacion: 'Rotación',
  supervivencia: 'Supervivencia',
};

const VISIBLES = 8;

@Component({
  selector: 'cv-veredicto',
  template: `
    <section class="cv-panel cv-veredicto">
      <h2>Veredicto</h2>
      @if (hallazgos().length === 0) {
        <p>No hay diferencias relevantes. Buen trabajo.</p>
      } @else {
        <ol class="cv-hallazgos">
          @for (h of visibles(); track h.id) {
            <li>
              <button type="button" class="cv-hallazgo" (click)="elegir.emit(h)">
                <span class="cv-sev cv-sev--{{ h.severidad }}">{{ h.severidad }}</span>
                <span class="cv-hallazgo__texto">{{ h.texto }}</span>
                <span class="cv-hallazgo__bloque">→ {{ nombres[h.bloque] }}</span>
              </button>
            </li>
          }
        </ol>
        @if (hallazgos().length > limite) {
          <button type="button" class="cv-boton cv-boton--secundario" (click)="todos.set(!todos())">
            {{ todos() ? 'Ver menos' : 'Ver todos (' + hallazgos().length + ')' }}
          </button>
        }
      }
    </section>
  `,
})
export class Veredicto {
  readonly hallazgos = input.required<Hallazgo[]>();
  readonly elegir = output<Hallazgo>();
  protected readonly nombres = NOMBRES_BLOQUE;
  protected readonly limite = VISIBLES;
  protected readonly todos = signal(false);
  protected readonly visibles = computed(() => (this.todos() ? this.hallazgos() : this.hallazgos().slice(0, VISIBLES)));
}
```

`src/app/comparacion/comparacion-vista.ts`:

```ts
import { Component, input, signal } from '@angular/core';
import { Comparison, Hallazgo } from '../analisis/comparison';
import { Bloque, PlayerFightData } from '../modelo/player-fight-data';
import { enlaceReporte } from '../ui/enlaces';
import { compacto, nombreDificultad, reloj } from '../util/formato';
import { PestanaBuild } from './pestana-build';
import { PestanaRendimiento } from './pestana-rendimiento';
import { PestanaRotacion } from './pestana-rotacion';
import { PestanaSupervivencia } from './pestana-supervivencia';
import { NOMBRES_BLOQUE, Veredicto } from './veredicto';

@Component({
  selector: 'cv-comparacion',
  imports: [Veredicto, PestanaBuild, PestanaRendimiento, PestanaRotacion, PestanaSupervivencia],
  template: `
    @let c = comparacion();
    <section class="cv-duelo">
      @for (lado of [{ etiqueta: 'Tú', d: c.mio }, { etiqueta: 'Él', d: c.suyo }]; track lado.etiqueta) {
        <div class="cv-lado">
          <span class="cv-lado__etiqueta">{{ lado.etiqueta }}</span>
          <a class="cv-lado__nombre" [href]="enlace(lado.d)" target="_blank" rel="noopener">{{ lado.d.meta.nombre }}</a>
          <span>{{ lado.d.meta.spec }} {{ lado.d.meta.clase }}</span>
          <strong class="cv-lado__dps">{{ compacto(lado.d.rendimiento.dps) }} DPS</strong>
          <span class="cv-lado__pelea">
            {{ lado.d.meta.boss }} · {{ nombreDificultad(lado.d.meta.dificultad) }} · {{ lado.d.meta.kill ? 'kill' : 'wipe' }} ·
            {{ reloj(lado.d.meta.duracionMs) }}
          </span>
        </div>
      }
    </section>

    @for (a of c.avisos; track a) {
      <p class="cv-aviso">{{ a }}</p>
    }

    <cv-veredicto [hallazgos]="c.hallazgos" (elegir)="irA($event)" />

    <nav class="cv-pestanas" role="tablist">
      @for (b of bloques; track b) {
        <button type="button" role="tab" class="cv-pestana" [attr.aria-selected]="pestana() === b" (click)="pestana.set(b)">
          {{ nombres[b] }}
        </button>
      }
    </nav>

    <section class="cv-panel" role="tabpanel">
      @switch (pestana()) {
        @case ('build') {
          <cv-pestana-build [c]="c" [resaltada]="resaltada()" />
        }
        @case ('rendimiento') {
          <cv-pestana-rendimiento [c]="c" [resaltada]="resaltada()" />
        }
        @case ('rotacion') {
          <cv-pestana-rotacion [c]="c" [resaltada]="resaltada()" />
        }
        @case ('supervivencia') {
          <cv-pestana-supervivencia [c]="c" [resaltada]="resaltada()" />
        }
      }
    </section>
  `,
})
export class ComparacionVista {
  readonly comparacion = input.required<Comparison>();
  protected readonly bloques: Bloque[] = ['build', 'rendimiento', 'rotacion', 'supervivencia'];
  protected readonly nombres = NOMBRES_BLOQUE;
  protected readonly pestana = signal<Bloque>('rendimiento');
  protected readonly resaltada = signal<string | null>(null);
  protected readonly compacto = compacto;
  protected readonly reloj = reloj;
  protected readonly nombreDificultad = nombreDificultad;

  protected enlace(d: PlayerFightData): string {
    return enlaceReporte(d.meta.reportCode, d.meta.fightId, d.meta.sourceId);
  }

  protected irA(h: Hallazgo): void {
    this.pestana.set(h.bloque);
    this.resaltada.set(h.refFila ?? null);
    const ref = h.refFila;
    if (!ref) return;
    // Esperar a que la pestaña se pinte antes de desplazar la fila a la vista.
    setTimeout(() => {
      const fila = document.querySelector(`[data-ref="${ref.replace(/"/g, '\\"')}"]`);
      fila?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    });
  }
}
```

- [ ] **Step 8: Pestañas**

`src/app/comparacion/pestana-build.ts`:

```ts
import { NgTemplateOutlet } from '@angular/common';
import { Component, afterNextRender, input } from '@angular/core';
import { Comparison } from '../analisis/comparison';
import { Pieza } from '../modelo/player-fight-data';
import { datosWowhead, enlaceHechizo, enlaceItem, iconoWcl, iconoZam, refrescarWowhead } from '../ui/enlaces';
import { num } from '../util/formato';

@Component({
  selector: 'cv-pestana-build',
  template: `
    @let c = this.c();
    @let t = c.talentos;
    <h3 data-ref="talentos" [class.cv-resaltada]="resaltada() === 'talentos'">Talentos</h3>
    <p>
      Héroe: tú <strong>{{ t.heroeMio ?? '—' }}</strong> · él <strong>{{ t.heroeSuyo ?? '—' }}</strong>
    </p>
    <div class="cv-grid-2">
      <div>
        <h4>Solo él ({{ t.soloSuyos.length }})</h4>
        <ul class="cv-lista-talentos">
          @for (x of t.soloSuyos; track x.entryId) {
            <li>
              @if (iconoZam(x.icono); as src) {
                <img class="cv-icono" [src]="src" alt="" />
              }
              <a [href]="enlaceHechizo(x.spellId)" target="_blank" rel="noopener">{{ x.nombre }}</a>
              @if (x.rango > 1) {
                <small>(rango {{ x.rango }})</small>
              }
            </li>
          }
        </ul>
      </div>
      <div>
        <h4>Solo tú ({{ t.soloMios.length }})</h4>
        <ul class="cv-lista-talentos">
          @for (x of t.soloMios; track x.entryId) {
            <li>
              @if (iconoZam(x.icono); as src) {
                <img class="cv-icono" [src]="src" alt="" />
              }
              <a [href]="enlaceHechizo(x.spellId)" target="_blank" rel="noopener">{{ x.nombre }}</a>
              @if (x.rango > 1) {
                <small>(rango {{ x.rango }})</small>
              }
            </li>
          }
        </ul>
      </div>
    </div>
    <details>
      <summary>Talentos comunes ({{ t.comunes.length }})</summary>
      <ul class="cv-lista-talentos cv-lista-talentos--compacta">
        @for (x of t.comunes; track x.entryId) {
          <li>{{ x.nombre }}</li>
        }
      </ul>
    </details>

    <h3 data-ref="equipo" [class.cv-resaltada]="resaltada() === 'equipo'">
      Equipo · ilvl medio {{ num(c.mio.build.ilvlMedio, 1) }} frente a {{ num(c.suyo.build.ilvlMedio, 1) }}
    </h3>
    <table class="cv-tabla">
      <thead>
        <tr><th>Ranura</th><th>Tú</th><th>Él</th><th class="cv-num">Dif. ilvl</th></tr>
      </thead>
      <tbody>
        @for (f of c.equipo; track f.ref) {
          <tr [attr.data-ref]="f.ref" [class.cv-resaltada]="resaltada() === f.ref">
            <td>{{ f.nombreRanura }}</td>
            <td [class.cv-peor]="f.faltaEncantamiento || f.faltanGemas > 0">
              @if (f.mio; as p) {
                <ng-container *ngTemplateOutlet="pieza; context: { $implicit: p }" />
              } @else {
                —
              }
              @if (f.faltaEncantamiento) {
                <small>sin encantamiento</small>
              }
              @if (f.faltanGemas > 0) {
                <small>faltan {{ f.faltanGemas }} gemas</small>
              }
            </td>
            <td>
              @if (f.suyo; as p) {
                <ng-container *ngTemplateOutlet="pieza; context: { $implicit: p }" />
              } @else {
                —
              }
            </td>
            <td class="cv-num" [class.cv-peor]="f.difIlvl < 0" [class.cv-mejor]="f.difIlvl > 0">{{ f.difIlvl }}</td>
          </tr>
        }
      </tbody>
    </table>
    <ng-template #pieza let-p>
      <a [href]="enlaceItem(p)" [attr.data-wowhead]="datosWowhead(p)" target="_blank" rel="noopener">
        <img class="cv-icono" [src]="iconoWcl(p.icono)" alt="" />
        {{ p.ilvl }}
      </a>
    </ng-template>

    <div class="cv-grid-2">
      <div>
        <h3>Estadísticas</h3>
        <table class="cv-tabla">
          <thead>
            <tr><th>Estadística</th><th class="cv-num">Tú</th><th class="cv-num">Él</th><th class="cv-num">Dif.</th></tr>
          </thead>
          <tbody>
            @for (s of c.stats; track s.nombre) {
              <tr>
                <td>{{ s.nombre }}</td>
                <td class="cv-num">{{ num(s.mio) }}</td>
                <td class="cv-num">{{ num(s.suyo) }}</td>
                <td class="cv-num" [class.cv-peor]="s.dif < 0" [class.cv-mejor]="s.dif > 0">{{ num(s.dif) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div>
        <h3>Consumibles</h3>
        <table class="cv-tabla">
          <thead>
            <tr><th>Tipo</th><th>Tú</th><th>Él</th></tr>
          </thead>
          <tbody>
            @for (f of c.consumibles; track f.ref) {
              <tr [attr.data-ref]="f.ref" [class.cv-resaltada]="resaltada() === f.ref">
                <td>{{ f.etiqueta }}</td>
                <td [class.cv-peor]="!f.mio && !!f.suyo">{{ f.mio ? '✔ ' + f.mio : '✘' }}</td>
                <td>{{ f.suyo ? '✔ ' + f.suyo : '✘' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  imports: [NgTemplateOutlet],
})
export class PestanaBuild {
  readonly c = input.required<Comparison>();
  readonly resaltada = input<string | null>(null);
  protected readonly num = num;
  protected readonly iconoWcl = iconoWcl;
  protected readonly iconoZam = iconoZam;
  protected readonly enlaceHechizo = enlaceHechizo;
  protected readonly enlaceItem = enlaceItem;
  protected readonly datosWowhead = (p: Pieza) => datosWowhead(p);

  constructor() {
    // La pestaña se crea al seleccionarla: basta con refrescar los tooltips tras el primer pintado.
    afterNextRender(() => refrescarWowhead());
  }
}
```

`src/app/comparacion/pestana-rendimiento.ts`:

```ts
import { Component, input } from '@angular/core';
import { Comparison } from '../analisis/comparison';
import { iconoWcl } from '../ui/enlaces';
import { compacto, num, pctSigno } from '../util/formato';

@Component({
  selector: 'cv-pestana-rendimiento',
  template: `
    @let c = this.c();
    <p>
      DPS: tú <strong>{{ compacto(c.mio.rendimiento.dps) }}</strong> · él <strong>{{ compacto(c.suyo.rendimiento.dps) }}</strong>
    </p>
    <table class="cv-tabla">
      <thead>
        <tr>
          <th>Hechizo</th>
          <th class="cv-num">% daño tú</th>
          <th class="cv-num">% daño él</th>
          <th class="cv-num">CPM tú</th>
          <th class="cv-num">CPM él</th>
          <th class="cv-num">Dif. CPM</th>
          <th class="cv-num">Daño/casteo tú</th>
          <th class="cv-num">Daño/casteo él</th>
        </tr>
      </thead>
      <tbody>
        @for (f of c.hechizos; track f.ref) {
          <tr [attr.data-ref]="f.ref" [class.cv-resaltada]="resaltada() === f.ref">
            <td>
              @if (iconoWcl(f.icono); as src) {
                <img class="cv-icono" [src]="src" alt="" />
              }
              {{ f.nombre }}
            </td>
            <td class="cv-num" [class.cv-peor]="f.difPorcentaje <= -5">{{ f.mio ? num(f.mio.porcentaje, 1) : '—' }}</td>
            <td class="cv-num">{{ f.suyo ? num(f.suyo.porcentaje, 1) : '—' }}</td>
            <td class="cv-num">{{ f.mio?.casteos ? num(f.mio!.cpm, 1) : '—' }}</td>
            <td class="cv-num">{{ f.suyo?.casteos ? num(f.suyo!.cpm, 1) : '—' }}</td>
            <td class="cv-num" [class.cv-peor]="(f.difCpmPct ?? 0) <= -15" [class.cv-mejor]="(f.difCpmPct ?? 0) >= 15">
              {{ f.difCpmPct === null ? '—' : pctSigno(f.difCpmPct) }}
            </td>
            <td class="cv-num">{{ f.mio?.danoPorCasteo ? compacto(f.mio!.danoPorCasteo) : '—' }}</td>
            <td class="cv-num">{{ f.suyo?.danoPorCasteo ? compacto(f.suyo!.danoPorCasteo) : '—' }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class PestanaRendimiento {
  readonly c = input.required<Comparison>();
  readonly resaltada = input<string | null>(null);
  protected readonly num = num;
  protected readonly compacto = compacto;
  protected readonly pctSigno = pctSigno;
  protected readonly iconoWcl = iconoWcl;
}
```

`src/app/comparacion/linea-tiempo.ts`:

```ts
import { Component, computed, input } from '@angular/core';
import { Comparison } from '../analisis/comparison';
import { PlayerFightData } from '../modelo/player-fight-data';
import { reloj } from '../util/formato';

const ANCHO = 1000;
const ALTO_CARRIL = 36;
const MARGEN_IZQ = 40;
const SERIES = 6;

interface Marca {
  x: number;
  serie: number;
  titulo: string;
}

interface Carril {
  etiqueta: string;
  y: number;
  ancho: number;
  huecos: { x: number; w: number; titulo: string }[];
  marcas: Marca[];
  muertes: { x: number; titulo: string }[];
}

/** Dos carriles alineados en tiempo: cooldowns (color por hechizo), huecos > 1,5 s y muertes. */
@Component({
  selector: 'cv-linea-tiempo',
  template: `
    <svg class="cv-linea-tiempo" [attr.viewBox]="'0 0 ' + (ancho + margen) + ' ' + alto()" role="img" aria-label="Línea de tiempo de cooldowns y huecos">
      @for (m of marcasTiempo(); track m.x) {
        <line class="lt-rejilla" [attr.x1]="m.x" [attr.x2]="m.x" y1="0" [attr.y2]="alto() - 14" />
        <text class="lt-texto" [attr.x]="m.x" [attr.y]="alto() - 2" text-anchor="middle">{{ m.etiqueta }}</text>
      }
      @for (c of carriles(); track c.etiqueta) {
        <text class="lt-texto" x="0" [attr.y]="c.y + 22">{{ c.etiqueta }}</text>
        <rect class="lt-carril" [attr.x]="margen" [attr.y]="c.y + 4" [attr.width]="c.ancho" [attr.height]="alturaCarril - 8" />
        @for (h of c.huecos; track h.x) {
          <rect class="lt-hueco" [attr.x]="h.x" [attr.y]="c.y + 4" [attr.width]="h.w" [attr.height]="alturaCarril - 8">
            <title>{{ h.titulo }}</title>
          </rect>
        }
        @for (m of c.marcas; track $index) {
          <rect class="lt-cd lt-serie-{{ m.serie }}" [attr.x]="m.x - 3" [attr.y]="c.y" width="6" [attr.height]="alturaCarril">
            <title>{{ m.titulo }}</title>
          </rect>
        }
        @for (d of c.muertes; track d.x) {
          <text class="lt-muerte" [attr.x]="d.x" [attr.y]="c.y + 24" text-anchor="middle">✝<title>{{ d.titulo }}</title></text>
        }
      }
    </svg>
    <ul class="lt-leyenda">
      <li><span class="lt-muestra lt-hueco"></span> Hueco &gt; 1,5 s</li>
      @for (n of cooldowns(); track n; let i = $index) {
        <li><span class="lt-muestra lt-cd lt-serie-{{ i % series }}"></span> {{ n }}</li>
      }
    </ul>
  `,
})
export class LineaTiempo {
  readonly c = input.required<Comparison>();
  protected readonly ancho = ANCHO;
  protected readonly margen = MARGEN_IZQ;
  protected readonly alturaCarril = ALTO_CARRIL;
  protected readonly series = SERIES;

  protected readonly cooldowns = computed(() => this.c().cooldowns.map((f) => f.nombre));
  private readonly duracion = computed(() => Math.max(this.c().mio.meta.duracionMs, this.c().suyo.meta.duracionMs));
  private readonly x = (ms: number) => MARGEN_IZQ + (ms / this.duracion()) * ANCHO;
  protected readonly alto = computed(() => ALTO_CARRIL * 2 + 24);

  protected readonly carriles = computed<Carril[]>(() => [
    this.carril('Tú', this.c().mio, 0),
    this.carril('Él', this.c().suyo, ALTO_CARRIL + 4),
  ]);

  protected readonly marcasTiempo = computed(() => {
    const res: { x: number; etiqueta: string }[] = [];
    for (let ms = 0; ms <= this.duracion(); ms += 60000) res.push({ x: this.x(ms), etiqueta: reloj(ms) });
    return res;
  });

  private carril(etiqueta: string, d: PlayerFightData, y: number): Carril {
    const indices = new Map(this.cooldowns().map((n, i) => [n, i % SERIES]));
    return {
      etiqueta,
      y,
      ancho: (d.meta.duracionMs / this.duracion()) * ANCHO,
      huecos: d.timeline.huecos.map((h) => ({
        x: this.x(h.desde),
        w: Math.max(1, this.x(h.hasta) - this.x(h.desde)),
        titulo: `${reloj(h.desde)} · hueco de ${(h.duracion / 1000).toFixed(1)} s tras ${h.tras}`,
      })),
      marcas: d.timeline.casteos
        .filter((c) => indices.has(c.nombre))
        .map((c) => ({ x: this.x(c.fin), serie: indices.get(c.nombre)!, titulo: `${reloj(c.fin)} · ${c.nombre}` })),
      muertes: d.supervivencia.muertes.map((m) => ({ x: this.x(m.t), titulo: `${reloj(m.t)} · muerte por ${m.causa}` })),
    };
  }
}
```

`src/app/comparacion/pestana-rotacion.ts`:

```ts
import { Component, computed, input } from '@angular/core';
import { Comparison } from '../analisis/comparison';
import { num, reloj } from '../util/formato';
import { LineaTiempo } from './linea-tiempo';

const CASTEOS_OPENER = 20;

@Component({
  selector: 'cv-pestana-rotacion',
  imports: [LineaTiempo],
  template: `
    @let c = this.c();
    <h3 data-ref="downtime" [class.cv-resaltada]="resaltada() === 'downtime'">
      Downtime: tú {{ num(c.mio.timeline.downtimeMs / 1000) }} s ({{ num(c.mio.timeline.downtimePct, 1) }} %) · él
      {{ num(c.suyo.timeline.downtimeMs / 1000) }} s ({{ num(c.suyo.timeline.downtimePct, 1) }} %)
    </h3>
    <cv-linea-tiempo [c]="c" />

    <h3>Cooldowns</h3>
    <table class="cv-tabla">
      <thead>
        <tr><th>Cooldown</th><th>Tú</th><th>Él</th></tr>
      </thead>
      <tbody>
        @for (f of c.cooldowns; track f.ref) {
          <tr [attr.data-ref]="f.ref" [class.cv-resaltada]="resaltada() === f.ref">
            <td>{{ f.nombre }}</td>
            <td [class.cv-peor]="f.mio.length < f.suyo.length">{{ f.mio.length }} · {{ tiempos(f.mio) }}</td>
            <td>{{ f.suyo.length }} · {{ tiempos(f.suyo) }}</td>
          </tr>
        }
      </tbody>
    </table>

    <h3>Opener (primeros {{ opener().length }} casteos)</h3>
    <table class="cv-tabla">
      <thead>
        <tr><th class="cv-num">#</th><th>Tú</th><th>Él</th></tr>
      </thead>
      <tbody>
        @for (fila of opener(); track $index) {
          <tr [class.cv-peor]="fila.mio?.nombre !== fila.suyo?.nombre">
            <td class="cv-num">{{ $index + 1 }}</td>
            <td>{{ fila.mio ? reloj(fila.mio.fin) + ' ' + fila.mio.nombre : '—' }}</td>
            <td>{{ fila.suyo ? reloj(fila.suyo.fin) + ' ' + fila.suyo.nombre : '—' }}</td>
          </tr>
        }
      </tbody>
    </table>

    <h3>Uptime de buffs y debuffs</h3>
    <table class="cv-tabla">
      <thead>
        <tr><th>Aura</th><th>Tipo</th><th class="cv-num">Tú</th><th class="cv-num">Él</th><th class="cv-num">Dif.</th></tr>
      </thead>
      <tbody>
        @for (f of c.auras; track f.ref) {
          <tr [attr.data-ref]="f.ref" [class.cv-resaltada]="resaltada() === f.ref">
            <td>{{ f.nombre }}</td>
            <td>{{ f.tipo }}</td>
            <td class="cv-num">{{ f.mio === null ? '—' : num(f.mio) + ' %' }}</td>
            <td class="cv-num">{{ f.suyo === null ? '—' : num(f.suyo) + ' %' }}</td>
            <td class="cv-num" [class.cv-peor]="f.dif <= -10" [class.cv-mejor]="f.dif >= 10">{{ num(f.dif) }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class PestanaRotacion {
  readonly c = input.required<Comparison>();
  readonly resaltada = input<string | null>(null);
  protected readonly num = num;
  protected readonly reloj = reloj;

  protected readonly opener = computed(() => {
    const m = this.c().mio.timeline.casteos.slice(0, CASTEOS_OPENER);
    const s = this.c().suyo.timeline.casteos.slice(0, CASTEOS_OPENER);
    return Array.from({ length: Math.max(m.length, s.length) }, (_, i) => ({ mio: i < m.length ? m[i] : null, suyo: i < s.length ? s[i] : null }));
  });

  protected tiempos(ms: number[]): string {
    return ms.map(reloj).join(', ') || '—';
  }
}
```

`src/app/comparacion/pestana-supervivencia.ts`:

```ts
import { Component, input } from '@angular/core';
import { Comparison } from '../analisis/comparison';
import { compacto, num, reloj } from '../util/formato';

@Component({
  selector: 'cv-pestana-supervivencia',
  template: `
    @let c = this.c();
    <div class="cv-grid-2">
      @for (lado of [{ etiqueta: 'Tú', d: c.mio }, { etiqueta: 'Él', d: c.suyo }]; track lado.etiqueta) {
        <div>
          <h3 [attr.data-ref]="lado.etiqueta === 'Tú' ? 'muertes' : null" [class.cv-resaltada]="lado.etiqueta === 'Tú' && resaltada() === 'muertes'">
            {{ lado.etiqueta }}: {{ lado.d.supervivencia.muertes.length }} muertes
          </h3>
          <ul>
            @for (m of lado.d.supervivencia.muertes; track m.t) {
              <li>{{ reloj(m.t) }} · {{ m.causa }}</li>
            }
          </ul>
          <p>
            Defensivos:
            @for (x of lado.d.supervivencia.defensivos; track x.nombre; let ultimo = $last) {
              {{ x.nombre }} ×{{ x.usos }}{{ ultimo ? '' : ', ' }}
            } @empty {
              ninguno
            }
          </p>
          <p>Pociones de vida: {{ lado.d.supervivencia.pocionesVida }} · Piedras de salud: {{ lado.d.supervivencia.piedrasVida }}</p>
        </div>
      }
    </div>

    <h3>Daño recibido por habilidad (por minuto)</h3>
    <table class="cv-tabla">
      <thead>
        <tr><th>Habilidad</th><th>Origen</th><th class="cv-num">Tú</th><th class="cv-num">Él</th><th class="cv-num">Ratio</th></tr>
      </thead>
      <tbody>
        @for (f of c.danoRecibido; track f.ref) {
          <tr [attr.data-ref]="f.ref" [class.cv-resaltada]="resaltada() === f.ref">
            <td>{{ f.nombre }}</td>
            <td>{{ f.origen }}</td>
            <td class="cv-num">{{ compacto(f.mioPorMinuto) }}</td>
            <td class="cv-num">{{ compacto(f.suyoPorMinuto) }}</td>
            <td class="cv-num" [class.cv-peor]="f.ratio === null ? f.mioPorMinuto > 0 : f.ratio >= 1.5">
              {{ f.ratio === null ? '—' : num(f.ratio, 1) + '×' }}
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class PestanaSupervivencia {
  readonly c = input.required<Comparison>();
  readonly resaltada = input<string | null>(null);
  protected readonly num = num;
  protected readonly compacto = compacto;
  protected readonly reloj = reloj;
}
```

- [ ] **Step 9: Todo en verde y build sin avisos**

Run: `npx ng test --watch=false` → Expected: `Test Files 13 passed`, `Tests 77 passed`, sin `Unhandled Errors`
Run: `npx ng build` → Expected: sin `ERROR` ni `WARNING`

- [ ] **Step 10: Commit**

```bash
git add cutting-venas/src/app
git commit -m "feat(cutting-venas): entrada de dos logs, veredicto y pestañas de comparación"
```

---

### Task 8: Sistema visual con la skill Hallmark

**Files:**
- Modify: `src/styles.scss`, `src/index.html`

**Interfaces:**
- Consumes: las clases que usan las plantillas de la Task 7. Es un contrato: los nombres no se cambian.

- [ ] **Step 1: Invocar la skill `hallmark`** (Skill tool, `skill: "hallmark"`), en modo greenfield, con este brief:
  - **Nombre**: **Cutting Venas**, analizador de logs de combate de World of Warcraft. Compara tu log con el de otro jugador y te dice qué haces mal.
  - **Idioma y uso**: interfaz en español. Es una herramienta de uso personal, local y densa en datos: tablas, un veredicto con severidades y una línea de tiempo SVG.
  - **Tono**: con carácter, nada genérico; la estética puede inspirarse en el mundo de WoW sin copiar su marca.
  - **Legibilidad**: prioritaria en tablas numéricas, con cifras tabulares (`font-variant-numeric: tabular-nums`) en `.cv-num`.
  - **Temas**: claro y oscuro con `prefers-color-scheme`. En móvil (360 px) no debe haber scroll horizontal de la página; las tablas anchas hacen scroll dentro de `.cv-panel`.
  - **Implementación**: solo `src/styles.scss` (estilos globales con tokens en `:root`) y `src/index.html` (fuentes). Las plantillas no se tocan.

- [ ] **Step 2: El resultado debe dar estilo a todo este contrato de clases**

| Clase | Dónde se usa |
|---|---|
| `.cv-app`, `.cv-cabecera`, `.cv-marca`, `.cv-lema` | contenedor raíz y cabecera con el nombre |
| `.cv-panel` | tarjetas y secciones (con `overflow-x: auto`) |
| `.cv-grid-2` | dos columnas que pasan a una en móvil |
| `.cv-campo` (label > span + control), `.cv-input`, `.cv-select` | formulario de entrada |
| `.cv-acciones`, `.cv-boton`, `.cv-boton--secundario` (con `:disabled`) | botones |
| `.cv-progreso`, `.cv-error`, `.cv-aviso` | estados |
| `.cv-duelo`, `.cv-lado`, `.cv-lado__etiqueta`, `.cv-lado__nombre`, `.cv-lado__dps`, `.cv-lado__pelea` | cabecera "Tú / Él" |
| `.cv-veredicto`, `.cv-hallazgos` (ol), `.cv-hallazgo` (button, fila clicable), `.cv-hallazgo__texto`, `.cv-hallazgo__bloque` | veredicto |
| `.cv-sev`, `.cv-sev--alta`, `.cv-sev--media`, `.cv-sev--baja` | chip de severidad |
| `.cv-pestanas`, `.cv-pestana` con `[aria-selected="true"]` | pestañas |
| `.cv-tabla`, `th`, `td`, `.cv-num` | tablas |
| `.cv-peor`, `.cv-mejor` | celdas o filas donde tú estás peor o mejor |
| `.cv-resaltada` | fila o encabezado resaltado tras pulsar un hallazgo |
| `.cv-icono` | icono de 20 px junto al texto |
| `.cv-lista-talentos`, `.cv-lista-talentos--compacta` | listas de talentos |
| `.cv-linea-tiempo` (svg, `width: 100%`) y, dentro, `.lt-rejilla`, `.lt-texto`, `.lt-carril`, `.lt-hueco`, `.lt-cd`, `.lt-serie-0` … `.lt-serie-5`, `.lt-muerte` | línea de tiempo (colores vía `fill`/`stroke`) |
| `.lt-leyenda`, `.lt-muestra` | leyenda de la línea de tiempo |

- [ ] **Step 3: `src/index.html`**: `lang="es"`, `<title>Cutting Venas</title>`, las fuentes que elija Hallmark y, antes de `</body>`, los tooltips de Wowhead:

```html
<script>const whTooltips = { colorLinks: true, iconizeLinks: false, renameLinks: true };</script>
<script src="https://wow.zamimg.com/js/tooltips.js"></script>
```

- [ ] **Step 4: Verificar**

- Run: `npx ng build` → Expected: sin errores ni avisos.
- Run: `npx ng test --watch=false` → Expected: `Tests 77 passed`.
- Revisión visual con `npm start` (la hace la Task 9 con datos reales), en claro, en oscuro y a 360 px.

- [ ] **Step 5: Commit**

```bash
git add cutting-venas/src/styles.scss cutting-venas/src/index.html
git commit -m "feat(cutting-venas): sistema visual Hallmark"
```

---

### Task 9: Verificación de punta a punta con logs reales y README

**Files:**
- Create: `cutting-venas/README.md` (sustituye al del CLI)

- [ ] **Step 1: Arrancar la app:** `npm start` (desde `cutting-venas/`) y abrir `http://localhost:4200`.

- [ ] **Step 2: Comparar dos logs de reportes distintos**
  - **Tu combate**: `https://www.warcraftlogs.com/reports/DFwWK2hHpCcq4t8R#fight=14&source=17`
  - **Combate a analizar**: `https://www.warcraftlogs.com/reports/DkNt713VdTzjrPZA#fight=2&source=85`
  - Pulsar **Comparar**.

  Expected:
  - Cabecera: Rokka ~101,8 k DPS frente a Diamades ~271,5 k DPS.
  - Veredicto: el primer hallazgo es "Mueres 1 vez (8:14 por Grim Guillotine) y él no muere"; también aparecen el CPM de Elemental Blast y Lava Burst y el downtime.
  - Pestañas: las cuatro se pintan.
  - Tooltips: los de Wowhead funcionan en el equipo.
  - Hallazgos: al pulsar uno, se abre su pestaña y se resalta su fila.

- [ ] **Step 3: Flujo con desplegables**
  - Pegar solo `https://www.warcraftlogs.com/reports/DFwWK2hHpCcq4t8R` en un lado. Deben aparecer las peleas; al elegir la 14, los jugadores (entre ellos Mutgagarín, brujo).
  - Compararlo con Diamades. Debe salir el aviso amarillo de especializaciones distintas, y aun así mostrarse la comparación.

- [ ] **Step 4: Errores**
  - Una URL inventada (`https://www.google.com`) → "No parece una URL de reporte de WarcraftLogs".
  - Un código inexistente (`https://www.warcraftlogs.com/reports/AAAAAAAAAAAAAAAA`) → "Reporte no encontrado o privado".
  - Vaciar `wclClientSecret` en `environment.ts` → pantalla "Falta configuración". Después, restaurar el valor.

- [ ] **Step 5: `cutting-venas/README.md`**

```markdown
# Cutting Venas

Compara tu log de WarcraftLogs con el de otro jugador y te dice qué haces mal: veredicto ordenado por impacto y detalle de build, rendimiento, rotación y supervivencia.

## Puesta en marcha

1. Crea un cliente en https://www.warcraftlogs.com/api/clients.
2. `cp src/environments/environment.example.ts src/environments/environment.ts` y rellena `wclClientId` y `wclClientSecret`.
3. `npm install`
4. `npm start` y abre http://localhost:4200.

La app llama a WarcraftLogs y Raidbots a través del proxy de `ng serve` (`proxy.conf.json`), así que solo funciona con `npm start`.

## Uso

Pega en cada lado la URL del log (idealmente con `#fight=…&source=…`, como la que ves en WCL al abrir un jugador). Si falta la pelea o el jugador, elige en los desplegables. Los dos logs pueden ser de reportes distintos.

## Tests

- `npx ng test --watch=false`
- Los fixtures reales se regeneran con `npm run capturar -- <reportCode> <fightId> <sourceId>` (usa `../wcl-fetch/.env`).

## Ajustar la detección

Las listas de utilidad, defensivos y consumibles están en `src/app/analisis/catalogo-habilidades.ts`. Los umbrales de cada regla están en `src/app/analisis/reglas/`.
```

- [ ] **Step 6: Commit**

```bash
git add cutting-venas/README.md
git commit -m "docs(cutting-venas): README de puesta en marcha y uso"
```
