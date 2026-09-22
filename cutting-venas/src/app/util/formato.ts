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
