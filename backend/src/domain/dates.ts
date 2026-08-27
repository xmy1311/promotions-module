/**
 * La vigencia de una promoción es un día civil, no un instante. Por eso las
 * fechas se manejan como cadenas `YYYY-MM-DD` de punta a punta (base de datos,
 * API, formulario) y nunca como `Date`.
 *
 * Consecuencia deliberada: la comparación lexicográfica de dos cadenas ISO
 * coincide con su orden cronológico, así que no existe ninguna conversión de
 * zona horaria en el camino y la clase entera de errores de timezone
 * desaparece por construcción.
 */
export type IsoDate = string;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Valida formato y existencia real del día (rechaza 2026-02-31). */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Verifica que la zona horaria sea una zona IANA válida para este runtime. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Día de hoy en la zona horaria de negocio, no en la del contenedor.
 * Los contenedores y GitHub Actions corren en UTC: sin esto, una promoción que
 * termina hoy dejaría de contarse a las 19:00 hora de Colombia.
 */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const valueOf = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${valueOf('year')}-${valueOf('month')}-${valueOf('day')}`;
}

/** Rango inclusivo en ambos extremos: `start <= date <= end`. */
export function isWithinRange(date: IsoDate, start: IsoDate, end: IsoDate): boolean {
  return start <= date && date <= end;
}

export function isAfter(date: IsoDate, other: IsoDate): boolean {
  return date > other;
}
