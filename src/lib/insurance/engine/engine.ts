import { ClaimInput, CalcResult, Gen2026ClaimInput, Generation } from "./types";
import { calcStandardized } from "./generationStandardized";
import { calc2021 } from "./generation2021";
import { calc2026 } from "./generation2026";

export function calculate(generation: Generation, input: ClaimInput): CalcResult {
  switch (generation) {
    case "2009": return calcStandardized("2009", input);
    case "2017": return calcStandardized("2017", input);
    case "2021": return calc2021(input);
    // 제네릭 진입점은 세대별 필수 축을 타입으로 강제할 수 없다. 5세대 비급여 치료유형은
    // calc2026이 런타임에서 검사해 미지정이면 PENDING_UNVERIFIED로 막는다.
    // 타입 강제가 필요한 호출부(5세대 UI·다회 엔진)는 calc2026을 직접 호출한다.
    case "2026": return calc2026(input as Gen2026ClaimInput);
    default: {
      const _exhaustive: never = generation;
      throw new Error("지원하지 않는 세대: " + _exhaustive);
    }
  }
}
