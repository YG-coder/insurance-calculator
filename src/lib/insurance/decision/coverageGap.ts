// 보장 공백 계산기 (decision/)
// 역할: 현재와 목표의 "차이"만 계산한다. 필요액을 정하지 않는다.
// 순수 함수: 0을 포함한 비음수 두 값을 받아 차이를 계산한다.
//   - NEED_INPUT 개념 없음(UI가 빈 문자열로 미입력을 판정).
//   - 도메인 로직이 UI 입력 방식에 오염되지 않는다.

export type GapDirection = "short" | "over" | "equal"; // 부족 / 초과 / 같음

export interface CoverageGapInput {
  needed: number;  // 필요 보장금액(원) [C]
  current: number; // 현재 보장금액(원) [C]
}

export interface CoverageGapResult {
  needed: number;      // 정규화된 필요 보장금액
  current: number;     // 정규화된 현재 보장금액
  direction: GapDirection;
  shortfall: number;   // 부족 보장금액 = max(needed - current, 0)
  surplus: number;     // 초과 보장금액 = max(current - needed, 0)
}

const nonNeg = (v: number) => (isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function calcCoverageGap(input: CoverageGapInput): CoverageGapResult {
  const needed = nonNeg(input.needed);
  const current = nonNeg(input.current);

  const shortfall = Math.max(needed - current, 0);
  const surplus = Math.max(current - needed, 0);
  const direction: GapDirection =
    shortfall > 0 ? "short" : surplus > 0 ? "over" : "equal";

  return { needed, current, direction, shortfall, surplus };
}
