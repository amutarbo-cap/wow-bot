# Cutting Venas — Diseño v1

**Fecha:** 2026-09-22
**Estado:** Aprobado en brainstorming, pendiente de revisión del spec

## Objetivo

App Angular local, en español, que compara el rendimiento de **un jugador contra otro** (misma clase/spec, normalmente mismo boss) usando dos logs de WarcraftLogs, y explica de forma intuitiva **qué se hace mal**: primero un veredicto con hallazgos ordenados por impacto, después el detalle por bloques.

## Alcance

**Dentro (v1):**
- Comparación jugador vs jugador a partir de dos URLs de WCL.
- Bloques: Build (talentos, equipo, stats, consumibles), Rendimiento, Rotación y tiempos, Supervivencia.
- Veredicto automático con reglas genéricas (válidas para cualquier clase).

**Fuera (versiones futuras):**
- Comparación contra guías (reglas por spec).
- Búsqueda de a quién compararse (rankings WCL).
- Árbol visual de talentos.
- Caché de respuestas (IndexedDB).
- Comparación raid vs raid.

## Contexto existente

`wcl-fetch/` contiene scripts Node (`wcl-fetch-casts.js`, `wcl-dump-sequence.js`) que autentican con client credentials contra la API v2, descargan casts de un `sourceID` y calculan huecos/downtime. Se mantienen como herramientas sueltas; la app **reimplementa** esa lógica en TypeScript (no ejecuta los scripts).

Tareas colaterales sobre los scripts:
- Mover `CLIENT_ID`/`CLIENT_SECRET` hardcodeados a un `.env` (leído con `process.env`), añadir `.env` a `.gitignore` y recomendar al usuario rotar el secret.
- Bug conocido: la secuencia mezcla eventos `begincast` y `cast` (casteos duplicados). La app filtra solo `type === 'cast'`.

## Arquitectura

**Stack:** Angular 21 (Angular 22 exige Node ≥ 24.15 y el equipo tiene Node 24.14), componentes standalone, signals, SCSS, sin librería de UI. Ubicación: `wcl-tools/cutting-venas/`. Textos de UI en español directamente en plantillas (sin i18n). Nombres de hechizos en inglés, tal como vienen de WCL.

**Ejecución solo local** con `ng serve`.

**Credenciales:** `src/environments/environment.ts` con `wclClientId` y `wclClientSecret`. Este archivo va en `.gitignore`; se versiona `environment.example.ts` como plantilla.

**Proxy (evita CORS):** `proxy.conf.json`:
- `/wcl/oauth` → `https://www.warcraftlogs.com/oauth/token`
- `/wcl/api` → `https://www.warcraftlogs.com/api/v2/client`

### Unidades

| Unidad | Responsabilidad | Depende de |
|---|---|---|
| `WclAuthService` | Obtiene token OAuth (client credentials) vía proxy; lo guarda en memoria hasta que expira | `environment` |
| `WclApiService` | Ejecuta GraphQL, pagina eventos con `nextPageTimestamp`, traduce errores WCL a errores tipados | `WclAuthService` |
| `ReportUrlParser` | Función pura: URL → `{ reportCode, fightId?, sourceId? }` | — |
| `PlayerFightLoader` | Descarga en paralelo los datos de un jugador en una pelea y construye `PlayerFightData` | `WclApiService` |
| `ComparisonEngine` | Funciones puras: `(mío, suyo)` → `Comparison` (diffs por bloque + `Hallazgo[]` ordenados) | — |
| Componentes UI | Solo presentan `Comparison`; no calculan | `Comparison` |

### Datos que descarga `PlayerFightLoader`

- `masterData` (habilidades: id → nombre/icono; actores: clase/spec).
- `fights` (boss, dificultad, kill/wipe, inicio/fin, duración).
- `playerDetails` y evento `combatantinfo` (talentos, equipo con ilvl/encantamientos/gemas, stats, auras iniciales para consumibles).
- Tablas `report.table(...)`: `DamageDone`, `Casts`, `Buffs`, `Debuffs`, `DamageTaken`, `Deaths`.
- Eventos `Casts` del jugador, filtrados a `type === 'cast'` (para línea de tiempo, opener, cooldowns, huecos).

### Modelo `PlayerFightData`

- `meta`: nombre, clase, spec, boss, dificultad, duración (ms), kill/wipe.
- `build`: talentos (lista de nodos/ids con nombre), equipo por ranura (ilvl, encantamiento, gemas), stats secundarias, consumibles detectados.
- `rendimiento`: DPS; por hechizo: daño, % del total, casteos, CPM, daño por casteo.
- `timeline`: casteos con tiempo relativo al pull (ms); huecos > 1500 ms; downtime total y %.
- `auras`: uptime % de buffs propios y debuffs aplicados.
- `supervivencia`: daño recibido por habilidad (total y por minuto), muertes (tiempo y habilidad causante), usos de defensivos/pociones de vida.

Todos los tiempos relativos al inicio del pull; todas las tasas por minuto de combate.

## Pantallas

Una sola ruta con dos estados.

### Entrada
- Cabecera "Cutting Venas".
- Dos campos: **"Tu combate"** y **"Combate a analizar"** (URL de WCL).
- Si la URL no incluye `fight` o `source`: desplegables de peleas del reporte ("Boss · dificultad · kill/wipe · duración") y de jugadores de esa pelea (con clase/spec).
- Botón **"Comparar"**; progreso por pasos para cada lado.
- Aviso (no bloqueante) si boss o clase/spec difieren.

### Comparación
- **Cabecera:** ambos jugadores con nombre, spec, DPS, boss, dificultad, duración.
- **Veredicto:** top 8 hallazgos por impacto, con severidad (alta/media/baja por color) y enlace a su pestaña; "ver todos" para el resto. Clic → cambia de pestaña y resalta la fila.
- **Pestañas** (siempre tú | él | diferencia):
  - **Build:** talentos como lista de diferencias (solo tú / solo él arriba; comunes colapsados); tabla de equipo por ranura con diferencias resaltadas; stats secundarias; consumibles ✔/✘.
  - **Rendimiento:** tabla por hechizo (% daño, casteos, CPM, daño/casteo), ordenada por mayor diferencia.
  - **Rotación:** timeline con dos carriles paralelos (cooldowns marcados, huecos > 1,5 s); zoom del opener (primeros 20 casteos lado a lado); tabla de uptime de buffs/debuffs.
  - **Supervivencia:** daño recibido por habilidad, muertes, defensivos y pociones de vida.

## Motor de hallazgos

`Regla = (mio: PlayerFightData, suyo: PlayerFightData) => Hallazgo[]`

`Hallazgo = { id, bloque: 'build'|'rendimiento'|'rotacion'|'supervivencia', severidad: 'alta'|'media'|'baja', texto, impacto: number, refFila?: string }`

### Reglas v1

| Regla | Condición de disparo |
|---|---|
| CPM por hechizo | Hechizo ≥ 3 % del daño de cualquiera de los dos y CPM difiere ≥ 15 % |
| Reparto de daño | % de daño de un hechizo difiere ≥ 5 puntos |
| Hechizo ausente | Él lo usa (≥ 1 % del daño o es cooldown) y tú no |
| Usos de cooldowns | Tus usos por minuto < los suyos |
| Retraso del primer cooldown | Tu primer uso ≥ 5 s después del suyo |
| Downtime | Downtime % difiere ≥ 3 puntos |
| Uptime buffs/debuffs | Uptime difiere ≥ 10 puntos |
| Talentos | Nodos presentes solo en uno de los dos |
| Equipo | ilvl medio difiere ≥ 3, o falta encantamiento/gema en una ranura donde él lo tiene |
| Consumibles | Él usa flask/comida/runa/poción de DPS y tú no |
| Supervivencia | Recibes ≥ 50 % más daño por minuto de una habilidad, o mueres y él no |

**Ajustes validados con logs reales (dos reportes distintos):**
- Las reglas señalan solo la dirección en la que tú estás peor (uptime, usos de cooldowns, consumibles, equipo, supervivencia); CPM y reparto de daño señalan ambas direcciones.
- Uptime: solo cuentan los debuffs que aplica el jugador y los buffs ligados a un hechizo casteado o a un talento de cualquiera de los dos. Se excluyen los consumibles, porque ya los cubre su propia regla. Así se evita el ruido de procs de abalorios, buffs de banda y mecánicas del boss.
- Usos de cooldowns: si las duraciones de las peleas difieren más de un 10 %, el texto compara usos por minuto.
- Los talentos se resuelven a nombre con el catálogo público de Raidbots (`talents.json`), porque WCL solo da IDs. El equipo se muestra con icono, ilvl y tooltip de Wowhead.
- Los casteos se construyen emparejando `begincast` con `cast`: el tiempo de casteo no cuenta como hueco.

**Cooldown (heurística):** hechizo que alguno de los dos castea en media ≤ 1 vez cada 45 s, excluyendo una lista corta de movilidad/utilidad (p. ej. Ghost Wolf, Gust of Wind).

**Impacto:**
- Hechizos de daño: `ΔCPM × daño medio por casteo / 60` (DPS estimado).
- Downtime: `segundos perdidos de diferencia × tu DPS medio / duración`.
- Build y supervivencia: pesos fijos — muertes en la franja más alta; consumibles/encantamientos que faltan, franja media; talentos, franja media-baja.

**Severidad** derivada del impacto con umbrales fijos. Las reglas se registran en un array; las futuras reglas de guías por spec se añadirán como otro array con la misma firma.

## Errores

| Caso | Comportamiento |
|---|---|
| `environment.ts` ausente o claves vacías | Pantalla de configuración con instrucciones |
| OAuth 401 | "Credenciales de WarcraftLogs inválidas" |
| URL no reconocida | "No parece una URL de reporte de WarcraftLogs" |
| Reporte privado/inexistente | "Reporte no encontrado o privado" |
| Jugador ausente en la pelea | "Ese jugador no participó en la pelea seleccionada" |
| 429 | "Límite de peticiones de WCL alcanzado, espera un momento" + botón reintentar |
| Falla una tabla concreta | Se muestra el resto; bloque "no disponible"; sus reglas se omiten |
| Boss o spec distintos | Aviso amarillo no bloqueante |

## Tests

Runner por defecto de Angular.
- **Unit (prioritario):** `ReportUrlParser` (URLs reales y variantes); cada regla de `ComparisonEngine` (dispara / no dispara bajo umbral / orden por impacto); detección de huecos ignorando `begincast`.
- **Normalización:** `PlayerFightLoader` con respuestas JSON grabadas como fixtures del reporte `DFwWK2hHpCcq4t8R` → `PlayerFightData` esperado.
- **Componentes:** smoke test de la página de comparación con un `Comparison` fixture (veredicto y 4 pestañas).
- Sin e2e contra la API real.

## Look & feel

Se aplica la skill **Hallmark** durante la implementación de la UI (paleta, tipografía, componentes).
