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
