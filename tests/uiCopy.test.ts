// UI 문구 가드.
// 계산 로직이 아니라 "사실을 단정하는 문구"가 근거 없이 되돌아오는 것을 막는다.
//
// 배경: 5세대 중증 비급여 입원 자기부담 상한(500만원)의 누적 기간 기산점은
//       2026-08-24 기준 확정되지 않았다. 금융위원회 보도자료 원문·첨부(보도자료/Q&A)에
//       "연간 자기부담금 500만원"만 있고 계약해당일·보험연도·역년·매년 표현이 없으며,
//       5세대 판매약관도 확보되지 않았다.
//       인접 4세대 약관 2건은 모두 "매년 계약해당일부터 1년간" 기준이다.
//       따라서 UI는 어느 쪽도 단정하지 않는다.
//
// 이 테스트가 실패하면 문구를 되돌리기 전에 먼저 약관 근거가 확보됐는지 확인할 것.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const gen5 = readFileSync("src/components/calculators/HealthCalc5th.tsx", "utf8");

// 이 입력과 안내에서 사용하던 역년 단정 문구가 되돌아오지 않아야 한다.
// 컴포넌트 전체에서 "올해" 같은 일반 단어를 금지하면 무관한 문구까지 실패하므로
// 문제가 된 원문만 정확히 차단한다.
for (const banned of [
  "올해 기존 중증 비급여 자기부담금",
  "올해 이미 부담한 중증 비급여 입원 자기부담금",
]) {
  check(`5세대 UI: 근거 없는 역년 단정 문구 "${banned}" 없음`, !gen5.includes(banned));
}

// 판매약관 확인 전에는 계약해당일 기준도 이 입력 안내에 새로 단정하지 않는다.
for (const banned of ["계약해당일부터 이미 부담한", "계약일부터 이미 부담한"]) {
  check(`5세대 UI: 근거 없는 계약 기산점 문구 "${banned}" 없음`, !gen5.includes(banned));
}

// 중립 표현과 약관 확인 안내가 있어야 한다
check("5세대 UI: 누적 범위를 '약관상 누적기간'으로 한정", gen5.includes("약관상 누적기간"));
check("5세대 UI: 기산점은 약관 확인 안내", gen5.includes("기산점은 가입하신 상품의 약관을 확인"));

console.log(`\n[uiCopy] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
