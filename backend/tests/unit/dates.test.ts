import { describe, expect, it } from 'vitest';
import { isIsoDate, isWithinRange, todayIn } from '../../src/domain/dates';

describe('isIsoDate', () => {
  it('acepta una fecha ISO válida', () => {
    expect(isIsoDate('2026-08-27')).toBe(true);
  });

  it('rechaza un día que no existe en el calendario', () => {
    expect(isIsoDate('2026-02-31')).toBe(false);
    expect(isIsoDate('2025-02-29')).toBe(false);
  });

  it('acepta el 29 de febrero de un año bisiesto', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
  });

  it('rechaza formatos distintos de YYYY-MM-DD', () => {
    expect(isIsoDate('27/08/2026')).toBe(false);
    expect(isIsoDate('2026-8-27')).toBe(false);
    expect(isIsoDate('2026-08-27T10:00:00Z')).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe('todayIn', () => {
  // Este es el caso que rompe una implementación ingenua: a las 23:30 UTC del
  // día 27 todavía son las 18:30 del día 27 en Bogotá, pero a las 02:00 UTC del
  // día 28 aún es 27 en Colombia.
  it('devuelve el día de negocio, no el del reloj UTC', () => {
    const madrugadaUtc = new Date('2026-08-28T02:00:00Z');

    expect(todayIn('America/Bogota', madrugadaUtc)).toBe('2026-08-27');
    expect(todayIn('UTC', madrugadaUtc)).toBe('2026-08-28');
  });

  it('devuelve siempre el formato YYYY-MM-DD', () => {
    expect(todayIn('America/Bogota', new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });
});

describe('isWithinRange', () => {
  it('incluye ambos extremos del rango', () => {
    expect(isWithinRange('2026-01-01', '2026-01-01', '2026-01-31')).toBe(true);
    expect(isWithinRange('2026-01-31', '2026-01-01', '2026-01-31')).toBe(true);
  });

  it('excluye los días fuera del rango', () => {
    expect(isWithinRange('2025-12-31', '2026-01-01', '2026-01-31')).toBe(false);
    expect(isWithinRange('2026-02-01', '2026-01-01', '2026-01-31')).toBe(false);
  });
});
