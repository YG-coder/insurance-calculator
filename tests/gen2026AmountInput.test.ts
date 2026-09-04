// G-3 — 5세대 다회 **일반·특별약관 진료비** 입력의 엄격 검증.
//
// 종전 동작: 두 입력 모두 맨 `<input>` + 공용 `num()` 경로였다. `num()`은 숫자·점이 아닌
//   문자를 **지우고** 실패를 0으로 바꾼다.
//     -1 → 1(부호를 지워 양수) / 1.5 → 1.5(원 단위인데 소수 통과) / 1e3 → 13 / 1,0 → 10
//     빈 값·abc·NaN·Infinity → 0원
//   ⚠ 위젯이 원문을 화면에 그대로 남기므로 **화면과 계산이 어긋난다**.
//
// ⚠ 5세대에서 **진료비 0원 행은 횟수·일수를 소진하지 않는다**(엔진의 `amount > 0` 가드).
//   2·3·4세대의 0원 행 설명을 옮기면 안 된다. 이 게이트의 근거는 횟수 소진이 아니라
//   **입력 계약**이다 — 빈 값·잘못된 입력을 임의로 다른 금액으로 바꾸지 않는다.
//   진료비는 양수인데 **지급보험금이 0원**인 건은 별개 논점이다 — 직접 확인한 범위에서 횟수
//   소진 기준을 확정하지 못해 HOLD로 유지하고, 두 해석의 비교 결과가 다를 때만 묶음을 차단하며
//   같으면 기존 계약대로 계산한다(§5.4.2·§5.4.4).
//
// ⚠ 이 화면에는 **독립된 세 개의 행 배열**이 있고, 렌더 분기가 활성 배열과 정확히 일치한다.
//     showRoomChargeForm → rcRows / showSpecialForm → rows / 그 외 → amounts
//   그래서 게이트도 **활성 배열에만** 건다. 경로를 바꿔도 이전 경로의 입력은 상태에 남으므로,
//   한쪽에 게이트를 몰아 걸면 화면에 보이지도 않는 값 때문에 현재 경로가 막힌다.
// ⚠ 상급병실료(rcRows)는 이미 엄격 검증 경로다. 파서·게이트·계산·위젯을 바꾸지 않는다.
// ⚠ 명시적 0원의 기존 처리, 지급 0원 HOLD, 통원 100회/100일, 근골격계 승인 회차,
//   copyCount·누적 입력 정책, 엔진·타입·규칙값·2·3·4세대는 이번 범위가 아니다.
import { readFileSync } from "node:fs";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
import RawAmountInput from "../src/components/RawAmountInput";
import { mount, stateNamesFrom } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const UI_PATH = "src/components/calculators/HealthCalcMulti2026.tsx";
const ui = readFileSync(UI_PATH, "utf8");
const names = stateNamesFrom(ui);
const stripComments = (src: string) =>
  src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

/** 소스의 파서를 그대로 실행한다(테스트가 규칙을 다시 쓰지 않는다). */
const formatSrc = /const GEN2026_AMOUNT_FORMAT = .*;/.exec(ui)?.[0] ?? "";
const parserSrc = /const gen2026Amount = \(v: string\): number \| null => \{[\s\S]*?\n\};/.exec(ui)?.[0] ?? "";
const gen2026Amount = new Function(
  `${formatSrc}\n${parserSrc.replace(": string", "").replace(": number | null", "")}\nreturn gen2026Amount;`,
)() as (v: string) => number | null;

// ── 경로 정의 ────────────────────────────────────────────────────────
/** `amounts` 배열을 쓰는 경로 — 급여 / 일반 비급여 / 일반 경로로 전환되는 조합. */
const AMOUNT_PATHS: [string, Record<string, unknown>, string][] = [
  ["급여 통원", { coverage: "benefit", visit: "outpatient", nhisRate: "20", amounts: ["300000"] }, "240,000원"],
  ["급여 입원", { coverage: "benefit", visit: "inpatient", amounts: ["1000000"] }, "800,000원"],
  ["일반 비급여 중증 통원", { coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", cause: "disease", priorVisits: "0", amounts: ["300000"] }, "210,000원"],
  ["일반 비급여 비중증 통원", { coverage: "non_benefit", nonBenefitItem: "general", severity: "non_critical", visit: "outpatient", cause: "disease", priorOutDays: "0", amounts: ["300000"] }, "150,000원"],
  ["일반 비급여 중증 입원", { coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "inpatient", cause: "disease", nbInpatientTier: "clinic", amounts: ["1000000"] }, "700,000원"],
  ["일반 전환 · 비중증 근골격계", { coverage: "non_benefit", nonBenefitItem: "musculoskeletal_esw", severity: "non_critical", visit: "outpatient", cause: "disease", priorOutDays: "0", amounts: ["300000"] }, "150,000원"],
  ["일반 전환 · 비중증 주사료", { coverage: "non_benefit", nonBenefitItem: "injection", severity: "non_critical", visit: "outpatient", cause: "disease", priorOutDays: "0", amounts: ["300000"] }, "150,000원"],
  ["일반 전환 · 중증 예외 주사료", { coverage: "non_benefit", nonBenefitItem: "injection", severity: "critical", injectionPurpose: "anticancer", visit: "outpatient", cause: "disease", priorVisits: "0", amounts: ["300000"] }, "210,000원"],
];
/** `rows` 배열을 쓰는 경로 — 특별약관 별도 보장종목. */
const ROW_PATHS: [string, Record<string, unknown>, string][] = [
  ["특약 · 중증 근골격계", { coverage: "non_benefit", nonBenefitItem: "musculoskeletal_esw", severity: "critical", rows: [{ amount: "300000", visit: "outpatient", tier: "" }], priorActs: "0", priorCount: "0" }, "210,000원"],
  ["특약 · 중증 일반 주사료", { coverage: "non_benefit", nonBenefitItem: "injection", severity: "critical", injectionPurpose: "general", rows: [{ amount: "300000", visit: "outpatient", tier: "" }], priorCount: "0" }, "210,000원"],
  ["특약 · 중증 MRI", { coverage: "non_benefit", nonBenefitItem: "mri", severity: "critical", rows: [{ amount: "1000000", visit: "outpatient", tier: "" }], priorPool: "0" }, "700,000원"],
  ["특약 · 비중증 MRI", { coverage: "non_benefit", nonBenefitItem: "mri", severity: "non_critical", rows: [{ amount: "1000000", visit: "outpatient", tier: "" }] }, "500,000원"],
];
/** 상급병실료 차액 — 기존 엄격 검증 경로. 이번 변경 대상이 아니다. */
const ROOM = { coverage: "non_benefit", nonBenefitItem: "room_charge", severity: "critical", cause: "disease", rcRows: [{ amount: "600000", days: "3" }] };

/** 쉼표 유무 비교용 — 파서가 받는 정확한 천 단위 형식으로 만든다. */
const withCommas = (v: string) => v.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const setup = (over: Record<string, unknown> = {}) => {
  const h = mount(HealthCalcMulti2026 as unknown as () => unknown, names);
  h.set("submitted", true);
  for (const [k, v] of Object.entries(over)) h.set(k, v);
  return h;
};
const screenOf = (h: ReturnType<typeof setup>) => {
  const s = h.render();
  return {
    s,
    calculated: s.resultItems() !== null,
    pay: (s.resultItems() ?? [])[2]?.value ?? null,
    cells: s.nodes.filter((n) => n.tag === "td").map((n) => n.text),
    warns: s.nodes.filter((n) => n.tag === "#NoticeBox" && n.props.variant === "warning"),
    raws: s.nodes.filter((n) => n.tag === "#RawAmountInput"),
    fillBtn: s.nodes.find((n) => n.tag === "button" && n.text.includes("첫 금액")),
  };
};
/** 위젯의 실제 onChange를 통과시킨다 — state 직접 주입이 아니다. */
const typeInto = (h: ReturnType<typeof setup>, id: string, typed: string) => {
  const n = h.render().nodes.find((x) => x.tag === "#RawAmountInput" && x.props.id === id);
  if (n === undefined) throw new Error(`${id} 위젯을 찾지 못했습니다`);
  const tree = (RawAmountInput as unknown as (p: never) => { props: { children: unknown[] } })(n.props as never);
  ((tree.props.children as { props: { onChange: (e: unknown) => void } }[])[0])
    .props.onChange({ target: { value: typed } });
};

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

// ── 파서 ─────────────────────────────────────────────────────────────
console.log("\n[파서] 원문 형식을 먼저 판정한다");
for (const [what, v] of BAD) check(`${what} → null`, gen2026Amount(v) === null, String(gen2026Amount(v)));
for (const [what, v, want] of GOOD) {
  check(`${what} → ${want}`, gen2026Amount(v) === want, String(gen2026Amount(v)));
}
check("쉼표를 형식 검증 뒤에만 제거한다",
  /GEN2026_AMOUNT_FORMAT\.test\(v\)\) return null;[\s\S]{0,80}replace\(\/,\/g/.test(ui));
check("검증 전에 정제·절단하지 않는다",
  !/gen2026Amount[\s\S]{0,120}(replace\(\/\[\^0-9|slice\()/.test(stripComments(ui).split("const gen2026Amount")[1]?.slice(0, 200) ?? ""));
check("5세대 진료비 전용 파서다(다른 세대 파서를 부르지 않는다)",
  !/stdAmount|gen2021Amount/.test(stripComments(ui)));
check("상급병실료 파서는 그대로 남아 있다(공유하지 않는다)",
  /const roomChargeAmount = \(v: string\): number \| null => \{\n  if \(!ROOM_CHARGE_AMOUNT_FORMAT\.test\(v\)\) return null;/.test(ui));
check("상급병실료가 진료비 파서를 쓰지 않는다",
  /roomChargeTotal: roomChargeAmount\(r\.amount\) as number/.test(ui));

// ── 위젯 ─────────────────────────────────────────────────────────────
console.log("\n[위젯] 두 경로 모두 RawAmountInput이고 원문을 보존한다");
{
  const h = setup(AMOUNT_PATHS[2][1]);
  check("일반 행이 RawAmountInput으로 렌더된다",
    screenOf(h).raws.some((n) => n.props.id === "gen2026-amount-0"));
  for (const [what, v] of [...BAD, ...GOOD.map((g) => [g[0], g[1]] as [string, string])]) {
    typeInto(h, "gen2026-amount-0", v);
    check(`일반 행 ${what} 원문 보존`, (h.get("amounts") as string[])[0] === v,
      JSON.stringify((h.get("amounts") as string[])[0]));
  }
  const r = setup(ROW_PATHS[0][1]);
  check("특약 행이 RawAmountInput으로 렌더된다",
    screenOf(r).raws.some((n) => n.props.id === "gen2026-row-amount-0"));
  for (const [what, v] of [...BAD, ...GOOD.map((g) => [g[0], g[1]] as [string, string])]) {
    typeInto(r, "gen2026-row-amount-0", v);
    check(`특약 행 ${what} 원문 보존`,
      (r.get("rows") as { amount: string }[])[0].amount === v,
      JSON.stringify((r.get("rows") as { amount: string }[])[0].amount));
  }
  check("맨 input으로 진료비를 받지 않는다",
    !/건 진료비<input/.test(ui) && !/행위 진료비"}<input/.test(ui));
  check("상급병실료 차액 칸은 여전히 맨 input이다(범위 밖)",
    /번째 입원의 상급병실료 차액 총액<input className="input-base mt-1" inputMode="numeric" value=\{row\.amount\}/.test(ui));
}

// ── 경로별 게이트 ────────────────────────────────────────────────────
console.log("\n[게이트] 경로마다 무효 원문이면 결과를 숨긴다");
for (const [label, over, want] of AMOUNT_PATHS) {
  const ok = screenOf(setup(over));
  check(`${label}: 정상 입력 → ${want}`, ok.pay === want, String(ok.pay));
  for (const [what, v] of BAD) {
    const scr = screenOf(setup({ ...over, amounts: [v] }));
    check(`${label}: ${what} → 결과 없음`, !scr.calculated, String(scr.pay));
    // ⚠ 게이트가 없으면 파서의 null이 엔진까지 흘러가 **엔진 내부 안내가 화면에 샌다**
    //   ("받은 값: null"). 결과가 비었다는 것만으로는 게이트가 있는지 알 수 없다.
    check(`${label}: ${what} → 엔진을 호출하지 않는다`,
      !scr.warns.some((w) => w.text.includes("받은 값:")),
      scr.warns.map((w) => w.text.slice(0, 40)).join(" | "));
  }
  const bad = screenOf(setup({ ...over, amounts: ["300000", "abc"] }));
  check(`${label}: 2행 무효 → 안내가 2번째 행을 지목`,
    !bad.calculated && bad.warns.some((w) => w.text.includes("2번째 행의") && w.text.includes("진료비")));
  const many = screenOf(setup({ ...over, amounts: ["abc", "300000", ""] }));
  check(`${label}: 여러 행 무효 → 전부 지목`,
    many.warns.some((w) => w.text.includes("1·3번째 행의")));
  const comma = screenOf(setup({ ...over, amounts: ["300,000"] }));
  const plain = screenOf(setup({ ...over, amounts: ["300000"] }));
  check(`${label}: 쉼표 유무가 결과를 바꾸지 않는다`, comma.pay === plain.pay && comma.pay !== null);
  // ⚠ 결과 카드는 종전부터 totalAmount > 0에서만 렌더된다. 그 정책을 바꾸지 않으므로
  //   명시적 0은 **다른 유효 행과 함께** 넣어 게이트를 통과하는지 본다.
  const zero = screenOf(setup({ ...over, amounts: ["0", String(over.amounts ? (over.amounts as string[])[0] : "300000")] }));
  check(`${label}: 명시적 0은 게이트를 통과한다`,
    zero.calculated && !zero.warns.some((w) => w.text.includes("번째 행의")));
  check(`${label}: 명시적 0 행이 결과에 0원으로 남는다`, zero.cells.includes("0원"));
}
for (const [label, over, want] of ROW_PATHS) {
  const rows = over.rows as { amount: string; visit: string; tier: string }[];
  const ok = screenOf(setup(over));
  check(`${label}: 정상 입력 → ${want}`, ok.pay === want, String(ok.pay));
  for (const [what, v] of BAD) {
    const scr = screenOf(setup({ ...over, rows: [{ ...rows[0], amount: v }] }));
    check(`${label}: ${what} → 결과 없음`, !scr.calculated, String(scr.pay));
    check(`${label}: ${what} → 엔진을 호출하지 않는다`,
      !scr.warns.some((w) => w.text.includes("받은 값:")),
      scr.warns.map((w) => w.text.slice(0, 40)).join(" | "));
  }
  const bad = screenOf(setup({ ...over, rows: [rows[0], { ...rows[0], amount: "abc" }] }));
  check(`${label}: 2행 무효 → 안내가 2번째 행을 지목`,
    !bad.calculated && bad.warns.some((w) => w.text.includes("2번째 행의")));
  const comma = screenOf(setup({ ...over, rows: [{ ...rows[0], amount: withCommas(rows[0].amount) }] }));
  check(`${label}: 쉼표 유무가 결과를 바꾸지 않는다`, comma.pay === ok.pay, `${comma.pay} vs ${ok.pay}`);
  const zero = screenOf(setup({ ...over, rows: [{ ...rows[0], amount: "0" }, rows[0]] }));
  check(`${label}: 명시적 0은 게이트를 통과한다`,
    zero.calculated && !zero.warns.some((w) => w.text.includes("번째 행의")));
}

// ── 수정·삭제 후 재개 ────────────────────────────────────────────────
console.log("\n[재개] 고치거나 지우면 계산이 다시 된다");
{
  const h = setup({ ...AMOUNT_PATHS[2][1], amounts: ["300000", "300000"] });
  check("정상 2행은 계산된다", screenOf(h).calculated);
  typeInto(h, "gen2026-amount-1", "-1");
  check("2행을 '-1'로 바꾸면 결과가 사라진다", !screenOf(h).calculated);
  check("화면과 계산이 어긋나지 않는다", (h.get("amounts") as string[])[1] === "-1");
  typeInto(h, "gen2026-amount-1", "300,000");
  check("고치면 계산이 재개된다", screenOf(h).calculated);
  typeInto(h, "gen2026-amount-1", "");
  check("비우면 다시 차단된다", !screenOf(h).calculated);
  const del = screenOf(h).s.nodes.filter((n) => n.tag === "button" && n.text === "삭제");
  (del[1].props.onClick as () => void)();
  check("무효 행을 삭제하면 계산이 재개된다", screenOf(h).calculated);

  const r = setup({ ...ROW_PATHS[0][1], rows: [{ amount: "300000", visit: "outpatient", tier: "" }, { amount: "300000", visit: "outpatient", tier: "" }] });
  check("특약 정상 2행은 계산된다", screenOf(r).calculated);
  typeInto(r, "gen2026-row-amount-1", "1.5");
  check("특약 2행을 '1.5'로 바꾸면 결과가 사라진다", !screenOf(r).calculated);
  typeInto(r, "gen2026-row-amount-1", "300000");
  check("특약도 고치면 재개된다", screenOf(r).calculated);
}

// ── 경로 전환 시 간섭 없음 ───────────────────────────────────────────
console.log("\n[간섭] 숨겨진 다른 경로의 무효값이 현재 경로를 막지 않는다");
{
  const junkRows = [{ amount: "abc", visit: "", tier: "" }, { amount: "-1", visit: "", tier: "" }];
  const junkRc = [{ amount: "abc", days: "0" }];
  const junkAmounts = ["abc", "-1", ""];
  for (const [label, over] of AMOUNT_PATHS) {
    const scr = screenOf(setup({ ...over, rows: junkRows, rcRows: junkRc }));
    check(`${label}: 숨은 rows·rcRows 무효값과 무관하게 계산된다`, scr.calculated);
  }
  for (const [label, over] of ROW_PATHS) {
    const scr = screenOf(setup({ ...over, amounts: junkAmounts, rcRows: junkRc }));
    check(`${label}: 숨은 amounts·rcRows 무효값과 무관하게 계산된다`, scr.calculated);
  }
  const roomOk = screenOf(setup({ ...ROOM, amounts: junkAmounts, rows: junkRows }));
  check("상급병실료: 숨은 amounts·rows 무효값과 무관하게 계산된다", roomOk.calculated);
  check("상급병실료 화면에는 RawAmountInput이 없다(위젯 무변경)", roomOk.raws.length === 0);
  check("게이트가 활성 배열에만 걸린다(소스)",
    /const usesAmounts = coverage === "benefit" \|\| showGeneralForm;/.test(ui)
    && /const badRowAmounts = showSpecialForm/.test(ui));
}

// ── 복제 (첫 행이 원본) ──────────────────────────────────────────────
console.log("\n[복제] 원본은 첫 행 진료비다");
{
  const base = AMOUNT_PATHS[2][1];
  const cases: [string, string[], boolean][] = [
    ["첫 행 정수", ["300000", "abc"], false],
    ["첫 행 쉼표", ["300,000", "abc"], false],
    ["첫 행 명시적 0", ["0", "abc"], false],
    ["첫 행 음수", ["-1", "300000"], true],
    ["첫 행 빈 값", ["", "300000"], true],
    ["첫 행 소수", ["1.5", "300000"], true],
    ["첫 행 잘못된 쉼표", ["1,0", "300000"], true],
  ];
  for (const [what, amts, disabled] of cases) {
    const btn = screenOf(setup({ ...base, amounts: amts })).fillBtn;
    check(`${what} → 버튼 disabled=${disabled}`, btn !== undefined && btn.props.disabled === disabled);
  }
  check("복제 판정이 첫 행만 본다", /gen2026Amount\(amounts\[0\] \?\? ""\) === null/.test(ui));

  const h1 = setup({ ...base, amounts: ["300000", "abc", "xyz"], copyCount: "3" });
  (screenOf(h1).fillBtn!.props.onClick as () => void)();
  check("다른 행만 무효여도 복제되고 전체가 대체된다",
    JSON.stringify(h1.get("amounts")) === JSON.stringify(["300000", "300000", "300000"]));
  check("복제 후 계산이 재개된다", screenOf(h1).calculated);

  const h0 = setup({ ...base, amounts: ["0", "abc"], copyCount: "2" });
  (screenOf(h0).fillBtn!.props.onClick as () => void)();
  check("첫 행이 명시적 0이면 복제된다",
    JSON.stringify(h0.get("amounts")) === JSON.stringify(["0", "0"]));

  const hBad = setup({ ...base, amounts: ["-1", "300000"], copyCount: "3" });
  (screenOf(hBad).fillBtn!.props.onClick as () => void)();
  check("첫 행이 무효면 핸들러에서도 막는다(행 불변)",
    JSON.stringify(hBad.get("amounts")) === JSON.stringify(["-1", "300000"]));
  check("핸들러 방어가 소스에 있다", /if \(copySourceInvalid\) return;/.test(ui));
  check("첫 행이 무효면 이유를 화면에 밝힌다",
    screenOf(setup({ ...base, amounts: ["-1", "300000"] })).s.nodes
      .some((n) => n.tag === "p" && n.text.includes("복제할")));
  check("copyCount 정책은 그대로다(num 사용·1~100 클램프·내림)",
    /Math\.max\(1, Math\.min\(100, Math\.floor\(num\(copyCount\)\)\)\)/.test(ui));
}

// ── 안내 문구 ────────────────────────────────────────────────────────
console.log("\n[안내] 문제 행 번호와 허용 형식을 밝힌다");
{
  const g = screenOf(setup({ ...AMOUNT_PATHS[2][1], amounts: ["abc"] }));
  const w = g.warns.find((n) => n.text.includes("번째 행의"))!;
  check("일반 안내에 행 번호", w !== undefined && w.text.startsWith("1번째 행의"));
  for (const needle of ["0 이상의 정수", "300000", "300,000", "0을 입력하세요",
    "임의로 다른 금액으로 바꾸지 않으며", "모든 행에 올바른 진료비를 입력해야", "부분합"]) {
    check(`일반 안내에 "${needle}"`, w.text.includes(needle));
  }
  const r = screenOf(setup({ ...ROW_PATHS[0][1], rows: [{ amount: "abc", visit: "outpatient", tier: "" }] }));
  const rw = r.warns.find((n) => n.text.includes("번째 행의"))!;
  check("특약 안내에 행 번호", rw !== undefined && rw.text.startsWith("1번째 행의"));
  for (const needle of ["0 이상의 정수", "300,000",
    "임의로 다른 금액으로 바꾸지 않으며", "모든 행에 올바른 진료비를 입력해야"]) {
    check(`특약 안내에 "${needle}"`, rw.text.includes(needle));
  }
  const inj = screenOf(setup({ ...ROW_PATHS[1][1], rows: [{ amount: "abc", visit: "outpatient", tier: "" }] }));
  check("주사료 안내는 라벨을 주사료로 쓴다",
    inj.warns.some((n) => n.text.includes("1회 주사료 합산액")));
  check("무효 행을 지우거나 0원으로 대체하지 않는다",
    !/gen2026Amount\([^)]*\) \?\? 0/.test(stripComments(ui))
    && !/\.filter\([^)]*gen2026Amount/.test(stripComments(ui))
    && /amounts: amounts\.map\(\(a\) => gen2026Amount\(a\) as number\)/.test(ui));
}

// ── 0원 설명이 세대를 넘어오지 않았는지 ──────────────────────────────
console.log("\n[근거] 5세대의 0원 행 동작을 실제 엔진으로 확인하고, 설명이 그것과 맞는지 본다");
{
  const multi = readFileSync("src/lib/insurance/engine/multiClaim2026.ts", "utf8");
  const special = readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8");
  const design = readFileSync("docs/insurance/multi-claim-design.md", "utf8");
  // ① 엔진이 실제로 진료비 0원 행을 세지 않는다.
  check("중증 통원 횟수는 amount > 0일 때만 소진",
    /isCriticalOutpatient && amount > 0 && outpatientVisits >=/.test(multi));
  check("비중증 통원 일수는 amount > 0일 때만 소진",
    /isNonCriticalOutpatient && amount > 0 && outpatientDays >=/.test(multi));
  check("소진 판정 자체가 amount > 0을 요구", /const consumes = amount > 0 &&/.test(multi));
  check("특별약관 횟수는 amount > 0일 때만 센다",
    /const counts = spec\.annualVisits !== null && amount > 0;/.test(special));
  check("근골격계 승인 회차는 양수 금액 행만 센다",
    /lines\.filter\(\(l\) => normalizeAmount\(l\.amount\) > 0\)\.length/.test(special));
  // ② 화면 동작으로도 확인한다 — 0원 행을 넣어도 한도 경계가 밀리지 않는다.
  const critOut = { coverage: "non_benefit", nonBenefitItem: "general", severity: "critical", visit: "outpatient", cause: "disease" };
  const withZero = screenOf(setup({ ...critOut, amounts: ["0", "300000"], priorVisits: "99" }));
  const without = screenOf(setup({ ...critOut, amounts: ["300000"], priorVisits: "99" }));
  check("중증 통원 prior=99에 0원 행을 더해도 100회째가 밀리지 않는다",
    withZero.pay === without.pay && withZero.pay === "210,000원", `${withZero.pay} vs ${without.pay}`);
  const msk = { coverage: "non_benefit", nonBenefitItem: "musculoskeletal_esw", severity: "critical", priorCount: "0" };
  const mskZero = screenOf(setup({ ...msk, priorActs: "9", rows: [{ amount: "0", visit: "outpatient", tier: "" }, { amount: "300000", visit: "outpatient", tier: "" }] }));
  const mskPlain = screenOf(setup({ ...msk, priorActs: "9", rows: [{ amount: "300000", visit: "outpatient", tier: "" }] }));
  check("근골격계 승인 구간도 0원 행 때문에 밀리지 않는다",
    mskZero.calculated && mskPlain.calculated && mskZero.pay === mskPlain.pay,
    `${mskZero.pay} vs ${mskPlain.pay}`);
  // ③ 그러므로 안내·주석·문서가 "0원 행이 횟수를 소진한다"고 말하면 안 된다.
  const banned = ["0원으로 보면 그 행이", "횟수를 1회 소진", "연간 횟수를 소진",
    "공제금액을 한 번 더 쓰고", "보상 승인 회차와 연 50회 한도까지 밀"];
  const g5Notices = [
    screenOf(setup({ ...critOut, priorVisits: "0", amounts: ["abc"] })).warns,
    screenOf(setup({ ...msk, priorActs: "0", rows: [{ amount: "abc", visit: "outpatient", tier: "" }] })).warns,
  ].flat().map((n) => n.text).join(" ");
  for (const b of banned) {
    check(`화면 안내에 4세대식 설명 "${b}" 없음`, !g5Notices.includes(b));
  }
  const uiComments = ui.split("\n").filter((l) => /^\s*(\/\/|\*)/.test(l)).join("\n");
  check("주석에도 0원 행이 승인 회차를 민다는 설명이 없다",
    !/0원[^\n]*승인 회차[^\n]*밀/.test(uiComments) && !/행 수만큼 계산에 들어가/.test(uiComments));
  const g3 = design.slice(design.indexOf("### 5.4.6"), design.indexOf("### 5.5 대조해"));
  check("설계 문서 G-3 절에도 4세대식 0원 설명이 없다",
    g3.length > 0 && !/승인 회차와 연 50회 한도까지 밀/.test(g3) && !/공제금액을 한 번 더 쓰고/.test(g3));
  check("설계 문서 G-3 절이 5세대의 0원 동작을 명시한다",
    g3.includes("횟수·일수를 소진하지 않는다"));
  check("진료비 0원과 지급보험금 0원을 구분해 서술한다",
    g3.includes("지급보험금이 0원") && /HOLD/.test(g3));
  // ⚠ HOLD 설명이 다시 단정형으로 돌아가지 않게 한다. 확정하지 못한 것은 약관의 부재가 아니라
  //   **직접 확인한 범위**이고, 차단은 무조건이 아니라 **두 해석이 다를 때만**이다.
  const holdBanned = ["약관에 없어", "약관에 정해져 있지 않아", "약관에 정해져 있지 않으므로"];
  for (const b of holdBanned) {
    check(`G-3 설명에 단정 표현 "${b}" 없음`, !g3.includes(b) && !uiComments.includes(b));
  }
  for (const [where, text] of [["설계 문서", g3], ["주석", uiComments]] as [string, string][]) {
    check(`${where}: HOLD를 '직접 확인한 범위'로 한정한다`,
      text.includes("직접 확인한 범위") && text.includes("확정하지 못해"));
    check(`${where}: 차단 조건이 '두 해석의 비교 결과가 다를 때'임을 밝힌다`,
      text.includes("비교 결과가 다를 때만") && text.includes("같으면 기존 계약대로 계산"));
  }
  // 엔진이 실제로 그렇게 동작하는지 — 다를 때만 차단한다.
  check("엔진은 두 해석의 지문이 다를 때만 차단한다",
    /if \(fingerprint\(countedA\) !== fingerprint\(countedB\)\) return blocked\(dualAxis\);/.test(multi));
}

// ── 급여 전환 — 화면·검증·계산이 같은 배열을 본다 ────────────────────
console.log("\n[전환] 급여로 바꾸면 화면·검증·계산이 모두 amounts를 본다");
{
  /** 라벨 텍스트로 select를 찾아 실제 onChange를 통과시킨다. */
  const pick = (h: ReturnType<typeof setup>, labelPrefix: string, value: string) => {
    const label = h.render().nodes.find((n) => n.tag === "label" && n.text.startsWith(labelPrefix));
    if (label === undefined) throw new Error(`라벨 ${labelPrefix}를 찾지 못했습니다`);
    const find = (el: unknown): { props: { onChange: (e: unknown) => void } } | null => {
      if (el === null || el === undefined || typeof el !== "object") return null;
      if (Array.isArray(el)) { for (const c of el) { const r = find(c); if (r !== null) return r; } return null; }
      const e = el as { type?: unknown; props?: Record<string, unknown> };
      if (e.type === "select" && typeof e.props?.onChange === "function") return e as never;
      return find(e.props?.children);
    };
    const sel = find(label.props.children);
    if (sel === null) throw new Error(`${labelPrefix}의 select를 찾지 못했습니다`);
    sel.props.onChange({ target: { value } });
  };
  const ids = (h: ReturnType<typeof setup>) => screenOf(h).raws.map((n) => String(n.props.id)).sort();
  const hasLabel = (h: ReturnType<typeof setup>, p: string) => h.render().labels.some((l) => l.startsWith(p));

  for (const [what, over, back] of [
    ["특별약관(중증 근골격계)", { coverage: "non_benefit", nonBenefitItem: "musculoskeletal_esw", severity: "critical", priorActs: "0", priorCount: "0", rows: [{ amount: "300000", visit: "outpatient", tier: "" }] }, "gen2026-row-amount-0"],
    ["상급병실료", { coverage: "non_benefit", nonBenefitItem: "room_charge", severity: "critical", cause: "disease", rcRows: [{ amount: "600000", days: "3" }] }, ""],
  ] as [string, Record<string, unknown>, string][]) {
    // 비급여 상태에서 amounts에는 무효값을 심어 둔다 — 급여로 바꾼 뒤 이 값이 계산되면 안 된다.
    // 급여 통원은 건강보험 본인부담률이 있어야 계산한다(종전 계약). 미리 채워 둔다.
    const h = setup({ ...over, amounts: ["abc", "-1"], nhisRate: "20" });
    const before = screenOf(h);
    check(`${what}: 전환 전에는 비급여 폼이 보인다`,
      back === "" ? before.raws.length === 0 && hasLabel(h, "1번째 입원의 상급병실료")
        : ids(h).includes(back));
    check(`${what}: 전환 전에는 숨은 amounts 무효값이 계산을 막지 않는다`, before.calculated);

    pick(h, "급여 구분", "benefit");
    const after = screenOf(h);
    check(`${what} → 급여: 화면 입력이 amounts 행으로 바뀐다`,
      ids(h).some((id) => id.startsWith("gen2026-amount-")) && !ids(h).some((id) => id.startsWith("gen2026-row-amount-")));
    check(`${what} → 급여: 상급병실료·특약 입력이 사라진다`,
      !hasLabel(h, "1번째 입원의 상급병실료") && !hasLabel(h, "1번째 행위 진료비"));
    check(`${what} → 급여: 치료 형태 선택창이 보인다`, hasLabel(h, "치료 형태"));
    check(`${what} → 급여: 원인 선택창이 하나뿐이다`,
      h.render().labels.filter((l) => l.startsWith("원인")).length === 1);
    check(`${what} → 급여: 보이는 amounts가 무효이므로 계산하지 않는다`, !after.calculated);
    check(`${what} → 급여: 안내가 무효 행을 지목한다`,
      after.warns.some((w) => w.text.includes("1·2번째 행의")));
    // 보이는 칸을 고치면 계산된다 — 화면과 계산 대상이 같다는 뜻이다.
    typeInto(h, "gen2026-amount-0", "300000");
    typeInto(h, "gen2026-amount-1", "300000");
    const fixed = screenOf(h);
    check(`${what} → 급여: 보이는 칸을 고치면 계산된다`, fixed.calculated);
    check(`${what} → 급여: 결과가 화면에 입력한 금액과 일치한다`,
      (fixed.s.resultItems() ?? [])[0]?.value === "600,000원",
      String((fixed.s.resultItems() ?? [])[0]?.value));

    // 되돌아오면 이전 경로가 복원되고, 급여에서 고친 amounts가 그 경로를 막지 않는다.
    pick(h, "급여 구분", "non_benefit");
    const backScr = screenOf(h);
    check(`${what} → 비급여 복귀: 원래 입력 폼이 돌아온다`,
      back === "" ? backScr.raws.length === 0 && hasLabel(h, "1번째 입원의 상급병실료")
        : ids(h).includes(back));
    check(`${what} → 비급여 복귀: 원래 경로가 다시 계산된다`, backScr.calculated);
    check(`${what} → 비급여 복귀: 결과가 전환 전과 같다`,
      JSON.stringify(backScr.s.resultItems()) === JSON.stringify(before.s.resultItems()));
  }
  check("급여 여부가 치료유형 파생에 반영된다(소스)",
    /const isSpecialItem = coverage === "non_benefit"/.test(ui)
    && /const isRoomCharge = coverage === "non_benefit" && nonBenefitItem === "room_charge";/.test(ui));
}

// ── 유지해야 할 계약 ─────────────────────────────────────────────────
console.log("\n[무회귀] 기존 정책은 그대로다");
{
  const critOut = AMOUNT_PATHS[2][1];
  // 지급보험금 0원 건은 직접 확인한 범위에서 횟수 소진 기준을 확정하지 못해 HOLD로 유지한다.
  //   두 해석의 비교 결과가 다를 때만 묶음을 차단하고, 같으면 기존 계약대로 계산한다.
  //   아래는 두 해석이 갈리는 입력이라 차단되는 경우다. 그 경계를 지킨다.
  const zero99 = screenOf(setup({ ...critOut, amounts: ["20000", "300000"], priorVisits: "99" }));
  check("중증 통원 prior=99, 지급 0원 행 포함 → 이중 해석 차단 유지",
    !zero99.calculated && zero99.warns.some((w) => w.text.includes("지급 보험금이 0원인 통원")));
  const cap99 = screenOf(setup({ ...critOut, amounts: ["300000", "300000"], priorVisits: "99" }));
  check("중증 통원 prior=99, [30만,30만] → 100회째 계산·101회째 지급 0원",
    cap99.calculated && cap99.pay === "210,000원"
    && cap99.cells.slice(-1)[0] === "0원");
  const days99 = screenOf(setup({ ...AMOUNT_PATHS[3][1], amounts: ["300000", "300000"], priorOutDays: "99" }));
  check("비중증 통원 prior=99일 → 100일째 계산·101일째 지급 0원",
    days99.calculated && days99.pay === "150,000원" && days99.cells.slice(-1)[0] === "0원");
  check("중증 통원은 회, 비중증은 일로 분리된 채 남아 있다",
    /const outpatientDays = nonNegSafeInt;/.test(ui) && /const outpatientVisits = nonNegSafeInt;/.test(ui));

  const msk = ROW_PATHS[0][1];
  const noActs = screenOf(setup({ ...msk, priorActs: "" }));
  check("근골격계 치료행위 수 미입력 → 차단 유지",
    !noActs.calculated && noActs.warns.some((w) => w.text.includes("이미 받은 치료행위 수")));
  const acts10 = screenOf(setup({ ...msk, priorActs: "10", priorCount: "10" }));
  check("근골격계 승인 회차 부족 → 차단 유지", !acts10.calculated || acts10.warns.length > 0);
  check("승인 회차 축은 그대로다(approvedThroughVisit: approvedThrough)",
    /approvedThroughVisit: approvedThrough,/.test(ui));
  check("승인 검사와 연 50회 카운터는 여전히 분리돼 있다",
    /priorAnnualCoveredCount: num\(priorCount\)/.test(ui)
    && /priorAnnualTreatmentActCount: outpatientDays\(priorActs\) \?\? undefined/.test(ui));

  const room = screenOf(setup(ROOM));
  check("상급병실료 정상 예시 무회귀", room.pay === "300,000원", String(room.pay));
  for (const [what, v] of [["음수", "-1"], ["문자", "abc"], ["빈 값", ""], ["잘못된 쉼표", "1,0"]] as [string, string][]) {
    const bad = screenOf(setup({ ...ROOM, rcRows: [{ amount: v, days: "3" }] }));
    check(`상급병실료 ${what} → 차단 유지`,
      !bad.calculated && bad.warns.some((w) => w.text.includes("차액 총액")));
  }
  check("상급병실료 일수 0 → 차단 유지",
    !screenOf(setup({ ...ROOM, rcRows: [{ amount: "600000", days: "0" }] })).calculated);

  check("누적 보험금·공제금액·가입금액은 여전히 num()을 쓴다(범위 밖)",
    /priorAnnualInsurancePaid: num\(priorInsurance\)/.test(ui)
    && /annualCoverageLimit: annualLimit !== "" \? num\(annualLimit\) : undefined/.test(ui)
    && /priorAnnualDeductible: severity === "critical" && visit === "inpatient" && nbInpatientTier === "hospital" \? num\(priorDeductible\) : undefined/.test(ui));
  check("일반 전환 라우팅은 그대로다",
    /routeOfGen2026Item\(severity, specialItem, injectionPurpose === "" \? undefined : injectionPurpose\)/.test(ui));
  check("일반 전환 경로에서도 진료비 게이트를 우회할 수 없다",
    /\|\| needsOutDays \|\| needsOutVisits \|\| amountsIncomplete\)\)\)/.test(ui));
  check("특별약관 경로 게이트가 별도로 있다", /&& !rowAmountsIncomplete/.test(ui));
}

// ── 범위 밖 무변경 ───────────────────────────────────────────────────
console.log("\n[범위] 다른 세대·엔진·공용 위젯은 건드리지 않았다");
{
  const std = readFileSync("src/components/calculators/HealthCalcStandardized.tsx", "utf8");
  const g4 = readFileSync("src/components/calculators/HealthCalcMulti2021.tsx", "utf8");
  const single = readFileSync("src/components/calculators/HealthCalc5th.tsx", "utf8");
  const amountWidget = readFileSync("src/components/AmountInput.tsx", "utf8");
  const rawWidget = readFileSync("src/components/RawAmountInput.tsx", "utf8");
  const settle = readFileSync("src/lib/insurance/common/settle.ts", "utf8");
  check("2·3세대는 G-1 계약 그대로다", /const stdAmount = \(v: string\): number \| null =>/.test(std));
  check("4세대는 G-2 계약 그대로다", /const gen2021Amount = \(v: string\): number \| null =>/.test(g4));
  // ⚠ 단건 계산기는 G-4에서 **의도적으로** 진료비 위젯을 바꾼다(별도 커밋).
  //   여기서는 단건이 **다회의 파서·게이트를 재사용하지 않는지**만 지킨다.
  //   ⚠ 자기 주석에 파서 이름이 나오므로 주석 줄을 뺀 뒤 검사한다.
  const singleCode = stripComments(single);
  check("5세대 단건은 다회 파서를 재사용하지 않는다",
    !/\bgen2026Amount\(/.test(singleCode) && !/roomChargeAmount/.test(singleCode));
  check("5세대 단건은 자기 파서를 쓴다",
    /const gen2026SingleAmount = \(v: string\): number \| null =>/.test(single));
  check("공용 AmountInput은 그대로다",
    /replace\(\/\[\^0-9\]\/g, ""\)\.slice\(0, MAX_AMOUNT_DIGITS\)/.test(amountWidget));
  check("RawAmountInput은 그대로다(정제·절단 없음)",
    !/replace\(/.test(stripComments(rawWidget)) && !/slice\(/.test(stripComments(rawWidget)));
  check("엔진 normalizeAmount는 그대로다",
    /return Number\.isFinite\(amount\) \? Math\.max\(0, Math\.floor\(amount\)\) : 0;/.test(settle));
  check("num()은 남아 있되 진료비에는 쓰이지 않는다",
    /const num = \(v: string\) => Number\(v\.replace\(\/\[\^0-9\.\]\/g, ""\)\) \|\| 0;/.test(ui)
    && !/amounts\.map\(num\)/.test(ui) && !/amount: num\(r\.amount\)/.test(ui));
  check("satisfies로 초과 필드를 막는 계약은 그대로다",
    (ui.match(/\} satisfies Gen2026\w+\)/g) ?? []).length >= 3);
}

console.log(`\n[5세대 진료비 입력 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
