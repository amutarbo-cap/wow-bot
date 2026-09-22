/**
 * Descarga los eventos de "Casts" de un jugador concreto en una pelea concreta
 * de un report de WarcraftLogs (API v2), y los cruza con masterData.abilities
 * para tener el NOMBRE de cada hechizo en vez de solo el ID.
 *
 * Uso:
 *   node --env-file=.env wcl-fetch-casts.js
 *
 * Requiere Node 18+ (usa fetch nativo).
 */


const CLIENT_ID = process.env.WCL_CLIENT_ID;
const CLIENT_SECRET = process.env.WCL_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan WCL_CLIENT_ID / WCL_CLIENT_SECRET. Crea wcl-fetch/.env (ver .env.example) y ejecuta con: node --env-file=.env wcl-fetch-casts.js');
  process.exit(1);
}

const REPORT_CODE = 'DFwWK2hHpCcq4t8R';
const FIGHT_ID = 14;
const SOURCE_ID = 17;

// Umbral para considerar un hueco "grave" (además del de >1500ms que ya se reporta)
const GAP_SIGNIFICATIVO_MS = 3000;

async function getAccessToken() {
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://www.warcraftlogs.com/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new Error(`Error obteniendo token: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function graphql(token, query) {
  const res = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors, null, 2)}`);
  }
  return json.data;
}

/**
 * Trae el diccionario abilityGameID -> nombre para TODO el report.
 * masterData.abilities cubre todas las habilidades que aparecen en el report entero,
 * así que solo hace falta pedirlo una vez.
 */
async function fetchAbilityNames(token) {
  const query = `
    query {
      reportData {
        report(code: "${REPORT_CODE}") {
          masterData {
            abilities {
              gameID
              name
              icon
              type
            }
          }
        }
      }
    }
  `;
  const data = await graphql(token, query);
  const abilities = data.reportData.report.masterData.abilities;
  const map = new Map();
  for (const a of abilities) {
    map.set(a.gameID, a.name);
  }
  return map;
}

async function fetchAllEvents(token, dataType) {
  const allEvents = [];
  let startTime = 0;

  while (true) {
    const query = `
      query {
        reportData {
          report(code: "${REPORT_CODE}") {
            events(
              fightIDs: [${FIGHT_ID}]
              sourceID: ${SOURCE_ID}
              dataType: ${dataType}
              startTime: ${startTime}
              limit: 10000
            ) {
              data
              nextPageTimestamp
            }
          }
        }
      }
    `;
    const data = await graphql(token, query);
    const events = data.reportData.report.events;
    allEvents.push(...events.data);

    if (events.nextPageTimestamp) {
      startTime = events.nextPageTimestamp;
    } else {
      break;
    }
  }

  return allEvents;
}

function msToClock(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

async function main() {
  console.log('Autenticando...');
  const token = await getAccessToken();

  console.log('Descargando nombres de habilidades...');
  const abilityNames = await fetchAbilityNames(token);

  console.log('Descargando casteos (Casts)...');
  const casts = await fetchAllEvents(token, 'Casts');
  console.log(`Total eventos de cast: ${casts.length}\n`);

  const fs = await import('fs');
  fs.writeFileSync('wcl-casts.json', JSON.stringify(casts, null, 2));

  const sorted = [...casts].sort((a, b) => a.timestamp - b.timestamp);
  const fightStart = sorted[0].timestamp;

  const nombre = (id) => abilityNames.get(id) || `(ID desconocido: ${id})`;

  console.log('=== Huecos > 1500ms ===');
  const huecos = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
    if (gap > 1500) {
      huecos.push({
        gap,
        after: sorted[i - 1].abilityGameID,
        relTime: sorted[i - 1].timestamp - fightStart,
      });
      console.log(
        `  [${msToClock(sorted[i - 1].timestamp - fightStart)}] Hueco de ${gap}ms tras ${nombre(
          sorted[i - 1].abilityGameID
        )}`
      );
    }
  }

  console.log(`\n=== Resumen: huecos >= ${GAP_SIGNIFICATIVO_MS}ms agrupados por hechizo previo ===`);
  const porHabilidad = new Map();
  for (const h of huecos) {
    if (h.gap < GAP_SIGNIFICATIVO_MS) continue;
    const key = h.after;
    if (!porHabilidad.has(key)) porHabilidad.set(key, { count: 0, total: 0 });
    const entry = porHabilidad.get(key);
    entry.count += 1;
    entry.total += h.gap;
  }

  const resumen = [...porHabilidad.entries()]
    .map(([id, { count, total }]) => ({ id, nombre: nombre(id), count, total }))
    .sort((a, b) => b.total - a.total);

  for (const r of resumen) {
    console.log(
      `  ${r.nombre}: ${r.count} veces, ${(r.total / 1000).toFixed(1)}s de downtime total`
    );
  }

  const totalDowntimeSignificativo = resumen.reduce((acc, r) => acc + r.total, 0);
  const fightDuration = sorted[sorted.length - 1].timestamp - fightStart;
  console.log(
    `\nDowntime total (huecos >= ${GAP_SIGNIFICATIVO_MS}ms): ${(totalDowntimeSignificativo / 1000).toFixed(1)}s de ${(fightDuration / 1000).toFixed(1)}s de pelea (${((totalDowntimeSignificativo / fightDuration) * 100).toFixed(1)}%)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
