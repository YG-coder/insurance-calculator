import { ClaimInput, CalcResult, Generation } from "./types";
import { calc2021 } from "./generation2021";
import { calc2026 } from "./generation2026";

export function calculate(generation: Generation, input: ClaimInput): CalcResult {
  switch (generation) {
    case "2021": return calc2021(input);
    case "2026": return calc2026(input);
    default: {
      const _exhaustive: never = generation;
      throw new Error("지원하지 않는 세대: " + _exhaustive);
    }
  }
}
