# Cutting Venas

Compara tu log de WarcraftLogs con el de otro jugador y te dice qué haces mal: veredicto ordenado por impacto y detalle de build, rendimiento, rotación y supervivencia.

## Puesta en marcha

1. Crea un cliente en https://www.warcraftlogs.com/api/clients.
2. `cp src/environments/environment.example.ts src/environments/environment.ts` y rellena `wclClientId` y `wclClientSecret`.
3. `npm install`
4. `npm start` y abre http://localhost:4200.

La app llama a WarcraftLogs y Raidbots a través del proxy de `ng serve` (`proxy.conf.json`), así que solo funciona con `npm start`.

`environment.ts` es obligatorio: sin él la app no compila. Con `wclClientId`/`wclClientSecret` vacíos, compila pero muestra la pantalla de "Falta configuración" en vez de arrancar.

### Seguridad

El client secret de WCL se incrusta tal cual en el bundle JS (`environment.ts` se compila dentro de `dist/`), así que:

- No despliegues ni compartas `dist/`: cualquiera que lo abra puede leer el secret.
- No ejecutes `ng serve --host 0.0.0.0` (ni ninguna variante que exponga el puerto a la red): expondrías el secret y el proxy a quien esté en la misma red.
- Regenera en https://www.warcraftlogs.com/api/clients el secret antiguo que estaba hardcodeado en los scripts de `wcl-fetch`; considéralo comprometido aunque ya no se use.

## Uso

Pega en cada lado la URL del log (idealmente con `#fight=…&source=…`, como la que ves en WCL al abrir un jugador). Si falta la pelea o el jugador, elige en los desplegables. Los dos logs pueden ser de reportes distintos.

## Tests

- `npx ng test --watch=false`
- Los fixtures reales se regeneran con `npm run capturar -- <reportCode> <fightId> <sourceId>` (usa `../wcl-fetch/.env`).

## Ajustar la detección

Las listas de utilidad, defensivos y consumibles están en `src/app/analisis/catalogo-habilidades.ts`. Los umbrales de cada regla están en `src/app/analisis/reglas/`.

### Limitaciones conocidas

- Los hechizos canalizados cuentan su canalización como downtime: el evento `cast` llega al *empezar* la canalización, así que el tiempo que dura se detecta como un hueco hasta el siguiente casteo.
- El CPM y los usos de cooldowns no se ajustan por el tiempo que el jugador pasa muerto (solo el downtime lo excluye).
