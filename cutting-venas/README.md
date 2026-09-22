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
