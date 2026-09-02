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
const gen5Multi = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
const site = readFileSync("src/lib/site.ts", "utf8");
const gen4Page = readFileSync("src/app/health-insurance-calculator/page.tsx", "utf8");
const healthGuides = readFileSync("src/lib/guides.ts", "utf8");
const footer = readFileSync("src/components/Footer.tsx", "utf8");
const disclaimer = readFileSync("src/app/disclaimer/page.tsx", "utf8");
const about = readFileSync("src/app/about/page.tsx", "utf8");

check("4세대 계산기: 홈 카드가 세대를 명시", site.includes('title: "4세대 실손보험 자기부담금 계산기"'));
check("4세대 계산기: 페이지 제목이 세대를 명시", gen4Page.includes("4세대 실손보험 자기부담금 계산기"));
check("4세대 계산기: 가이드 링크가 세대를 명시", healthGuides.includes('calcLabel: "4세대 실손보험 자기부담금 계산기"'));
check("실손 계산기: 푸터가 2·3·4·5세대를 각각 명시", ["2·3세대 실손보험 계산기", "4세대 실손보험 계산기", "5세대 실손보험 계산기"].every((label) => footer.includes(label)));
check("4세대 계산기: 면책 페이지 링크가 세대를 명시", disclaimer.includes("4세대 실손보험 계산기"));
check("실손 계산기: 소개 페이지가 2·3·4·5세대를 모두 명시", about.includes("2·3·4·5세대"));
check("4세대 계산기: 세대 없는 옛 링크 라벨 없음", !/>\s*실손보험 계산기\s*</.test(footer) && !/>\s*실손보험 계산기\s*</.test(disclaimer));
check("4세대 계산기: 가이드 본문에 세대 없는 옛 명칭 없음", !/(?<!4세대 )실손보험 자기부담금 계산기(?:로|를)/.test(healthGuides));

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

// 다회 청구 화면도 동일한 근거 수준을 유지해야 한다. 단건 화면만 보호하면
// 새 화면에서 역년 또는 계약해당일을 다시 단정할 수 있다.
for (const banned of ["올해", "계약해당일부터 누적", "계약일부터 누적"]) {
  check(`5세대 다회 UI: 근거 없는 기산점 문구 "${banned}" 없음`, !gen5Multi.includes(banned));
}
check("5세대 다회 UI: 누적 범위를 '약관상 누적기간'으로 한정", gen5Multi.includes("약관상 누적기간"));
check("5세대 다회 UI: 기산점은 가입 상품 약관 확인 안내", gen5Multi.includes("누적기간의 기산점은 가입 상품 약관을 확인"));
check("5세대 다회 UI: 역년·계약해당일 추정 금지", gen5Multi.includes("역년이나 계약해당일로 추정하지 않습니다"));
check("5세대 다회 UI: 같은 날 통원 합산을 지시하지 않음", !gen5Multi.includes("같은 날") || !gen5Multi.includes("합쳐 입력"));

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

console.log(`\n[uiCopy] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
