// HOLD 스텁 가드.
//
// feature/ 4종은 **근거가 없어서** 미구현인 것이 아니다(2026-09-03 원문 조사로 확정).
//   · 발달장애 / 임신·출산 / 비중증 제외항목 — 별표15에 근거가 있으나 판정 입력축이 없다
//   · 비급여 할인·할증 — 감독규정은 시행 중이나 공통 규정에 등급·요율·산식이 없다
//                        (게다가 보험금이 아니라 보험료 영역이다)
//
// 이 테스트는 세 가지를 막는다.
//   1) 스텁이 조용히 값을 반환하게 바뀌는 것 — 근거 없는 계산이 결과에 섞인다
//   2) STATUS가 HOLD가 아닌 값으로 바뀌는 것 — 상태 표시와 실제가 어긋난다
//   3) 낡은 사유("원문 미확정", "공포 대기", "판매약관 확인 필요")가 되살아나는 것
//      — 세 표현 모두 사실이 아니었고, 되살아나면 조사 결과가 지워진다
// 근거가 확보되어 실제로 구현할 때는 이 테스트를 함께 고쳐야 한다. 그게 의도다.
import { readFileSync } from "node:fs";
import { DEVELOPMENTAL_STATUS, developmentalBenefit } from "../src/lib/insurance/engine/feature/developmental";
import { DISCOUNT_STATUS, applyDiscount } from "../src/lib/insurance/engine/feature/discount";
import { EXCLUSION_STATUS, isExcluded } from "../src/lib/insurance/engine/feature/exclusion";
import { PREGNANCY_STATUS, pregnancyBenefit } from "../src/lib/insurance/engine/feature/pregnancy";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const stubs = [
  ["발달장애 보장", DEVELOPMENTAL_STATUS, developmentalBenefit],
  ["할인·할증", DISCOUNT_STATUS, applyDiscount],
  ["비중증 제외항목", EXCLUSION_STATUS, isExcluded],
  ["임신·출산 급여", PREGNANCY_STATUS, pregnancyBenefit],
] as const;

/** 조사 전 사유. 셋 다 사실이 아니었으므로 코드·메시지 어디에도 남으면 안 된다. */
const STALE_REASONS = ["원문 미확정", "공포 대기", "판매약관 확인 필요", "판매약관 미확보", "감독규정 확정 후"] as const;

const SOURCES = [
  ["발달장애", "src/lib/insurance/engine/feature/developmental.ts"],
  ["할인·할증", "src/lib/insurance/engine/feature/discount.ts"],
  ["비중증 제외항목", "src/lib/insurance/engine/feature/exclusion.ts"],
  ["임신·출산", "src/lib/insurance/engine/feature/pregnancy.ts"],
] as const;

for (const [name, status, fn] of stubs) {
  check(`${name}: STATUS가 HOLD`, status === "HOLD", String(status));

  let threw = false;
  let message = "";
  try {
    (fn as () => unknown)();
  } catch (error) {
    threw = true;
    message = error instanceof Error ? error.message : String(error);
  }
  check(`${name}: 호출 시 값을 반환하지 않고 실패`, threw);
  check(`${name}: 실패 사유에 HOLD 표시`, message.includes("[HOLD]"), message);
  // 사유가 "근거 없음"으로 되돌아가지 않아야 한다.
  for (const stale of STALE_REASONS) {
    check(`${name}: 낡은 사유 "${stale}" 없음`, !message.includes(stale), message);
  }
  check(`${name}: 실제 막힌 이유를 밝힘`, /입력축|계산 수치|요율표/.test(message), message);
  check(`${name}: 근거가 확인됐다는 사실을 밝힘`, message.includes("근거는 확인됨"), message);
}

// ── 소스 주석까지 검사한다. 사유는 주석에도 남기 때문이다. ──
for (const [name, file] of SOURCES) {
  const src = readFileSync(file, "utf8");
  for (const stale of STALE_REASONS) {
    check(`${name} 소스: 낡은 사유 "${stale}" 없음`, !src.includes(stale));
  }
  check(`${name} 소스: 근거 조항을 인용`, /별표15|감독규정/.test(src), file);
}

console.log(`\n[featureStubs] 스텁 ${stubs.length}종 · 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
