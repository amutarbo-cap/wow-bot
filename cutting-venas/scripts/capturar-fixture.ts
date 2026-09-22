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
