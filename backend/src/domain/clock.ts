import { todayIn, type IsoDate } from './dates';

/**
 * El dominio nunca llama a `new Date()`. El reloj se inyecta para que los tests
 * fijen "hoy" y el cálculo de vigencia sea determinista independientemente de
 * cuándo se ejecute la suite.
 */
export interface Clock {
  today(): IsoDate;
}

export function createSystemClock(timeZone: string): Clock {
  return {
    today: () => todayIn(timeZone),
  };
}

export function createFixedClock(date: IsoDate): Clock {
  return {
    today: () => date,
  };
}
