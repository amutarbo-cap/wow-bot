import { lista, num } from '../../util/formato';
import { Hallazgo, Regla } from '../comparison';
import { diffTalentos, filasConsumibles, filasEquipo } from '../filas';
import { PESOS, dpsBase, hallazgo } from './impacto';

export const reglaTalentos: Regla = (mio, suyo) => {
  const d = diffTalentos(mio, suyo);
  const res: Hallazgo[] = [];
  const heroeDistinto = !!d.heroeMio && !!d.heroeSuyo && d.heroeMio !== d.heroeSuyo;
  if (heroeDistinto) {
    res.push(
      hallazgo(
        mio,
        'build',
        'heroe',
        `Héroe distinto: tú ${d.heroeMio}, él ${d.heroeSuyo}`,
        dpsBase(mio) * PESOS.heroe,
        'talentos',
      ),
    );
  }
  // El héroe distinto ya se cuenta arriba: no dupliques sus talentos aquí.
  const soloMios = heroeDistinto ? d.soloMios.filter((t) => t.arbol !== 'heroe') : d.soloMios;
  const soloSuyos = heroeDistinto ? d.soloSuyos.filter((t) => t.arbol !== 'heroe') : d.soloSuyos;
  const n = soloMios.length + soloSuyos.length;
  if (n > 0) {
    const partes: string[] = [];
    if (soloSuyos.length) partes.push(`él lleva ${lista(soloSuyos.map((t) => t.nombre))}`);
    if (soloMios.length) partes.push(`tú llevas ${lista(soloMios.map((t) => t.nombre))}`);
    res.push(
      hallazgo(
        mio,
        'build',
        'talentos',
        `Talentos distintos: ${partes.join('; ')}`,
        dpsBase(mio) * PESOS.talento * Math.min(n, 10),
        'talentos',
      ),
    );
  }
  return res;
};

export const reglaEquipo: Regla = (mio, suyo) => {
  const res: Hallazgo[] = [];
  const difIlvl = suyo.build.ilvlMedio - mio.build.ilvlMedio;
  if (difIlvl >= 3) {
    res.push(
      hallazgo(
        mio,
        'build',
        'ilvl',
        `Tu ilvl medio es ${num(mio.build.ilvlMedio, 1)} frente a ${num(suyo.build.ilvlMedio, 1)}`,
        dpsBase(mio) * PESOS.ilvlPorPunto * difIlvl,
        'equipo',
      ),
    );
  }
  for (const f of filasEquipo(mio, suyo)) {
    if (f.faltaEncantamiento) {
      res.push(
        hallazgo(
          mio,
          'build',
          `encantamiento:${f.ranura}`,
          `Te falta el encantamiento de ${f.nombreRanura.toLowerCase()}`,
          dpsBase(mio) * PESOS.encantamiento,
          f.ref,
        ),
      );
    }
    if (f.faltanGemas > 0) {
      res.push(
        hallazgo(
          mio,
          'build',
          `gemas:${f.ranura}`,
          `Te ${f.faltanGemas === 1 ? 'falta 1 gema' : `faltan ${f.faltanGemas} gemas`} en ${f.nombreRanura.toLowerCase()}`,
          dpsBase(mio) * PESOS.gema * f.faltanGemas,
          f.ref,
        ),
      );
    }
  }
  return res;
};

export const reglaConsumibles: Regla = (mio, suyo) =>
  filasConsumibles(mio, suyo)
    .filter((f) => f.suyo && !f.mio)
    .map((f) =>
      hallazgo(
        mio,
        'build',
        `consumible:${f.tipo}`,
        `No usaste ${f.etiqueta.toLowerCase()} (él: ${f.suyo})`,
        dpsBase(mio) * PESOS.consumible,
        f.ref,
      ),
    );

export const REGLAS_BUILD: Regla[] = [reglaTalentos, reglaEquipo, reglaConsumibles];
