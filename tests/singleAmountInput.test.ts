// G-4 — 4·5세대 **단건** 진료비 입력의 엄격 검증.
//
// 종전 동작: 두 단건 모두 공용 `AmountInput` + `Number(amount.replace(/[^0-9]/g,"")) || 0`
//   경로였다. 위젯이 매 입력마다 숫자 아닌 문자를 **지우고** 15자리로 **자르며**, 파서는
//   실패를 0으로 바꾼다 — `-1`→**1**(부호를 지워 양수), `1.5`→**15**(10배), `1e3`→**13**,
//   `1,0`→**10**, `abc`·빈 값·`Infinity`→**0**, 안전 정수 초과→잘린 유효값.
//   그리고 두 화면 모두 **렌더마다 엔진을 무조건 호출**해 그 값으로 후보 결과를 만들었다.
//
// ⚠ 두 세대의 0원 정책은 **서로 다르고, 이번에 통일하지 않는다.**
//     4세대 — `num === 0`이면 "진료비를 1원 이상 입력해 주세요."로 거부(종전 정책).
//     5세대 — 안내 없이 결과만 숨긴다(`num > 0`, 종전 정책).
//   파서는 두 세대 모두 명시적 `0`을 **유효한 숫자**로 판정한다. 그 뒤 처리를 화면이 정한다.
// ⚠ 다회 계산기의 파서·게이트·위젯은 이번 범위가 아니다. 세대별 단건 전용 파서를 따로 둔다.
// ⚠ 5세대의 통원 가입금액·누적 공제금액은 진료비가 아니다. `AmountInput`과 종전 파싱 그대로.
// ⚠ 엔진·타입·규칙값·공제·한도, 별도 보장종목 차단과 다회 유도, 선택 게이트 3종은 무변경.
import { readFileSync } from "node:fs";
import HealthCalc from "../src/components/calculators/HealthCalc";
import HealthCalc5th from "../src/components/calculators/HealthCalc5th";
import RawAmountInput from "../src/components/RawAmountInput";
import { mount, stateNamesFrom, RenderedNode } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const P4 = "src/components/calculators/HealthCalc.tsx";
const P5 = "src/components/calculators/HealthCalc5th.tsx";
const ui4 = readFileSync(P4, "utf8");
const ui5 = readFileSync(P5, "utf8");
const names4 = stateNamesFrom(ui4);
const names5 = stateNamesFrom(ui5);
const stripComments = (src: string) =>
  src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

/** 소스의 파서를 그대로 실행한다(테스트가 규칙을 다시 쓰지 않는다). */
const parserFrom = (src: string, fmt: string, fn: string) => {
  const formatSrc = new RegExp(`const ${fmt} = .*;`).exec(src)?.[0] ?? "";
  const parserSrc = new RegExp(`const ${fn} = \\(v: string\\): number \\| null => \\{[\\s\\S]*?\\n\\};`).exec(src)?.[0] ?? "";
  return new Function(
    `${formatSrc}\n${parserSrc.replace(": string", "").replace(": number | null", "")}\nreturn ${fn};`,
  )() as (v: string) => number | null;
};
const parse4 = parserFrom(ui4, "GEN2021_SINGLE_AMOUNT_FORMAT", "gen2021SingleAmount");
const parse5 = parserFrom(ui5, "GEN2026_SINGLE_AMOUNT_FORMAT", "gen2026SingleAmount");

const BAD: [string, string][] = [
  ["빈 문자열", ""], ["공백", "   "], ["음수", "-1"], ["소수", "1.5"], ["끝소수점", "1."],
  ["선행 소수점", ".5"], ["소수점만", "."], ["잘못된 쉼표", "1,0"], ["쉼표 그룹 오류", "1,00,000"],
  ["선행 쉼표", ",300"], ["후행 쉼표", "300,"], ["문자", "abc"], ["지수 표기", "1e3"],
  ["NaN", "NaN"], ["Infinity", "Infinity"], ["부호+", "+1"], ["공백 섞임", "300 000"],
  ["안전 정수 초과", "9007199254740993"],
];
const GOOD: [string, string, number][] = [
  ["명시적 0", "0", 0], ["0 반복", "00", 0], ["정수", "300000", 300000],
  ["천 단위 쉼표", "300,000", 300000], ["백만 단위", "1,234,567", 1234567],
  ["선행 0", "0300000", 300000], ["안전 정수 최대", "9007199254740991", 9007199254740991],
];

type Comp = () => unknown;
const setup = (C: Comp, names: string[], over: Record<string, unknown> = {}) => {
  const h = mount(C, names);
  h.set("submitted", true);
  for (const [k, v] of Object.entries(over)) h.set(k, v);
  return h;
};
const screenOf = (h: ReturnType<typeof setup>) => {
  const s = h.render();
  return {
    s,
    calculated: s.resultItems() !== null,
    items: (s.resultItems() ?? []).map((i) => i.value),
    notices: s.nodes.filter((n: RenderedNode) => n.tag === "#NoticeBox"),
    raws: s.nodes.filter((n: RenderedNode) => n.tag === "#RawAmountInput"),
    amountWidgets: s.nodes.filter((n: RenderedNode) => n.tag === "#AmountInput"),
  };
};
const warnText = (h: ReturnType<typeof setup>) =>
  screenOf(h).notices.filter((n) => n.props.variant === "warning").map((n) => n.text).join(" | ");
const infoText = (h: ReturnType<typeof setup>) =>
  screenOf(h).notices.filter((n) => n.props.variant === "info").map((n) => n.text).join(" | ");
/** 위젯의 실제 onChange를 통과시킨다 — state 직접 주입이 아니다. */
const typeInto = (h: ReturnType<typeof setup>, id: string, typed: string) => {
  const n = h.render().nodes.find((x: RenderedNode) => x.tag === "#RawAmountInput" && x.props.id === id);
  if (n === undefined) throw new Error(`${id} 위젯을 찾지 못했습니다`);
  const tree = (RawAmountInput as unknown as (p: never) => { props: { children: unknown[] } })(n.props as never);
  ((tree.props.children as { props: { onChange: (e: unknown) => void } }[])[0])
    .props.onChange({ target: { value: typed } });
};

const GENS = [
  { g: "4세대", C: HealthCalc as unknown as Comp, names: names4, ui: ui4, id: "med-amount", parse: parse4,
    base: {} as Record<string, unknown>, want: ["300,000원", "90,000원", "100,000원", "200,000원"] },
  { g: "5세대", C: HealthCalc5th as unknown as Comp, names: names5, ui: ui5, id: "med5-amount", parse: parse5,
    base: { nonBenefitItem: "general", severity: "critical", visit: "inpatient", nbInpatientTier: "clinic" },
    want: ["300,000원", "90,000원", "90,000원", "210,000원"] },
] as const;

// ── 파서 ─────────────────────────────────────────────────────────────
console.log("\n[파서] 원문 형식을 먼저 판정한다");
for (const { g, parse, ui } of GENS) {
  for (const [what, v] of BAD) check(`${g}: ${what} → null`, parse(v) === null, String(parse(v)));
  for (const [what, v, want] of GOOD) check(`${g}: ${what} → ${want}`, parse(v) === want, String(parse(v)));
  check(`${g}: 쉼표를 형식 검증 뒤에만 제거한다`,
    /_SINGLE_AMOUNT_FORMAT\.test\(v\)\) return null;[\s\S]{0,80}replace\(\/,\/g/.test(ui));
  check(`${g}: 안전 정수를 자르지 않고 거부한다`,
    /Number\.isSafeInteger\(n\) && n >= 0 \? n : null;/.test(ui) && !/slice\(0, 15\)/.test(ui));
  check(`${g}: 검증 전에 정제하지 않는다(옛 경로가 없다)`,
    !/Number\(amount\.replace\(\/\[\^0-9\]\/g, ""\)\) \|\| 0/.test(stripComments(ui)));
}
check("두 단건 파서가 서로 다른 이름으로 분리돼 있다",
  /gen2021SingleAmount/.test(ui4) && !/gen2021SingleAmount/.test(ui5)
  && /gen2026SingleAmount/.test(ui5) && !/gen2026SingleAmount/.test(ui4));
check("단건이 다회 파서를 재사용하지 않는다",
  !/\bgen2021Amount\(|\bgen2026Amount\(|roomChargeAmount|stdAmount/.test(stripComments(ui4) + stripComments(ui5)));

// ── 위젯 ─────────────────────────────────────────────────────────────
console.log("\n[위젯] 진료비만 RawAmountInput이고 원문을 보존한다");
for (const { g, C, names, id, base } of GENS) {
  const h = setup(C, names, base);
  check(`${g}: 진료비가 RawAmountInput으로 렌더된다`,
    screenOf(h).raws.some((n) => n.props.id === id));
  for (const [what, v] of [...BAD, ...GOOD.map((x) => [x[0], x[1]] as [string, string])]) {
    typeInto(h, id, v);
    check(`${g}: ${what} 원문 보존`, (h.get("amount") as string) === v,
      JSON.stringify(h.get("amount")));
  }
}
check("4세대에는 진료비 외 AmountInput이 없다", !/AmountInput/.test(stripComments(ui4).replace(/RawAmountInput/g, "")));
{
  // 5세대의 가입금액·공제금액은 진료비가 아니다. 위젯도 파싱도 그대로 둔다.
  const h = setup(HealthCalc5th as unknown as Comp, names5,
    { nonBenefitItem: "general", severity: "critical", visit: "inpatient", nbInpatientTier: "hospital" });
  const w = screenOf(h);
  check("5세대: 누적 공제금액은 AmountInput 그대로",
    w.amountWidgets.some((n) => n.props.id === "med5-prior-annual-deductible")
    && !w.raws.some((n) => n.props.id === "med5-prior-annual-deductible"));
  const o = setup(HealthCalc5th as unknown as Comp, names5,
    { nonBenefitItem: "general", severity: "critical", visit: "outpatient" });
  check("5세대: 통원 가입금액은 AmountInput 그대로",
    screenOf(o).amountWidgets.some((n) => n.props.id === "med5-outpatient-limit"));
  check("5세대: 진료비만 RawAmountInput이다",
    screenOf(o).raws.every((n) => n.props.id === "med5-amount"));
}

// ── 화면 전이 ────────────────────────────────────────────────────────
console.log("\n[화면] 정상 → 무효 → 복구");
for (const { g, C, names, id, base, want } of GENS) {
  const h = setup(C, names, base);
  check(`${g}: 정상 금액으로 결과가 표시된다`,
    JSON.stringify(screenOf(h).items) === JSON.stringify(want), JSON.stringify(screenOf(h).items));
  for (const [what, v] of BAD) {
    typeInto(h, id, v);
    const scr = screenOf(h);
    check(`${g}: ${what} → 원문 유지·결과 숨김`,
      (h.get("amount") as string) === v && !scr.calculated);
    check(`${g}: ${what} → 형식 안내가 뜬다`, warnText(h).includes("올바르게 입력해 주세요"));
    check(`${g}: ${what} → 이전 결과·후보 금액이 남지 않는다`,
      scr.s.nodes.every((n: RenderedNode) => n.tag !== "#ResultCard"));
  }
  typeInto(h, id, "300000");
  check(`${g}: 정상값으로 고치면 계산이 재개된다`,
    JSON.stringify(screenOf(h).items) === JSON.stringify(want));
  typeInto(h, id, "300,000");
  check(`${g}: 300000과 300,000의 결과가 같다`,
    JSON.stringify(screenOf(h).items) === JSON.stringify(want));
  typeInto(h, id, "9007199254740993");
  check(`${g}: 안전 정수 초과가 절단되지 않고 거부된다`,
    (h.get("amount") as string) === "9007199254740993" && !screenOf(h).calculated);
}

// ── 0원 정책 — 세대별로 다르고, 통일하지 않는다 ──────────────────────
console.log("\n[0원] 빈 값과 명시적 0을 구분하고 세대별 기존 정책을 지킨다");
{
  const h4 = setup(HealthCalc as unknown as Comp, names4);
  typeInto(h4, "med-amount", "0");
  check("4세대: 명시적 0은 파서가 유효로 본다", parse4("0") === 0);
  check("4세대: 명시적 0 → 종전 '1원 이상' 안내 유지",
    !screenOf(h4).calculated && infoText(h4).includes("진료비를 1원 이상 입력해 주세요."));
  check("4세대: 명시적 0에 형식 경고를 만들지 않는다", warnText(h4) === "");
  typeInto(h4, "med-amount", "");
  check("4세대: 빈 값은 0원 안내가 아니라 형식 안내",
    !infoText(h4).includes("1원 이상") && warnText(h4).includes("올바르게 입력해 주세요"));
  check("4세대: 0원 안내 문구가 그대로다", /진료비를 1원 이상 입력해 주세요\./.test(ui4));

  const h5 = setup(HealthCalc5th as unknown as Comp, names5,
    { nonBenefitItem: "general", severity: "critical", visit: "inpatient", nbInpatientTier: "clinic" });
  typeInto(h5, "med5-amount", "0");
  check("5세대: 명시적 0은 파서가 유효로 본다", parse5("0") === 0);
  check("5세대: 명시적 0 → 결과만 숨기고 새 거부 안내를 만들지 않는다",
    !screenOf(h5).calculated && warnText(h5) === "" && !infoText(h5).includes("1원 이상"));
  check("5세대: 결과 표시의 0원 게이트가 그대로다",
    /result && result\.status === "OK" && num > 0/.test(ui5));
  check("5세대에 4세대식 0원 거부 문구를 넣지 않았다", !/1원 이상/.test(ui5));
  typeInto(h5, "med5-amount", "");
  check("5세대: 빈 값은 형식 안내", warnText(h5).includes("올바르게 입력해 주세요"));
}

// ── 엔진 진입 게이트 ─────────────────────────────────────────────────
console.log("\n[게이트] 무효 원문에서는 엔진을 호출하지 않는다");
{
  check("4세대: 엔진 호출이 파서 결과에 걸려 있다",
    /const result = parsed === null\s*\n\s*\? null\s*\n\s*: calculate\("2021"/.test(ui4));
  check("5세대: 엔진 호출이 파서 결과에 걸려 있다",
    /const result = amountInvalid\s*\n\s*\? null/.test(ui5));
  check("4세대: 무조건 호출하던 옛 줄이 없다",
    !/const result = calculate\("2021", \{ amount: num/.test(stripComments(ui4)));
  check("5세대: 무조건 호출하던 옛 줄이 없다",
    !/const result =\s*\n?\s*coverage === "benefit"\s*\n\s*\? calc2026/.test(stripComments(ui5)));
  // 5세대는 엔진이 차단 안내를 만든다. 진료비가 무효면 그 안내조차 나오면 안 된다.
  const mri = setup(HealthCalc5th as unknown as Comp, names5, { nonBenefitItem: "mri" });
  check("5세대: 유효 금액 + MRI → 별도 보장종목 차단 유지",
    warnText(mri).includes("비급여 MRI") && !screenOf(mri).calculated);
  typeInto(mri, "med5-amount", "abc");
  check("5세대: 무효 금액 + MRI → 엔진 차단 안내가 새지 않는다",
    !warnText(mri).includes("비급여 MRI") && warnText(mri).includes("올바르게 입력해 주세요"));
  // 아직 노출되지 않은 입력을 선택하라는 경고를 새로 만들지 않는다.
  const fresh = setup(HealthCalc5th as unknown as Comp, names5, { amount: "abc" });
  check("5세대: 무효 금액이면 치료유형 선택 경고를 함께 띄우지 않는다",
    warnText(fresh).includes("올바르게 입력해 주세요") && !warnText(fresh).includes("치료유형"));
  check("5세대: 안내 순서가 화면 순서와 맞다(진료비가 먼저)",
    /\{amountInvalid && \([\s\S]{0,600}\{!amountInvalid && needsItem &&/.test(ui5));
}

// ── 선택 축 전환 ─────────────────────────────────────────────────────
console.log("\n[전환] 급여·비급여·입원·통원과 선택 게이트");
{
  const cases4: [string, Record<string, unknown>, string][] = [
    ["비급여 통원", {}, "200,000원"],
    ["비급여 입원", { visit: "inpatient" }, "210,000원"],
    ["급여 통원 병·의원급", { coverage: "benefit", visit: "outpatient", tier: "clinic" }, "200,000원"],
    ["급여 통원 상급종합", { coverage: "benefit", visit: "outpatient", tier: "hospital" }, "200,000원"],
    ["급여 입원", { coverage: "benefit", visit: "inpatient" }, "240,000원"],
  ];
  for (const [what, over, pay] of cases4) {
    const h = setup(HealthCalc as unknown as Comp, names4, over);
    check(`4세대 ${what}: 정상 계산`, screenOf(h).items[3] === pay, screenOf(h).items.join("/"));
    typeInto(h, "med-amount", "-1");
    check(`4세대 ${what}: 무효값이면 차단`, !screenOf(h).calculated);
    typeInto(h, "med-amount", "300000");
    check(`4세대 ${what}: 복구되면 같은 결과`, screenOf(h).items[3] === pay);
  }
  const cases5: [string, Record<string, unknown>, string | null][] = [
    ["일반 중증 입원 병·의원급", { nonBenefitItem: "general", severity: "critical", visit: "inpatient", nbInpatientTier: "clinic" }, "210,000원"],
    ["일반 중증 입원 상급종합", { nonBenefitItem: "general", severity: "critical", visit: "inpatient", nbInpatientTier: "hospital" }, "210,000원"],
    ["일반 비중증 입원 병·의원급", { nonBenefitItem: "general", severity: "non_critical", visit: "inpatient", nbInpatientTier: "clinic" }, "150,000원"],
    ["일반 중증 통원", { nonBenefitItem: "general", severity: "critical", visit: "outpatient" }, "210,000원"],
    ["급여 입원", { coverage: "benefit", visit: "inpatient" }, "240,000원"],
  ];
  for (const [what, over, pay] of cases5) {
    const h = setup(HealthCalc5th as unknown as Comp, names5, over);
    check(`5세대 ${what}: 정상 계산`, screenOf(h).items[3] === pay, screenOf(h).items.join("/"));
    typeInto(h, "med5-amount", "1,0");
    check(`5세대 ${what}: 무효값이면 차단`, !screenOf(h).calculated);
    typeInto(h, "med5-amount", "300000");
    check(`5세대 ${what}: 복구되면 같은 결과`, screenOf(h).items[3] === pay);
  }
  // 선택 게이트 3종은 그대로 — 유효 금액에서 종전 안내가 나온다.
  const gates: [string, Record<string, unknown>, string][] = [
    ["치료유형 미선택", {}, "치료유형"],
    ["질환 구분 미선택", { nonBenefitItem: "general" }, "중증 / 비중증"],
    ["입원 종별 미선택", { nonBenefitItem: "general", severity: "critical", visit: "inpatient" }, "의료기관 종별"],
  ];
  for (const [what, over, needle] of gates) {
    const h = setup(HealthCalc5th as unknown as Comp, names5, over);
    const all = warnText(h) + " | " + infoText(h);
    check(`5세대 ${what}: 종전 안내 유지`, all.includes(needle) && !screenOf(h).calculated, all.slice(0, 60));
  }
  for (const item of ["musculoskeletal_esw", "injection", "mri", "room_charge"]) {
    const h = setup(HealthCalc5th as unknown as Comp, names5, { nonBenefitItem: item });
    check(`5세대 별도 보장종목(${item}) 차단 유지`,
      !screenOf(h).calculated && warnText(h).length > 0);
  }
}

// ── 범위 밖 무변경 ───────────────────────────────────────────────────
console.log("\n[범위] 공용 위젯·다회·2·3세대·엔진은 건드리지 않았다");
{
  const amountWidget = readFileSync("src/components/AmountInput.tsx", "utf8");
  const rawWidget = readFileSync("src/components/RawAmountInput.tsx", "utf8");
  const m4 = readFileSync("src/components/calculators/HealthCalcMulti2021.tsx", "utf8");
  const m5 = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  const std = readFileSync("src/components/calculators/HealthCalcStandardized.tsx", "utf8");
  const settle = readFileSync("src/lib/insurance/common/settle.ts", "utf8");
  check("공용 AmountInput은 그대로다",
    /replace\(\/\[\^0-9\]\/g, ""\)\.slice\(0, MAX_AMOUNT_DIGITS\)/.test(amountWidget));
  check("RawAmountInput은 그대로다(정제·절단 없음)",
    !/replace\(/.test(stripComments(rawWidget)) && !/slice\(/.test(stripComments(rawWidget)));
  check("4세대 다회 파서·게이트 그대로",
    /const gen2021Amount = \(v: string\): number \| null =>/.test(m4)
    && /const gated = needsOutVisits \|\| needsRiderVisits \|\| needsAmounts;/.test(m4));
  check("5세대 다회 파서·게이트 그대로",
    /const gen2026Amount = \(v: string\): number \| null =>/.test(m5)
    && /const usesAmounts = coverage === "benefit" \|\| showGeneralForm;/.test(m5)
    && /const badRowAmounts = showSpecialForm/.test(m5));
  check("5세대 상급병실료 파서 그대로", /const roomChargeAmount = \(v: string\): number \| null =>/.test(m5));
  check("2·3세대 그대로", /const stdAmount = \(v: string\): number \| null =>/.test(std));
  check("엔진 normalizeAmount는 그대로다",
    /return Number\.isFinite\(amount\) \? Math\.max\(0, Math\.floor\(amount\)\) : 0;/.test(settle));
  check("단건이 엔진 호출 형태를 바꾸지 않았다",
    /calculate\("2021", \{ amount: parsed, coverage, visit, tier \}\)/.test(ui4)
    && /amount: num,\n\s*coverage: "benefit",/.test(ui5));
}

console.log(`\n[4·5세대 단건 진료비 입력 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
