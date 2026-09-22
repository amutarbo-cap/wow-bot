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
