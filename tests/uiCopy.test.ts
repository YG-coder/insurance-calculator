// UI 문구 가드.
// 계산 로직이 아니라 "사실을 단정하는 문구"가 근거 없이 되돌아오는 것을 막는다.
//
// 배경: 2026-08-24에는 5세대 중증 비급여 입원 자기부담 상한의 기산점이 미확정이어서
//       단정을 금지했다. 2026-09-03 별표15 2026.5.6 연혁본 특별약관1 제5조②·⑤를
//       직접 확인해 계약일·계약해당일 기준으로 확정했고, 현재는 그 근거가 UI에 남도록 검사한다.
//
// 이 테스트가 실패하면 문구를 되돌리기 전에 먼저 약관 근거가 확보됐는지 확인할 것.
import { readFileSync, readdirSync } from "node:fs";

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

// ── 5세대 비급여 치료유형 안전 차단 (2026-09-03) ───────────────────
// 근거: 별표15 특별약관1 제3조 (2)①("3대비급여는 제외"), 특별약관2 제3조 (1)①
//       ("비급여 자기공명영상진단은 제외"), 특약1·2 입원 표("비급여 병실료는 제외").
// 화면이 이 네 항목을 일반 경로로 계산하도록 유도하면 잘못된 보험금이 표시된다.
{
  // 기본값이 "general"이면 사용자가 인식하지 못한 채 계산된다 — 반드시 미선택이어야 한다.
  for (const [name, src] of [["단건", gen5], ["다회", gen5Multi]] as const) {
    check(`5세대 ${name} UI: 치료유형 초기값이 미선택`,
      /useState<Gen2026NonBenefitItem \| (?:null>\(null\)|"">\(""\))/.test(src), src.slice(0, 0));
    check(`5세대 ${name} UI: 치료유형이 "general"로 자동 선택되지 않음`,
      !/useState<[^>]*>\(\s*"general"\s*\)/.test(src));
    check(`5세대 ${name} UI: 치료유형 선택 전에는 계산하지 않음`,
      /needsItem[\s\S]{0,40}\? null/.test(src));
    check(`5세대 ${name} UI: 치료유형 라벨 5종 노출`,
      src.includes("NON_BENEFIT_ITEMS") && src.includes("GEN2026_NON_BENEFIT_ITEM_LABEL"));
    check(`5세대 ${name} UI: 미선택 시 계산 차단 안내`,
      src.includes("치료유형을 먼저") && src.includes("선택 전에는 계산하지 않습니다"));
    // 입력이 실제 엔진에 전달되는지 — 화면에 선택지만 있고 엔진이 받지 않으면 차단이 무의미하다.
    check(`5세대 ${name} UI: 치료유형이 엔진 입력으로 전달됨`, /nonBenefitItem:\s*nonBenefitItem/.test(src));
  }

  // 질환 구분(중증/비중증)도 기본 선택이 없어야 한다. 단건은 처음부터 null이었고,
  //   다회만 "critical"이 기본이라 두 화면의 정책이 어긋나 있었다.
  //   잘못 고르면 자기부담률 30% vs 50%, 연간 한도 5천만 vs 1천만으로 결과 차이가 크다.
  for (const [name, src] of [["단건", gen5], ["다회", gen5Multi]] as const) {
    check(`5세대 ${name} UI: 질환 구분 초기값이 미선택`,
      /useState<Severity \| (?:null>\(null\)|"">\(""\))/.test(src));
    check(`5세대 ${name} UI: 질환 구분이 "critical"로 자동 선택되지 않음`,
      !/useState<Severity[^>]*>\(\s*"critical"\s*\)/.test(src));
    // ⚠ 변수 존재만 보면 게이트에서 빠져도 통과한다. 결과를 null로 만드는
    //    분기에 실제로 연결돼 있는지까지 본다.
    check(`5세대 ${name} UI: 질환 구분 선택 전에는 계산하지 않음`,
      /needsItem \|\| needsSeverity[\s\S]{0,40}\? null/.test(src));
    check(`5세대 ${name} UI: 미선택 시 질환 구분 선택 안내`,
      src.includes("질환 구분을 선택해 주세요"));
  }
  // 다회는 select라서 빈 옵션이 실제로 있어야 미선택이 표현된다.
  // ⚠ select 태그 안에 화살표 함수(=>)가 있어 [^>]* 로는 태그 끝을 잡지 못한다.
  //    "질환 구분"부터 </select>까지를 잘라 그 안에 빈 옵션이 있는지 본다.
  const severitySelect = gen5Multi.slice(
    gen5Multi.indexOf("질환 구분<select"),
    gen5Multi.indexOf("</select>", gen5Multi.indexOf("질환 구분<select")),
  );
  check("5세대 다회 UI: 질환 구분에 빈 선택지 존재",
    severitySelect.includes('<option value="">'), severitySelect.slice(0, 120));
  check("5세대 다회 UI: 질환 구분에 따라 문구가 달라지는 블록은 선택 후에만 노출",
    (gen5Multi.match(/severity !== ""/g) ?? []).length >= 3,
    String((gen5Multi.match(/severity !== ""/g) ?? []).length));

  // 결과 안내는 엔진이 만든 사유를 그대로 보여준다(화면에서 지어내지 않는다).
  check("5세대 단건 UI: PENDING 사유를 엔진 notes로 표시",
    gen5.includes("{result.notes.join(\" \")}"));
  check("5세대 단건 UI: 급여 통원 사유를 모든 PENDING에 붙이지 않음",
    !gen5.includes("급여 통원 계산에 필요한 건강보험 본인부담률을 입력해 주세요."));

  // 공개 페이지가 네 항목의 미지원 범위를 밝힌다("참고용" 일반 면책으로 대신하지 않는다).
  for (const label of ["근골격계 이학요법·체외충격파", "비급여 주사료", "비급여 MRI", "상급병실료 차액"]) {
    check(`5세대 페이지: 미지원 항목 "${label}" 명시`, gen5Page.includes(label));
  }
  check("5세대 페이지: 중증 3대비급여가 일반 보장종목에서 제외됨을 명시",
    gen5Page.includes("3대비급여") && gen5Page.includes("명시적으로 제외"));
  check("5세대 페이지: 비중증 MRI가 별도 보장종목임을 명시",
    gen5Page.includes("비중증의 비급여 자기공명영상진단"));
  check("5세대 페이지: 상급병실료 별도 산식 명시",
    gen5Page.includes("비급여 병실료의 50%") && gen5Page.includes("1일 평균 10만 원 한도"));
  check("5세대 페이지: 현재 계산하지 않는다는 사실 명시", gen5Page.includes("현재 계산하지"));
  check("5세대 페이지: 계산 범위를 (1)(2) 보장종목으로 한정", gen5Page.includes("(1)상해비급여·(2)질병비급여"));

  // 낡은 안내 — 네 항목을 일반 경로로 계산해도 된다는 취지의 문구가 남으면 안 된다.
  for (const stale of [
    "도수치료·체외충격파·비급여 주사도 중증·비중증 구분만 선택하면",
    "MRI도 일반 비급여로 계산",
    "상급병실료도 입원 의료비에 합산해 입력",
  ]) {
    check(`5세대 페이지: 낡은 안내 "${stale}" 없음`, !gen5Page.includes(stale));
  }
}

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


// ── 문서의 낡은 HOLD 사유 전수 검사 (2026-09-03) ────────────────────
// 조사 결과 네 항목의 종전 사유는 모두 사실이 아니었다. 문서에 되살아나면
// "근거가 없어서 못 한다"는 잘못된 상태 설명으로 되돌아간다.
{
  const auditStatus = readFileSync("docs/insurance/audit-status.md", "utf8");
  const gen123Design = readFileSync("docs/insurance/insurance-gen123-engine-design.md", "utf8");
  const readmeDoc = readFileSync("README.md", "utf8");

  // 현재 상태 설명에서 금지. 과거 경위 서술은 §3.1에 따로 두고 그때만 인용부호로 남긴다.
  // 조사 전 사유. 넷은 feature 3종용, 뒤 셋은 할인·할증용이다.
  //   할인·할증은 2026-09-03 약관 직독으로 구간·요율이 확정돼, 종전 서술이 틀렸다.
  const STALE = ["시행세칙 공포 대기", "감독규정 확정 후", "판매약관 확인 필요", "자료 미발견",
    "등급 경계·할증률이 없다", "상품별 계산 수치가 전혀 없다", "4세대 제도 설명이며"];
  for (const [label, text] of [["README", readmeDoc], ["gen123 설계 문서", gen123Design]] as const) {
    for (const stale of STALE) {
      check(`${label}: 낡은 HOLD 사유 "${stale}" 없음`, !text.includes(stale));
    }
  }
  // audit-status는 경위(§3.1)에서 종전 사유를 인용하므로, 현재 상태 표(§3.2)에만 없으면 된다.
  const current = auditStatus.slice(auditStatus.indexOf("### 3.2"), auditStatus.indexOf("### 3.3"));
  // ⚠ 검사 대상은 feature/ 4종 행뿐이다. 같은 표의 2012.12.28 세칙 시행일 행은
  //    실제로 "부칙 미확인" 상태이므로 그 낱말을 금지하면 안 된다.
  const featureRows = current.split("\n").filter((line) => line.includes("`feature/`"));
  check(`audit-status §3.2: feature/ 행 4개 존재 (${featureRows.length})`, featureRows.length === 4);
  for (const stale of [...STALE, "미확인"]) {
    const hits = featureRows.filter((line) => line.includes(stale));
    check(`audit-status §3.2 feature/ 행: 낡은 사유 "${stale}" 없음`, hits.length === 0, hits.join(" / "));
  }
  check("audit-status: 경위와 현재 상태를 분리", auditStatus.includes("### 3.1") && auditStatus.includes("### 3.2"));
  // 진입점은 루트 README 하나. 이 문서가 '색인'으로 되돌아가면 혼동이 생긴다.
  check("audit-status: 제목이 상태 기록임을 밝힘", auditStatus.startsWith("# 보험 계산 엔진 — 감사 상태 기록"));
  check("audit-status: '색인'을 자칭하지 않음", !/^#[^\n]*색인/m.test(auditStatus));
  check("README: audit-status를 색인으로 소개하지 않음", !readmeDoc.includes("감사 최종 상태 색인"));

  // 항목별로 '확인된 근거'가 실제로 적혀 있어야 한다.
  check("audit-status: 발달장애의 '가입 당시 태아' 조건 명시", current.includes("가입 당시 태아"));
  check("audit-status: 발달장애 18세 한도 명시", current.includes("18세"));
  check("audit-status: 임신·출산 280일 조건 명시", current.includes("280일"));
  check("audit-status: 임신·출산 일부 본인부담금 명시", current.includes("일부 본인부담금"));
  check("audit-status: 비중증 제외항목 근거 조문 명시", current.includes("특별약관2 제4조"));
  check("audit-status: 할인·할증 감독규정 조문 명시", current.includes("제7-63조"));
  check("audit-status: 할인·할증이 보험료 영역임을 명시", current.includes("보험료 영역"));
  // 확정된 것을 "미확정"으로 되돌리지 않는다.
  check("audit-status: 할인·할증 5단계 구간과 요율이 확정됐음을 명시",
    current.includes("100·200·300·400%") && current.includes("특별약관2 제6조"));
  check("audit-status: 미확정은 1단계 할인율뿐임을 명시", current.includes("1단계 할인율"));
  check("audit-status: 95% 가정과 무사고 할인이 예시임을 명시",
    auditStatus.includes("예시상의 가정"));
  // 판본과 시행일 구분
  check("audit-status: 공포일과 시행일을 구분해 기록", auditStatus.includes("2026. 9. 10.") && auditStatus.includes("아직 시행 전"));
  check("audit-status: 현재 시행 중인 판본을 명시", auditStatus.includes("현재 시행 중"));
  check("audit-status: 할인·할증 해제 조건이 상품·보험사별 요율표", current.includes("요율표"));
  check("audit-status: 4세대 보도자료 구간을 전용하지 않음을 명시", auditStatus.includes("전용하지 않는다"));

  // 2026.8.28 현행본은 대조한 조문만 검증했다고 적혀 있어야 한다.
  check("audit-status: 2026.8.28 대조 범위를 조문 단위로 한정", auditStatus.includes("### 3.3") && auditStatus.includes("직접 눈으로 대조한 조문은 아래뿐"));
  // ⚠ "무변경" 낱말 자체를 금지하면 '무변경이라고 하지 않는다'는 문장까지 막힌다.
  //    금지 대상은 단정하는 형태(무변경이다 / 무변경임을 확인 / 무변경으로 확인)뿐이다.
  const affirmsUnchanged = auditStatus.match(/무변경(이다|임을 확인|으로 확인|이 확인)/g) ?? [];
  check("audit-status: 전체 무변경 단정 없음", affirmsUnchanged.length === 0, affirmsUnchanged.join(" / "));
  check("audit-status: 확대 해석 금지를 명시", /확대 해석하지 않(는다|습니다)/.test(auditStatus));
  check("audit-status: 쪽수 1쪽 이동 사실 기록", auditStatus.includes("1쪽씩"));

  // 진입점은 루트 README 하나. docs/ 안에 색인 문서를 새로 만들지 않는다.
  const docsFiles = readdirSync("docs/insurance").filter((f) => f.endsWith(".md")).sort();
  check(`docs/insurance 문서가 늘지 않음 (${docsFiles.length}개)`, docsFiles.length === 4, docsFiles.join(", "));
  check("docs/insurance에 중복 색인 문서 없음",
    !docsFiles.some((f) => /^(index|readme|목차|hold)/i.test(f)), docsFiles.join(", "));
}

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
