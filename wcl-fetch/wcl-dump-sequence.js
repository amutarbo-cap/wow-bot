/**
 * Vuelca la secuencia COMPLETA y ordenada de casteos, con nombre y timestamp
 * relativo al inicio del pull, a partir de:
 *   - wcl-casts.json  (los eventos ya descargados)
 *   - wcl-abilities.json (opcional: si no lo tienes, corre esto primero
 *     con fetchAbilityNames() del script anterior y guarda el resultado)
 *
 * Si no tienes wcl-abilities.json, este script vuelve a pedir los nombres
 * a la API (rápido, una sola query).
 *
 * Uso:
 *   node --env-file=.env wcl-dump-sequence.js
 */


const CLIENT_ID = process.env.WCL_CLIENT_ID;
const CLIENT_SECRET = process.env.WCL_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan WCL_CLIENT_ID / WCL_CLIENT_SECRET. Crea wcl-fetch/.env (ver .env.example) y ejecuta con: node --env-file=.env wcl-dump-sequence.js');
  process.exit(1);
}
const REPORT_CODE = 'DFwWK2hHpCcq4t8R';

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
  const data = await res.json();
  return data.access_token;
}

async function fetchAbilityNames(token) {
  const query = `
    query {
      reportData {
        report(code: "${REPORT_CODE}") {
          masterData { abilities { gameID name } }
        }
      }
    }
  `;
  const res = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  const map = new Map();
  for (const a of json.data.reportData.report.masterData.abilities) {
    map.set(a.gameID, a.name);
  }
  return map;
}

function msToClock(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

async function main() {
  const fs = await import('fs');
  const casts = JSON.parse(fs.readFileSync('wcl-casts.json', 'utf-8'));

  const token = await getAccessToken();
  const abilityNames = await fetchAbilityNames(token);
  const nombre = (id) => abilityNames.get(id) || `(ID desconocido: ${id})`;

  const sorted = [...casts].sort((a, b) => a.timestamp - b.timestamp);
  const fightStart = sorted[0].timestamp;

  const lines = sorted.map(
    (c) => `[${msToClock(c.timestamp - fightStart)}] ${nombre(c.abilityGameID)}`
  );

  fs.writeFileSync('wcl-secuencia-completa.txt', lines.join('\n'));
  console.log(`Guardado wcl-secuencia-completa.txt con ${lines.length} casteos.`);
  console.log('\n--- Primeros 20 casteos (opener) ---');
  console.log(lines.slice(0, 20).join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
