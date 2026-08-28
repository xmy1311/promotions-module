import { todayIn, type IsoDate } from './dates';

/** Inyectable para que los tests fijen "hoy"*/
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
