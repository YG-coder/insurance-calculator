// UI 문구 가드.
// 계산 로직이 아니라 "사실을 단정하는 문구"가 근거 없이 되돌아오는 것을 막는다.
//
// 배경: 2026-08-24에는 5세대 중증 비급여 입원 자기부담 상한의 기산점이 미확정이어서
//       단정을 금지했다. 2026-09-03 별표15 2026.5.6 연혁본 특별약관1 제5조②·⑤를
//       직접 확인해 계약일·계약해당일 기준으로 확정했고, 현재는 그 근거가 UI에 남도록 검사한다.
//
// 이 테스트가 실패하면 문구를 되돌리기 전에 먼저 약관 근거가 확보됐는지 확인할 것.
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GeneralAnnualLimitHelp, RoomChargeMoneyHelp, ZeroLimitPolicy,
} from "../src/components/calculators/HealthCalcMulti2026";

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
    check(`5세대 ${name} UI: 치료유형 라벨 5종 노출`,
      src.includes("NON_BENEFIT_ITEMS") && src.includes("GEN2026_NON_BENEFIT_ITEM_LABEL"));
    check(`5세대 ${name} UI: 미선택 시 계산 차단 안내`,
      src.includes("치료유형을 먼저") && src.includes("선택 전에는 계산하지 않습니다"));
  }
  // 단건은 계산 자체를 삼항으로 막는다.
  // ⚠ 조건이 늘어도 깨지지 않게 **필요한 배제 조건이 게이트에 있는지**만 본다
  //   (G-11A가 같은 게이트에 두 금액의 무효 차단 `limits === null`을 덧붙였다).
  check("5세대 단건 UI: 치료유형 선택 전에는 계산하지 않음", /needsItem \|\| needsSeverity[\s\S]{0,80}\? null/.test(gen5));
  check("5세대 단건 UI: 치료유형이 엔진 입력으로 전달됨", /nonBenefitItem:\s*nonBenefitItem/.test(gen5));
  // ⚠ 다회는 2026-09-03 커밋 2에서 경로가 셋(일반 / 별도 보장종목 / 일반 경로 전환)으로 갈렸다.
  //    "삼항으로 null" 한 가지 형태를 강요하지 않고, **선택 전에는 어떤 엔진도 호출되지 않는지**를 본다.
  //    각 계산 진입 조건에 미선택 배제가 붙어 있어야 한다.
  // ⚠ 조건문 전체를 통째로 비교하면 조건이 하나 늘 때마다 깨진다. **필요한 배제 조건이
  //    계산 진입 게이트에 실제로 들어 있는지**를 조각으로 확인한다.
  // ⚠ 게이트 앞에 조건이 더 붙을 수 있다(G-9의 `money !== null`). 조건문 전체를 통째로
  //   비교하지 않고, `itemResult` 진입 if 블록의 **머리 부분**을 잡아 조각으로 확인한다.
  const specialGate = (gen5Multi.match(/if \([^{]*coverage === "non_benefit"[^{]*\{/) ?? [""])[0];
  check("5세대 다회 UI: 별도 보장종목 계산 게이트에 치료유형 배제",
    specialGate.includes("specialItem !== null"), specialGate);
  check("5세대 다회 UI: 별도 보장종목 계산 게이트에 질환 구분 배제",
    specialGate.includes('severity !== ""'), specialGate);
  check("5세대 다회 UI: 별도 보장종목 계산 게이트에 행 미완성 배제",
    specialGate.includes("!rowsIncomplete"), specialGate);
  const plainGate = (gen5Multi.match(/: [^?]*nonBenefitItem === "general"[\s\S]{0,140}\? calculateMany2026/) ?? [""])[0];
  check("5세대 다회 UI: 일반 비급여 계산 게이트에 치료유형 배제",
    plainGate.includes('nonBenefitItem === "general"'), plainGate);
  check("5세대 다회 UI: 일반 비급여 계산 게이트에 질환 구분 배제",
    plainGate.includes('severity !== ""'), plainGate);
  // ⚠ plainResult 앞에 진료비 게이트가 붙었다(2026-09-04 G-3). 한 줄 형태를 강요하지 않고
  //    **미선택·무효 입력이면 null로 끝나는지**와 급여 분기가 coverage로 갈리는지를 본다.
  check("5세대 다회 UI: 미선택이면 결과가 null",
    /: null;/.test(gen5Multi) && /const plainResult = [\s\S]{0,80}coverage === "benefit"/.test(gen5Multi));
  // ⚠ 계약 교체(G-13C): 급여 분기 게이트에 본인부담률 무효(`nhisRateInvalid`)가 더해졌다.
  //   진료비 게이트가 먼저라는 계약은 그대로다(둘 다 같은 조건식에서 `null`로 끝난다).
  check("5세대 다회 UI: 일반·급여 계산 진입 앞에 진료비·본인부담률 게이트",
    /const plainResult = amountsIncomplete \|\| nhisRateInvalid\s*\n\s*\? null/.test(gen5Multi));
  check("5세대 다회 UI: 별도 보장종목 계산 게이트에 행 진료비 배제",
    specialGate.includes("!rowAmountsIncomplete"), specialGate);
  // 선택값이 실제 엔진 입력으로 전달되는지 — 화면에만 있고 엔진이 받지 않으면 차단이 무의미하다.
  check("5세대 다회 UI: 치료유형이 경로 판정으로 전달됨",
    /routeOfGen2026Item\(severity, specialItem/.test(gen5Multi)
    && /nonBenefitItem: "general"/.test(gen5Multi));
  // 엔진에 넘기는 item 리터럴은 반드시 화면 선택값(specialItem, 주사료는 injectionPurpose)
  //   분기 안에서만 나와야 한다. 한 곳이라도 고정 리터럴로 박히면 선택과 계산이 어긋난다.
  {
    const literals = [...gen5Multi.matchAll(/item: "(musculoskeletal_esw|mri|injection)"/g)];
    check("5세대 다회 UI: 세 치료유형이 모두 엔진 입력으로 전달됨",
      new Set(literals.map((m) => m[1])).size === 3,
      literals.map((m) => m[1]).join(","));
    const unguarded = literals.filter((m) => {
      const before = gen5Multi.slice(Math.max(0, (m.index ?? 0) - 400), m.index ?? 0);
      return !before.includes(`specialItem === "${m[1]}"`)
        && !(m[1] === "injection" && /injectionPurpose (===|!==)/.test(before));
    });
    check("5세대 다회 UI: item 리터럴이 화면 선택값 분기 안에서만 나옴",
      unguarded.length === 0, unguarded.map((m) => m[0]).join(" | "));
  }
  check("5세대 다회 UI: 질환 구분이 엔진 입력으로 전달됨",
    /severity: "critical"/.test(gen5Multi) && /severity: "non_critical"/.test(gen5Multi) && /severity,/.test(gen5Multi));

  // 질환 구분(중증/비중증)도 기본 선택이 없어야 한다. 단건은 처음부터 null이었고,
  //   다회만 "critical"이 기본이라 두 화면의 정책이 어긋나 있었다.
  //   잘못 고르면 자기부담률 30% vs 50%, 연간 한도 5천만 vs 1천만으로 결과 차이가 크다.
  for (const [name, src] of [["단건", gen5], ["다회", gen5Multi]] as const) {
    check(`5세대 ${name} UI: 질환 구분 초기값이 미선택`,
      /useState<Severity \| (?:null>\(null\)|"">\(""\))/.test(src));
    check(`5세대 ${name} UI: 질환 구분이 "critical"로 자동 선택되지 않음`,
      !/useState<Severity[^>]*>\(\s*"critical"\s*\)/.test(src));
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

// ── 통원 가입금액의 빈 값·0원 설명 (G-24a) ──────────────────────────
//   ⚠ **낡은 계약 3건을 교체했다.** 종전 화면 문구는 "입력하지 않으면 적용하지 않으며,
//     0원을 입력해도 미입력으로 처리합니다"였고, 무효 안내는 "이 한도를 적용하지 않으려면
//     완전히 비워 두세요"였다. G-24가 명시적 `0`에 **미입력과 분리된 결과 안내**를 붙이면서
//     두 문구가 결과 화면과 어긋났다 — "미입력으로 처리"는 0을 미입력과 같다고 말하고,
//     "완전히 비워"는 비우는 것만이 미적용 방법이라고 말하는데, 실제로는 **둘 다 미적용**이고
//     **0만 결과 안내에 따로 표시**된다. 계산은 두 경우 모두 종전 그대로다.
//   ⚠ 단건·다회의 도움말·무효 안내·결과 안내가 **같은 말을 하는지**를 고정한다.
//   ⚠ **화면에 실제로 보이는 문장**으로 검사한다. 소스에는 `<b>` 태그와 줄바꿈, 그리고
//     이 결정을 설명하는 주석이 섞여 있어 소스 문자열을 그대로 찾으면 통과·실패가 모두
//     엉뚱해진다(주석이 옛 문구를 인용하기만 해도 금지형 검사가 걸린다).
const rendered = (src: string) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")   // JSX 주석
  .replace(/\/\*[\s\S]*?\*\//g, " ")         // 블록 주석
  .replace(/^\s*\/\/.*$/gm, " ")               // 줄 주석
  .replace(/<\/?b>/g, "")                       // 강조 태그
  .replace(/\{" "\}/g, " ")                     // JSX 공백 표현식
  .replace(/\s+/g, " ");
const gen5Text = rendered(gen5), gen5MultiText = rendered(gen5Multi);
const ZERO_OR_EMPTY = "완전히 비우거나 0원을 입력하면 계산기에서는 이 한도를 적용하지 않습니다.";
const ZERO_SHOWN = "0원을 입력한 경우 그 사실을 결과 안내에 따로 표시합니다.";
const countOf = (hay: string, needle: string) => hay.split(needle).length - 1;
check("5세대 단건 UI: 도움말과 무효 안내가 **둘 다** 빈 값과 0원을 함께 설명",
  countOf(gen5Text, ZERO_OR_EMPTY) === 2 && countOf(gen5Text, ZERO_SHOWN) === 2,
  `${countOf(gen5Text, ZERO_OR_EMPTY)} / ${countOf(gen5Text, ZERO_SHOWN)}`);
// ⚠ 이 자리는 아래 [G-25] 절의 **실제 렌더 검사**가 본다. 문구가 `ZeroLimitPolicy` 안으로
//   들어가 소스에는 통 문장이 남아 있지 않으므로, 소스 검사로는 확인할 수 없다.
check("5세대 다회 UI: 통원 가입금액 무효 안내가 정책 컴포넌트를 쓴다",
  /통원 가입금액[\s\S]{0,400}<ZeroLimitPolicy strong \/>/.test(gen5Multi));
// 옛 두 표현이 다시 등장하면 결과 안내와 어긋난다.
check("5세대 단건 UI: '0원을 입력해도 미입력으로 처리' 문구가 없다",
  !gen5Text.includes("0원을 입력해도 미입력으로 처리"));
// ⚠ 다회 안내에는 라벨과 "올바르게 입력해 주세요" 사이에 JSX 식(보장축 이름)이 끼어 있어
//   한 문장으로 이어 찾을 수 없다. 두 화면 모두 **"통원 가입금액"이 나오는 모든 자리**에서
//   뒤따르는 설명에 배타 표현이 없는지 본다.
for (const [label, txt] of [["단건", gen5Text], ["다회", gen5MultiText]] as [string, string][]) {
  const spots: number[] = [];
  for (let i = txt.indexOf("통원 가입금액"); i !== -1; i = txt.indexOf("통원 가입금액", i + 1)) spots.push(i);
  check(`5세대 ${label} UI: 통원 가입금액 설명이 화면에 있다`, spots.length > 0);
  const bad = spots.filter((i) => txt.slice(i, i + 400).includes("완전히 비워"));
  check(`5세대 ${label} UI: 통원 가입금액 설명에 '완전히 비워' 배타 표현이 없다`,
    bad.length === 0, bad.map((i) => txt.slice(i, i + 90)).join(" ||| "));
}
// ⚠ 0원의 약관상 의미는 화면에서도 단정하지 않는다 — 계산기의 처리만 말한다.
for (const banned of ["0원 가입은 무효", "0원 가입도 유효", "약관상 0원", "실제 한도가 0원",
  "0원은 미입력과 같", "0원은 법적으로"]) {
  check(`5세대 UI: 0원의 약관상 의미 단정 "${banned}" 없음`,
    !gen5Text.includes(banned) && !gen5MultiText.includes(banned));
}
check("5세대 다회 UI: 연간 가입금액도 계약 시 정한 금액임을 명시", gen5Multi.includes("이내에서 계약 시 정한 금액"));

// ── 연간 보험가입금액의 빈 값·0원 설명 (G-24b) ───────────────────────
//   ⚠ **낡은 계약을 교체했다.** 두 화면의 무효 안내가 "한도를 적용하지 않으려면 완전히 비워
//     두세요"라고 배타적으로 말했는데, 엔진은 숫자 `0`도 한도 미적용으로 처리하고
//     **미입력과 분리된 0원 전용 결과 안내**를 이미 낸다(5세대 G-21 · 4세대 G-18).
//     4세대 도움말의 "비우면 … 적용하지 않습니다"도 같은 배타 표현이었다.
//   ⚠ **상급병실료 폼은 예외다.** 5세대 다회의 무효 안내는 폼 게이트가 없어 일반 경로와
//     상급병실료 경로가 **함께 쓰고**, `roomCharge2026`에는 0원 전용 결과 안내가 아직 없다
//     (G-25 대상, 엔진 직접 호출로 실측). 그래서 "결과 안내에 따로 표시합니다"는
//     `showRoomChargeForm`이 아닐 때만 말한다 — **없는 표시를 있다고 말하지 않는다.**
const gen4Multi = readFileSync("src/components/calculators/HealthCalcMulti2021.tsx", "utf8");
const gen4MultiText = rendered(gen4Multi);
// ⚠ **파일 안에 한 번이라도 있으면 통과**하는 검사는 한 자리가 지워져도 잡지 못한다
//   (변조 ④에서 실제로 통과했다). 각 자리를 **앞 문장까지 붙인 앵커**로 따로 고정한다.
const HELP_ANCHOR = "입원과 통원은 이 축 안에서 합산합니다. ";
const INVALID_ANCHOR = "50,000,000 형식입니다. ";
check("4세대 다회 UI: 연간 가입금액 **도움말**이 빈 값과 0원을 함께 설명",
  gen4MultiText.includes(`${HELP_ANCHOR}${ZERO_OR_EMPTY} ${ZERO_SHOWN}`));
check("4세대 다회 UI: 연간 가입금액 **무효 안내**가 빈 값과 0원을 함께 설명",
  gen4MultiText.includes(`${INVALID_ANCHOR}${ZERO_OR_EMPTY} ${ZERO_SHOWN}`));
// ── 5세대 다회의 네 자리는 **실제 렌더**로 본다 (G-25) ───────────────
//   ⚠ **낡은 계약 3건을 교체했다.** ①일반 폼 도움말의 소스 앵커 검사(`HELP_ANCHOR` +
//     두 문장)는 그 문구가 컴포넌트로 빠지면서 근거가 사라졌다 — 아래 렌더 검사가 대신한다.
//     ②G-24b에서는 `ZeroLimitPolicy`가 `withZeroNotice`로 갈려 일반 폼은 두 문장,
//     상급병실료 폼은 첫 문장만 냈다. `roomCharge2026`에 0원 전용 결과 안내가 없어
//     **없는 표시를 약속하지 않으려는** 임시 조치였고, G-25가 그 안내를 신설해 조건이
//     사라졌다. ③따라서 "상급병실료 폼은 첫 문장만"이라는 고정도 폐기한다.
//   ⚠ 소스 문자열 검사는 **실제 렌더 검사가 아니다.** 아래에서 renderOf로 만든 값만 실제
//     렌더이고, 그 뒤 정규식 검사는 "화면이 그 컴포넌트를 쓰는가"를 보는 **구조 검사**다.
const renderOf = <P extends object>(
  component: (props: P) => ReturnType<typeof createElement>, props: P,
) => renderToStaticMarkup(createElement(component, props))
  .replace(/<\/?b>/g, "").replace(/\s+/g, " ").trim();
const policyStrong = renderOf(ZeroLimitPolicy, { strong: true });
const policyPlain = renderOf(ZeroLimitPolicy, {});
check("5세대 다회 렌더: 0원 정책 문장이 두 문장 모두 나온다",
  policyStrong === `${ZERO_OR_EMPTY} ${ZERO_SHOWN}`, policyStrong);
check("5세대 다회 렌더: strong 프롭은 표시 강조일 뿐 문장을 바꾸지 않는다",
  policyPlain === policyStrong, `${policyPlain} ||| ${policyStrong}`);
// 경로별 도움말을 **각각 렌더해** 두 문장이 모두 나오는지 본다.
const generalHelp = renderOf(GeneralAnnualLimitHelp, { maxLabel: "1천만", axisLabel: "질병비급여" });
const roomHelp = renderOf(RoomChargeMoneyHelp, { maxLabel: "1천만" });
check("5세대 다회 렌더: 일반 폼 도움말에 **두 문장 모두** 나온다",
  generalHelp.includes(`${HELP_ANCHOR}${ZERO_OR_EMPTY} ${ZERO_SHOWN}`), generalHelp);
check("5세대 다회 렌더: 상급병실료 폼 도움말에도 **두 문장 모두** 나온다",
  roomHelp.includes(`${ZERO_OR_EMPTY} ${ZERO_SHOWN}`), roomHelp);
check("5세대 다회 렌더: 상급병실료 도움말이 첫 문장만 내던 옛 형태가 아니다",
  !roomHelp.includes(`${ZERO_OR_EMPTY} 상급병실료 차액은`), roomHelp);
check("5세대 다회 렌더: 상급병실료 도움말의 나머지 설명은 그대로다",
  roomHelp.startsWith("약관은 1천만 원 이내에서 계약 시 정한 금액으로 규정합니다.")
  && roomHelp.includes("상급병실료 차액은 (1)(2) 표 안의 한 행이라 일반 입원·통원과 같은 연간 보험가입금액을 공유합니다."), roomHelp);
check("5세대 다회 렌더: 세 자리 모두 배타 표현이 없다",
  ![policyStrong, generalHelp, roomHelp].some((t) => /완전히 비워|비우면/.test(t)));
// 구조 검사 — 화면이 그 컴포넌트를 네 자리에서 실제로 쓰는가, 경로 조건이 남아 있지 않은가.
check("5세대 다회 구조: 두 도움말이 각자의 컴포넌트를 쓴다",
  /<GeneralAnnualLimitHelp maxLabel=\{severity === "critical" \? "5천만" : "1천만"\} axisLabel=\{generalAxisLabel\(generalAxis\)\} \/>/.test(gen5Multi)
  && /<RoomChargeMoneyHelp maxLabel=\{severity === "critical" \? "5천만" : "1천만"\} \/>/.test(gen5Multi));
check("5세대 다회 구조: 두 무효 안내가 같은 정책 컴포넌트를 쓴다",
  (gen5Multi.match(/<ZeroLimitPolicy strong \/>/g) ?? []).length === 2);
// ⚠ 주석이 옛 프롭 이름을 **설명으로** 인용하는 것은 정상이다. 주석을 걷어낸 코드에서 본다.
const gen5MultiCode = gen5Multi
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
check("5세대 다회 구조: 0원 문장을 경로로 끄는 조건이 남아 있지 않다",
  !/withZeroNotice/.test(gen5MultiCode) && !/ZeroLimitPolicy[^/]*showRoomChargeForm/.test(gen5MultiCode));
for (const [label, txt] of [["5세대 다회", gen5MultiText],
  ["4세대 다회", gen4MultiText]] as [string, string][]) {
  // 옛 배타 표현이 이 필드 주변에 없다.
  const spots: number[] = [];
  for (let i = txt.indexOf("연간 보험가입금액"); i !== -1; i = txt.indexOf("연간 보험가입금액", i + 1)) spots.push(i);
  for (let i = txt.indexOf("연간 가입금액"); i !== -1; i = txt.indexOf("연간 가입금액", i + 1)) spots.push(i);
  check(`${label} UI: 연간 가입금액 설명에 배타 표현이 없다`,
    spots.length > 0 && !spots.some((i) => /완전히 비워|비우면/.test(txt.slice(i, i + 400))),
    spots.filter((i) => /완전히 비워|비우면/.test(txt.slice(i, i + 400))).map((i) => txt.slice(i, i + 80)).join(" ||| "));
}
// 화면이 "결과 안내에 따로 표시한다"고 말하는 근거는 **엔진에 그 안내가 있다는 사실**이다.
const engRoom = readFileSync("src/lib/insurance/engine/roomCharge2026.ts", "utf8");
check("상급병실료 엔진: 0원 전용 결과 안내가 있다(화면 문구의 근거)",
  engRoom.includes("연간 보험가입금액을 0원으로 입력하셔서 계산기에서는 연간 지급 한도를 적용하지 않았습니다. 실제 가입금액이 있으면 증권의 금액을 입력해 주세요."));
check("상급병실료 엔진: 미입력 안내가 그대로 남아 있다",
  engRoom.includes("연간 보험가입금액을 입력하지 않아 적용하지 않았습니다. 증권에서 확인한 값을 입력하면 지급 한도로 반영됩니다."));
// 엔진의 0원 전용 결과 안내가 그대로 있어야 화면 설명이 참이 된다.
const eng2026 = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
const eng2021 = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
const ENGINE_ZERO = "연간 보험가입금액을 0원으로 입력하셔서 계산기에서는 연간 지급 한도를 적용하지 않았습니다. 실제 가입금액이 있으면 증권의 금액을 입력해 주세요.";
check("5세대 엔진: 연간 가입금액 0원 전용 결과 안내가 그대로", eng2026.includes(ENGINE_ZERO));
check("4세대 엔진: 연간 가입금액 0원 전용 결과 안내가 그대로", eng2021.includes(ENGINE_ZERO));
// 미입력 결과 안내와 0원 결과 안내는 서로 다른 문장이어야 한다.
check("5세대 엔진: 미입력 안내와 0원 안내가 구분된다",
  eng2026.includes("연간 보험가입금액도 계약자가 선택한 값이라 입력하지 않으면 적용하지 않습니다") && eng2026.includes(ENGINE_ZERO));
check("4세대 엔진: 미입력 안내와 0원 안내가 구분된다",
  eng2021.includes("증권의 금액을 입력하지 않아 연간 지급 한도는 적용하지 않았습니다") && eng2021.includes(ENGINE_ZERO));
// 0원의 약관상 의미는 두 화면에서도 단정하지 않는다.
for (const banned of ["0원 가입은 무효", "0원 가입도 유효", "약관상 0원", "실제 한도가 0원",
  "0원은 미입력과 같", "0원은 법적으로"]) {
  check(`4세대 다회 UI: 0원의 약관상 의미 단정 "${banned}" 없음`, !gen4MultiText.includes(banned));
}
// 다른 축의 문구는 건드리지 않았다.
check("5세대 다회 UI: 통원 가입금액 설명은 G-24a 그대로(같은 정책 문장을 쓴다)",
  policyStrong === `${ZERO_OR_EMPTY} ${ZERO_SHOWN}`);
check("5세대 단건 UI: 급여 본인부담률 안내는 그대로다(0%가 유효값이라 배타 표현이 맞다)",
  gen5Text.includes("건강보험 본인부담률을 올바르게 입력해 주세요") && gen5Text.includes("모르면 완전히 비워 두세요"));

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
// ⚠ G-24b 범위 밖 확인 — 2·3세대의 회(건)당 가입금액은 그 엔진에 0원 전용 결과 안내가
//   **없어서** 배타 표현이 사실과 맞다. 이 커밋이 잘못 건드리지 않았는지 본다.
check("2·3세대 UI: 회(건)당 가입금액 안내는 그대로다(그 엔진에는 0원 전용 안내가 없다)",
  rendered(std).includes("이 한도를 적용하지 않으려면 완전히 비워 두세요")
  && !readFileSync("src/lib/insurance/engine/generationStandardized.ts", "utf8").includes("0원으로 입력하셔서"));

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
  // ── G-14A — 500만 원 상한의 적용 범위 HOLD가 문서에서 사라지거나 단정으로 바뀌지 않게 ──
  {
    const row = current.split("\n").find((line) => line.includes("500만 원 공제금액 상한의 적용 범위")) ?? "";
    check("audit-status §3.2: 공유 범위 HOLD 행 존재", row.length > 0);
    check("audit-status §3.2: 확정된 것을 적음",
      row.includes("입원 한정") && row.includes("상급종합병원·종합병원 한정")
      && row.includes("MRI는 포함"));
    check("audit-status §3.2: 미확정이 '합산 범위'임을 적음", row.includes("하나로 합산해"));
    check("audit-status §3.2: 못 찾은 자료를 '없다'로 바꾸지 않음",
      row.includes("존재하지 않는다고 단정하지 않는다"));
    check("audit-status §3.2: 판매약관 접근 한계를 적음", row.includes("조문 전문에는 접근하지 못했다"));
    check("audit-status §3.2: 게이트가 아님을 적음", row.includes("게이트가 아니다"));
    for (const banned of ["약관상 하나의 pool이다", "약관상 독립", "서로 독립이다"]) {
      check(`audit-status §3.2: 단정 표현 없음 "${banned}"`, !row.includes(banned));
    }
    // ⚠ 특약1 제5조는 ①~⑤뿐이다(2026-09-05 직독: ⑤ 다음이 곧바로 제6조).
    //    없는 항을 문서가 인용하면 근거가 통째로 어긋난다.
    //    ⚠ "제6항"을 통째로 금지하면 안 된다 — 제3조 (3)비급여 자기공명영상진단 제6항은
    //      실재하고 문서가 정당하게 인용한다. **제5조 뒤에 붙는 경우만** 막는다.
    //      조항명 괄호와 줄바꿈이 사이에 낄 수 있으므로 그것까지 허용해 잡는다.
    const GHOST_ART = /제5조(?:\(보험가입금액 한도 등\))?[\s\n]*(?:제6항|제7항|⑥|⑦)/;
    const design0 = readFileSync("docs/insurance/multi-claim-design.md", "utf8");
    for (const [label, text] of [["audit-status", auditStatus], ["multi-claim-design", design0], ["README", readmeDoc]] as const) {
      check(`${label}: 특약1 제5조에 없는 항을 인용하지 않음`,
        !GHOST_ART.test(text), (text.match(GHOST_ART) ?? [""])[0]);
    }
    check("audit-status: 500만 원 상한 근거가 제5조⑤임을 명시", auditStatus.includes("제5조⑤(인쇄 p.280)"));
    check("multi-claim-design: 500만 원 상한 근거가 제5조 제5항임을 명시",
      design0.includes("제5조(보험가입금액 한도 등)\n제5항**, 인쇄 p.280"));
    check("audit-status: 7.15 시행본 별표 식별번호 기록", auditStatus.includes("3265643"));
    check("audit-status: 대조와 근거를 섞지 않음을 명시",
      auditStatus.includes("규칙 출처는 5.6본 주소만"));
    const design = readFileSync("docs/insurance/multi-claim-design.md", "utf8");
    check("multi-claim-design: G-14A 절 존재", design.includes("### 5.20") && design.includes("G-14A"));
    check("multi-claim-design: G-14B를 범위 밖으로 남김", design.includes("G-14B"));
  }

  // ── G-14B 정정(2026-09-05) — 두 축의 위험 방향이 다시 뭉개지지 않게 ──
  //   초판은 "둘 다 과다 산출"이라고 적었다. 공제 pool 축은 반대(과소 산출)다.
  //   d758bba는 이미 푸시돼 커밋 메시지를 고칠 수 없으므로 문서에 정정 이력을 남겼다.
  {
    const design1 = readFileSync("docs/insurance/multi-claim-design.md", "utf8");
    const g14b = design1.slice(design1.indexOf("### 5.21"));
    const row = (label: string) => (g14b.split("\n").find((l) => l.includes(label)) ?? "");
    const poolRow = row("`priorAnnualInpatientDeductible` (500만 원 pool)");
    const countRow = row("`priorAnnualCoveredCount` (연 50회)");
    check("§5.21: pool 행이 '증가 → 과소 산출'로 적힘",
      poolRow.includes("보험금 **증가**") && poolRow.includes("**과소 산출**")
      && !poolRow.includes("**과다 산출**"), poolRow.slice(0, 120));
    check("§5.21: 횟수 행이 '감소 → 과다 산출'로 적힘",
      countRow.includes("보험금 **감소**") && countRow.includes("**과다 산출**")
      && !countRow.includes("**과소 산출**"), countRow.slice(0, 120));
    check("§5.21: 두 행의 방향이 서로 다름",
      poolRow.includes("**증가**") !== countRow.includes("**증가**"));
    check("§5.21: 두 축의 방향이 반대임을 명시", g14b.includes("위험 방향은 서로 반대"));
    check("§5.21: 초판을 '둘 다 과다'로 되돌리지 않음",
      !g14b.includes('"이미 4,900,000 썼다"·"이미 50회 썼다" → \n  "한 번도 안 썼다"라 **보험금 과다 산출** 쪽이다'));
    check("§5.21: 정정 이력을 남김",
      g14b.includes("정정 이력") && g14b.includes("d758bba") && g14b.includes("커밋\n메시지는 고칠 수 없으므로"));
    check("§5.21: priorAnnualPaid를 금액 방향 없이 기록",
      g14b.includes("priorAnnualPaid`의 조용한 폐기")
      && g14b.includes("금액 방향(과다·과소)을 붙이지 않는다")
      && g14b.includes("아무 말 없이 버리는 것"));
    const auditG14b = auditStatus.slice(auditStatus.indexOf("### 별도 보장종목 진입점의 두 입력 축"));
    check("audit-status G-14B: 두 축의 방향이 반대임을 명시", auditG14b.includes("위험 방향은 서로 반대"));
    check("audit-status G-14B: 정정 이력을 남김",
      auditG14b.includes("정정 이력(2026-09-05)") && auditG14b.includes("d758bba"));
    check("audit-status G-14B: priorAnnualPaid를 금액 방향 없이 기록",
      auditG14b.includes("priorAnnualPaid`의 조용한 폐기")
      && auditG14b.includes("금액 방향을 단정하지 않는다"));
  }

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
