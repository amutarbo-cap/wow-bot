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
