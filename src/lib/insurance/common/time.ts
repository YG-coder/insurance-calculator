import { nonNegativeInteger } from "./number";

export function toMonths(years: number, extraMonths: number = 0): number {
  return nonNegativeInteger(years) * 12 + nonNegativeInteger(extraMonths);
}
