// UI 문구 가드.
// 계산 로직이 아니라 "사실을 단정하는 문구"가 근거 없이 되돌아오는 것을 막는다.
//
// 배경: 2026-08-24에는 5세대 중증 비급여 입원 자기부담 상한의 기산점이 미확정이어서
//       단정을 금지했다. 2026-09-03 별표15 2026.5.6 연혁본 특별약관1 제5조②·⑤를
//       직접 확인해 계약일·계약해당일 기준으로 확정했고, 현재는 그 근거가 UI에 남도록 검사한다.
//
// 이 테스트가 실패하면 문구를 되돌리기 전에 먼저 약관 근거가 확보됐는지 확인할 것.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const gen5 = readFileSync("src/components/calculators/HealthCalc5th.tsx", "utf8");
const gen5Multi = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
const site = readFileSync("src/lib/site.ts", "utf8");
const gen4Page = readFileSync("src/app/health-insurance-calculator/page.tsx", "utf8");
const healthGuides = readFileSync("src/lib/guides.ts", "utf8");
const footer = readFileSync("src/components/Footer.tsx", "utf8");
const disclaimer = readFileSync("src/app/disclaimer/page.tsx", "utf8");
const about = readFileSync("src/app/about/page.tsx", "utf8");
const gen5Page = readFileSync("src/app/5th-generation-health-insurance-calculator/page.tsx", "utf8");

for (const stale of ["연간 누적 한도와 급여 통원 등 일부 기준은", "공식 원문 확인 후 순차적으로 추가할 예정"]){
  check(`5세대 페이지: 폐기된 미반영 안내 "${stale}" 없음`, !gen5Page.includes(stale));
}
check("5세대 페이지: 표준약관 근거 명시", gen5Page.includes("보험업감독업무시행세칙 별표15"));
check("5세대 페이지: 단건 통원 가입금액 반영 안내",
  gen5.includes("통원 가입금액 (선택)")
  && gen5Page.includes("단건 계산은 통원 1회당·1일당 가입금액까지 반영"));
check("5세대 페이지: 단건 미반영 범위를 연간 항목으로 한정",
  gen5Page.includes("연간 횟수와 연간 보험가입금액은 반영하지"));

check("4세대 계산기: 홈 카드가 세대를 명시", site.includes('title: "4세대 실손보험 자기부담금 계산기"'));
check("4세대 계산기: 페이지 제목이 세대를 명시", gen4Page.includes("4세대 실손보험 자기부담금 계산기"));
check("4세대 계산기: 가이드 링크가 세대를 명시", healthGuides.includes('calcLabel: "4세대 실손보험 자기부담금 계산기"'));
check("실손 계산기: 푸터가 2·3·4·5세대를 각각 명시", ["2·3세대 실손보험 계산기", "4세대 실손보험 계산기", "5세대 실손보험 계산기"].every((label) => footer.includes(label)));
check("4세대 계산기: 면책 페이지 링크가 세대를 명시", disclaimer.includes("4세대 실손보험 계산기"));
check("실손 계산기: 소개 페이지가 2·3·4·5세대를 모두 명시", about.includes("2·3·4·5세대"));
check("4세대 계산기: 세대 없는 옛 링크 라벨 없음", !/>\s*실손보험 계산기\s*</.test(footer) && !/>\s*실손보험 계산기\s*</.test(disclaimer));
check("4세대 계산기: 가이드 본문에 세대 없는 옛 명칭 없음", !/(?<!4세대 )실손보험 자기부담금 계산기(?:로|를)/.test(healthGuides));

// 2026-09-03: 기산점이 확정되었다. 별표15 2026.5.6 연혁본 특별약관1 제5조② —
//   "'연간'이라 함은 계약일로부터 매 1년 단위로 도래하는 계약해당일 전일까지의 기간".
//   따라서 이제는 중립 표현이 아니라 **계약일·계약해당일 기준을 명시**해야 한다.
//   역년 단정 금지는 그대로 유지한다(약관이 역년을 배제하므로 더 강한 근거가 생겼다).
for (const banned of [
  "올해 기존 중증 비급여 자기부담금",
  "올해 이미 부담한 중증 비급여 입원 자기부담금",
  "1월 1일부터",
  "역년 기준으로",
]) {
  check(`5세대 UI: 역년 단정 문구 "${banned}" 없음`, !gen5.includes(banned));
}
check("5세대 UI: 자기부담 상한 기간을 계약일·계약해당일 기준으로 명시",
  gen5.includes("계약일 또는 매년 계약해당일부터 1년"));
check("5세대 UI: 근거 조항 표시", gen5.includes("특별약관1 제5조"));
// 기산점이 확정되었으므로 "약관을 확인하라"는 보류 안내는 더 이상 쓰지 않는다.
check("5세대 UI: 낡은 보류 안내 제거", !gen5.includes("기산점은 가입하신 상품의 약관을 확인"));

// 통원 가입금액은 약관상 20만원 "이내에서 계약자가 선택한 금액"이라 상수로 단정하지 않는다.
check("5세대 UI: 통원 가입금액은 계약 시 정한 금액임을 명시", gen5.includes("계약 시 정한 금액"));
check("5세대 UI: 미입력 시 미적용", gen5.includes("입력하지 않으면 적용하지 않"));
// 0원을 실제 한도로 조용히 적용하지 않는다는 정책이 화면에도 드러나야 한다.
check("5세대 UI: 0원은 미입력 처리 안내", gen5.includes("0원을 입력해도 미입력으로 처리"));
check("5세대 다회 UI: 연간 가입금액도 계약 시 정한 금액임을 명시", gen5Multi.includes("이내에서 계약 시 정한 금액"));

// 다회 화면도 같은 근거 수준을 유지한다.
// "역년 기준이 아닙니다" 같은 부정문은 오히려 지켜야 할 문구이므로, 단정형만 금지한다.
for (const banned of ["올해", "1월 1일부터", "역년 기준으로"]) {
  check(`5세대 다회 UI: 역년 단정 문구 "${banned}" 없음`, !gen5Multi.includes(banned));
}
check("5세대 다회 UI: 역년 기준이 아님을 명시", gen5Multi.includes("역년 기준이 아닙니다"));
check("5세대 다회 UI: 연간 기준을 계약일·계약해당일로 명시",
  gen5Multi.includes("계약일 또는 매년 계약해당일부터 1년"));
check("5세대 다회 UI: 낡은 보류 안내 제거", !gen5Multi.includes("약관상 누적기간"));
// 같은 날 통원은 약관이 1건으로 규정하므로 합산 입력을 안내해야 한다(미지원 고지가 아니라).
// ⚠ "합쳐 입력" 문구가 있는지만 보면 조건 누락을 통과시킨다(2026-09-03 실행에서 확인).
//    약관은 중증에 조건을 달고 있으므로, 조건과 예외까지 화면에 있어야 한다.
//    중증 합산 조건은 단건·다회 화면 양쪽에서 강제한다.
const SAME_DAY_CONDITIONS: [string, string][] = [
  ["동일한 의료기관", "동일 의료기관 조건"],
  ["같은 치료를 목적으로", "같은 치료 목적 조건"],
  ["치료 목적이 다르거나 다른 의료기관이면", "합산 대상이 아닌 경우의 예외"],
];
for (const [needle, label] of SAME_DAY_CONDITIONS) {
  check(`5세대 단건 UI: 중증 합산 안내에 ${label}`, gen5.includes(needle));
  check(`5세대 다회 UI: 중증 합산 안내에 ${label}`, gen5Multi.includes(needle));
}
check("5세대 다회 UI: 같은 날 통원 합산 입력 안내", gen5Multi.includes("한 행으로 합쳐 입력"));
// 조건 없이 "같은 날이면 무조건 합치라"고 읽히는 문구가 되돌아오지 않아야 한다.
for (const banned of ["모든 같은 날", "같은 날이면 무조건"]) {
  check(`5세대 UI: 무조건 합산 지시 "${banned}" 없음`, !gen5.includes(banned) && !gen5Multi.includes(banned));
}
check("5세대 다회 UI: 미지원 고지 제거", !gen5Multi.includes("현재 지원하지 않습니다"));

const std = readFileSync("src/components/calculators/HealthCalcStandardized.tsx", "utf8");

// 2·3세대 UI: 표준형/선택형은 계약일로 추정하지 않는다는 규약이 문구로 남아 있어야 한다.
//   2012.12.28 세칙 개정의 시행일을 확인하지 못했고, 애초에 계약일이 아니라 가입 상품이 정하는 값이다.
check("2·3세대 UI: 증권 확인 안내", std.includes("보험증권의 상품명·가입내역에서 확인"));
check("2·3세대 UI: 가입 시기로 추정하지 않음을 명시", std.includes("가입 시기로 추정하지 않습니다"));
// 회(건)당 가입금액은 계약자가 정하는 값이라 기본값을 넣어 단정하지 않는다.
check("2·3세대 UI: 회(건)당 가입금액은 미입력 시 미적용", std.includes("입력하지 않으면 적용하지 않습니다"));
// 하루 중복방문을 1회로 합쳐 입력하라는 약관 규정 안내가 있어야 한다(날짜 축을 두지 않는 근거).
check("2·3세대 UI: 하루 중복방문 합산 입력 안내", std.includes("한 행으로 합쳐"));

const layout = readFileSync("src/app/layout.tsx", "utf8");
const guides = readFileSync("src/lib/guides.ts", "utf8");
const healthPage = readFileSync("src/app/health-insurance-calculator/page.tsx", "utf8");
const carPage = readFileSync("src/app/car-insurance-calculator/page.tsx", "utf8");
const carCalc = readFileSync("src/components/calculators/CarCalc.tsx", "utf8");

// H-3: 링크와 사이트 제목이 실제 제공 기능보다 넓은 계산을 약속하지 않는다.
check("H-3: 사이트 제목이 자동차보험·보험료 산출을 약속하지 않음",
  !layout.includes("실손·자동차·보험료 무료 계산"));
check("H-3: 가이드 링크는 보험료 비중 계산기로 표시", guides.includes('calcLabel: "보험료 비중 계산기"'));
check("H-3: 가이드 링크는 자동차보험 견적 비교로 표시", guides.includes('calcLabel: "자동차보험 견적 비교 계산기"'));
check("H-3: 실손 페이지 내부 링크도 실제 기능명 사용",
  healthPage.includes("보험료 비중 계산기") && healthPage.includes("자동차보험 견적 비교 계산기"));

// H-4: ÷12는 연간 견적을 월 단위로 단순 환산한다는 전제를 화면에서 밝힌다.
check("H-4: 자동차 페이지가 연간 견적 입력을 명시", carPage.includes("연간 자동차보험 견적"));
check("H-4: 입력 라벨이 연간 견적 금액", carCalc.includes("연간 견적 금액 (원)"));
check("H-4: 월 환산 산식과 12개월 전제 표시", carCalc.includes("연간 차액 ÷ 12개월"));
check("H-4: 결과 안내가 1년치 견적 전제 표시", carCalc.includes("1년치 자동차보험 견적을 전제로"));


// ── 문서(README) 과잉 일반화 방지 ───────────────────────────────────
// 화면 문구만 지키고 README가 "같은 날이면 무조건 합산"으로 뭉뚱그리면 같은 오해가 남는다.
const readme = readFileSync("README.md", "utf8");
for (const banned of [
  "같은 날 통원은 약관이 1건으로 규정하므로",
  "같은 날 통원은 한 행으로 합쳐 입력합니다",
]) {
  check(`README: 무조건 합산 문구 "${banned}" 없음`, !readme.includes(banned));
}
check("README: 중증/비중증 합산 조건을 구분", readme.includes("중증과 비중증의 조건이 다릅니다"));
check("README: 중증 합산에 같은 치료 목적 조건", readme.includes("같은 치료를 목적으로"));
check("README: 중증 합산 예외 명시", readme.includes("치료 목적이 다르거나 다른 의료기관이면"));
check("README: 비중증은 1일당 기준 명시", readme.includes("통원 1일당(외래 및 처방·조제비 합산)"));
check("README: 연간 가입금액이 상해·질병 각 축임을 명시", readme.includes("상해비급여·질병비급여 각 축에 대해 따로"));

console.log(`\n[uiCopy] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
