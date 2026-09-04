// G-2 — 4세대 다회 **진료비** 입력의 엄격 검증.
//
// 종전 동작: 행 진료비가 맨 `<input>` + `digits()` 경로였다. `digits()`는 숫자가 아닌
//   문자를 **지우고** 실패를 0으로 바꾼다.
//     -1 → 1(부호를 지워 양수) / 1.5 → 15(10배) / 1e3 → 13 / 1,0 → 10
//     빈 값·abc·NaN·Infinity → 0원
//   ⚠ 4세대는 위젯이 원문을 화면에 그대로 남기므로 **화면과 계산이 어긋났다** —
//     프로덕션에서 `-1`을 넣으면 입력칸은 `-1`인데 결과표는 `1원`으로 계산됐다.
//   그리고 0원 행은 비급여 통원 연 100회·특약 연 50회를 1회 소진하고, 도수 승인 구간의
//   회차 계산(amounts.length)에도 들어가 승인 부족 차단까지 일으켰다.
//
// ⚠ 복제 원본은 **첫 행 진료비**다. 4세대에는 별도 복제 금액 칸이 없다.
//   첫 행이 무효면 버튼 비활성 + 핸들러 방어. 첫 행이 명시적 0이면 복제 허용.
//   다른 행만 무효이고 첫 행이 유효하면 복제 허용 — 전체 행 대체라는 기존 동작을 지킨다.
// ⚠ 명시적으로 입력한 0의 기존 처리(계산 포함·횟수 소진·승인 회차 산입)는 바꾸지 않는다.
// ⚠ 도수 승인 회차·연 50회 한도·횟수 축 검증·copyCount 정책은 그대로다.
// ⚠ 2·3세대·5세대·엔진·공용 AmountInput은 이번 범위가 아니다.
import { readFileSync } from "node:fs";
import HealthCalcMulti2021 from "../src/components/calculators/HealthCalcMulti2021";
import RawAmountInput from "../src/components/RawAmountInput";
import { mount, stateNamesFrom } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const UI_PATH = "src/components/calculators/HealthCalcMulti2021.tsx";
const ui = readFileSync(UI_PATH, "utf8");
const names = stateNamesFrom(ui);
const stripComments = (src: string) =>
  src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

/** 소스의 파서를 그대로 실행한다(테스트가 규칙을 다시 쓰지 않는다). */
const formatSrc = /const GEN2021_AMOUNT_FORMAT = .*;/.exec(ui)?.[0] ?? "";
const parserSrc = /const gen2021Amount = \(v: string\): number \| null => \{[\s\S]*?\n\};/.exec(ui)?.[0] ?? "";
const gen2021Amount = new Function(
  `${formatSrc}\n${parserSrc.replace(": string", "").replace(": number | null", "")}\nreturn gen2021Amount;`,
)() as (v: string) => number | null;

const setup = (over: Record<string, unknown> = {}) => {
  const h = mount(HealthCalcMulti2021 as unknown as () => unknown, names);
  // ⚠ G-5에서 누적 금액이 **축별 Record**가 됐다. 기본값이 모든 축 "0"이라 주입하지 않는다.
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
    fillBtn: s.nodes.find((n) => n.tag === "button" && n.text.includes("첫 금액")),
  };
};
/** 위젯의 실제 onChange를 통과시킨다 — state 직접 주입이 아니다. */
const typeRow = (h: ReturnType<typeof setup>, idx: number, typed: string) => {
  const n = h.render().nodes.find((x) => x.tag === "#RawAmountInput" && x.props.id === `gen2021-amount-${idx}`);
  if (n === undefined) throw new Error(`행 ${idx}의 RawAmountInput을 찾지 못했습니다`);
  const tree = (RawAmountInput as unknown as (p: never) => { props: { children: unknown[] } })(n.props as never);
  ((tree.props.children as { props: { onChange: (e: unknown) => void } }[])[0])
    .props.onChange({ target: { value: typed } });
};

const BAD: [string, string][] = [
  ["빈 문자열", ""], ["공백", "   "], ["음수", "-1"], ["소수", "1.5"], ["끝소수점", "1."],
  ["선행 소수점", ".5"], ["소수점만", "."], ["잘못된 쉼표", "1,0"], ["쉼표 그룹 오류", "1,00,000"],
  ["선행 쉼표", ",300"], ["문자", "abc"], ["지수 표기", "1e3"], ["NaN", "NaN"],
  ["Infinity", "Infinity"], ["부호+", "+1"], ["공백 섞임", "100 000"],
  ["안전 정수 초과", "9007199254740993"],
];

// ── 파서 ─────────────────────────────────────────────────────────────
console.log("\n[파서] 원문 형식을 먼저 판정한다");
for (const [what, v] of BAD) check(`${what} → null`, gen2021Amount(v) === null, String(gen2021Amount(v)));
for (const [what, v, want] of [
  ["명시적 0", "0", 0], ["0 반복", "00", 0], ["정수", "100000", 100000],
  ["천 단위 쉼표", "100,000", 100000], ["백만 단위", "1,234,567", 1234567],
  ["선행 0", "0100000", 100000], ["안전 정수 최대", "9007199254740991", 9007199254740991],
] as [string, string, number][]) {
  check(`${what} → ${want}`, gen2021Amount(v) === want, String(gen2021Amount(v)));
}
check("쉼표를 형식 검증 뒤에만 제거한다",
  /GEN2021_AMOUNT_FORMAT\.test\(v\)\) return null;[\s\S]{0,80}replace\(\/,\/g/.test(ui));
check("4세대 전용 파서다(다른 세대 파서를 부르지 않는다)",
  !/stdAmount|roomChargeAmount/.test(stripComments(ui)));

// ── 위젯 ─────────────────────────────────────────────────────────────
console.log("\n[위젯] 행 진료비가 RawAmountInput이고 원문을 보존한다");
{
  const h = setup();
  const s = h.render();
  check("행마다 RawAmountInput이 렌더된다",
    s.nodes.filter((n) => n.tag === "#RawAmountInput" && String(n.props.id).startsWith("gen2021-amount-")).length === 2);
  check("맨 input으로 진료비를 받지 않는다",
    !/{i \+ 1}건 진료비\s*\n\s*<input/.test(ui));
  for (const [what, v] of [...BAD, ["정수", "100000"], ["천 단위 쉼표", "100,000"]] as [string, string][]) {
    typeRow(h, 0, v);
    check(`${what} 원문 보존`, (h.get("amounts") as string[])[0] === v,
      JSON.stringify((h.get("amounts") as string[])[0]));
  }
}

// ── 화면 전이 ────────────────────────────────────────────────────────
console.log("\n[화면] 실제 입력 → 상태 → 결과");
{
  const h = setup({ priorOutVisits: "0" });
  check("정상 입력은 계산된다", screenOf(h).calculated);
  typeRow(h, 0, "-1");
  const bad = screenOf(h);
  check("'-1' 입력 시 결과가 사라진다", !bad.calculated);
  check("'-1' 입력 시 1번째 행을 지목한다",
    bad.warns.some((w) => w.text.includes("1번째 행의") && w.text.includes("진료비")));
  check("화면과 계산이 어긋나지 않는다(원문 유지 + 계산 없음)",
    (h.get("amounts") as string[])[0] === "-1" && !bad.calculated);
  typeRow(h, 0, "100,000");
  check("'100,000'으로 고치면 계산이 재개된다", screenOf(h).calculated);
  typeRow(h, 1, "");
  const bad2 = screenOf(h);
  check("행2를 비우면 다시 차단되고 2번째 행을 지목한다",
    !bad2.calculated && bad2.warns.some((w) => w.text.includes("2번째 행의")));
  typeRow(h, 1, "0");
  check("행2에 명시적 0을 넣으면 계산이 재개된다", screenOf(h).calculated);
}
console.log("\n[화면] 한 행만 어긋나도 묶음 전체를 계산하지 않는다");
for (const [what, v] of BAD) {
  const scr = screenOf(setup({ amounts: ["100000", v], priorOutVisits: "0" }));
  check(`행2 ${what} → 결과 없음`, !scr.calculated);
  check(`행2 ${what} → 안내가 2번째 행을 지목`, scr.warns.some((w) => w.text.includes("2번째 행의")));
}
check("여러 행이 무효면 전부 지목한다",
  screenOf(setup({ amounts: ["abc", "100000", ""], priorOutVisits: "0" }))
    .warns.some((w) => w.text.includes("1, 3번째 행의")));
// G-6에서 금액 두 축이 게이트에 합류해 `gated`가 `money`를 거쳐 엔진 인자를 만든다.
//   차단 계약 자체는 그대로다 — 게이트가 걸리면 엔진 호출식에 도달하지 않는다.
check("차단 중에는 엔진을 호출하지 않는다",
  /const money = gated \|\| priorPaidNum === null \|\| annualLimitNum === null \? null : \{/.test(ui)
  && /const common = money === null \? null : \{/.test(ui)
  && /const result = money === null \|\| common === null \? null : rider === "manual_therapy"/.test(ui));
check("무효 행을 0원으로 대체하는 경로를 두지 않는다",
  /amounts: amounts\.map\(\(a\) => gen2021Amount\(a\) as number\)/.test(ui)
  && !/gen2021Amount\([^)]*\) \?\? 0/.test(stripComments(ui))
  && !/amounts\.map\(digits\)/.test(stripComments(ui)));

// ── 복제 (첫 행이 원본) ──────────────────────────────────────────────
console.log("\n[복제] 원본은 첫 행 진료비다 — 별도 금액 칸이 없다");
{
  const cases: [string, string[], boolean][] = [
    ["첫 행 정수", ["100000", "abc"], false],
    ["첫 행 쉼표", ["100,000", "abc"], false],
    ["첫 행 명시적 0", ["0", "abc"], false],
    ["첫 행 음수", ["-1", "100000"], true],
    ["첫 행 빈 값", ["", "100000"], true],
    ["첫 행 소수", ["1.5", "100000"], true],
    ["첫 행 잘못된 쉼표", ["1,0", "100000"], true],
  ];
  for (const [what, amts, disabled] of cases) {
    const btn = screenOf(setup({ amounts: amts, priorOutVisits: "0" })).fillBtn;
    check(`${what} → 버튼 disabled=${disabled}`, btn !== undefined && btn.props.disabled === disabled);
  }
  check("복제 판정이 첫 행만 본다", /gen2021Amount\(amounts\[0\] \?\? ""\) === null/.test(ui));

  // 다른 행만 무효 + 첫 행 유효 → 전체 대체(기존 동작) 유지
  const h1 = setup({ amounts: ["100000", "abc", "xyz"], copyCount: "3", priorOutVisits: "0" });
  (screenOf(h1).fillBtn!.props.onClick as () => void)();
  check("다른 행만 무효여도 복제되고 전체가 대체된다",
    JSON.stringify(h1.get("amounts")) === JSON.stringify(["100000", "100000", "100000"]));

  const h0 = setup({ amounts: ["0", "abc"], copyCount: "2", priorOutVisits: "0" });
  (screenOf(h0).fillBtn!.props.onClick as () => void)();
  check("첫 행이 명시적 0이면 복제된다",
    JSON.stringify(h0.get("amounts")) === JSON.stringify(["0", "0"]));

  // 핸들러 방어 — 버튼 비활성만으로 끝내지 않는다
  const hBad = setup({ amounts: ["-1", "100000"], copyCount: "3", priorOutVisits: "0" });
  (screenOf(hBad).fillBtn!.props.onClick as () => void)();
  check("첫 행이 무효면 핸들러에서도 막는다(행 불변)",
    JSON.stringify(hBad.get("amounts")) === JSON.stringify(["-1", "100000"]));
  check("핸들러 방어가 소스에 있다", /if \(copySourceInvalid\) return;/.test(ui));
  check("첫 행이 무효면 이유를 화면에 밝힌다",
    setup({ amounts: ["-1", "100000"], priorOutVisits: "0" }).render().nodes
      .some((n) => n.tag === "p" && n.text.includes("복제할")));
  check("copyCount 정책은 그대로다(digits 사용·1~100 클램프)",
    /Math\.max\(1, Math\.min\(100, digits\(copyCount\)\)\)/.test(ui));
}

// ── 유지해야 할 계약 ─────────────────────────────────────────────────
console.log("\n[무회귀] 명시적 0원·횟수·승인 구간은 그대로다");
{
  const zero = screenOf(setup({ amounts: ["0", "100000"], coverage: "non_benefit", visit: "outpatient", priorOutVisits: "99" }));
  check("일반 비급여 prior=99, [0,10만] → 0원 행이 100회째를 소진(2행 제외)",
    zero.calculated && zero.pay === "0원" && zero.cells.some((c) => c.includes("한도 초과")));
  const ctrl = screenOf(setup({ amounts: ["100000"], coverage: "non_benefit", visit: "outpatient", priorOutVisits: "99" }));
  check("일반 비급여 prior=99, [10만] → 100회째 보상", ctrl.pay === "70,000원");

  const msk = screenOf(setup({ amounts: ["0", "100000"], rider: "manual_therapy", priorManualVisits: "9", approvedThrough: "" }));
  check("도수 prior=9, [0,10만], 승인 미선택 → 승인 부족 차단 유지",
    !msk.calculated && msk.warns.some((w) => w.text.includes("최초 10회")));
  check("도수 차단 안내에 판정 한계가 남아 있다",
    msk.warns.some((w) => w.text.includes("증상의 개선·병변 호전 여부를 판정하지 않습니다")));
  const mskOk = screenOf(setup({ amounts: ["100000"], rider: "manual_therapy", priorManualVisits: "9", approvedThrough: "" }));
  check("도수 prior=9, [10만] → 10회째 보상", mskOk.pay === "70,000원");

  const msk50 = screenOf(setup({ amounts: ["100000", "100000"], rider: "manual_therapy", priorManualVisits: "49", approvedThrough: 50 }));
  check("도수 prior=49, 2건, 승인 50 → 50회째 계산·51회째 제외",
    msk50.pay === "70,000원" && msk50.cells.some((c) => c.includes("한도 초과")));
  const msk51 = screenOf(setup({ amounts: ["100000"], rider: "manual_therapy", priorManualVisits: "50", approvedThrough: "" }));
  check("도수 prior=50 → 승인 차단이 아니라 횟수 한도 제외",
    msk51.calculated && msk51.cells.some((c) => c.includes("한도 초과")));

  check("주사료 3건 무회귀",
    screenOf(setup({ amounts: ["100000", "100000", "100000"], rider: "injection", priorInjectionVisits: "0" })).pay === "210,000원");
  check("MRI 무회귀", screenOf(setup({ amounts: ["1000000"], rider: "mri" })).pay === "700,000원");
  check("급여 통원 무회귀",
    screenOf(setup({ amounts: ["300000"], coverage: "benefit", visit: "outpatient", tier: "clinic" })).pay === "200,000원");
  check("비급여 입원 무회귀",
    screenOf(setup({ amounts: ["1000000"], coverage: "non_benefit", visit: "inpatient" })).pay === "700,000원");

  const plain = screenOf(setup({ amounts: ["100000"], coverage: "non_benefit", visit: "outpatient", priorOutVisits: "0" }));
  const comma = screenOf(setup({ amounts: ["100,000"], coverage: "non_benefit", visit: "outpatient", priorOutVisits: "0" }));
  check("쉼표 유무가 계산값을 바꾸지 않는다", plain.pay === comma.pay && plain.pay === "70,000원");

  check("횟수 축 파서는 그대로다", /const GEN2021_COUNT_FORMAT = \/\^\[0-9\]\+\$\/;/.test(ui));
  check("승인 회차 축은 그대로다",
    /approvedThroughVisit: approvedThrough === "" \? undefined : approvedThrough/.test(ui));
  // ⚠ 이 절은 G-2 당시 "금액 두 축은 아직 digits()"를 고정했다. G-6이 그 축을
  //   `gen2021Money`로 옮겼으므로, 여기서는 **진료비 파서가 그 축에 번지지 않았는지**만 본다.
  //   금액 축 자체의 계약은 tests/gen2021MoneyInput.test.ts가 검사한다.
  check("금액 두 축은 진료비 파서를 재사용하지 않는다",
    /priorAnnualInsurancePaid: money\.priorPaid/.test(ui)
    && /annualCoverageLimit: money\.annualLimit/.test(ui)
    && !/gen2021Amount\(priorPaid\)/.test(ui)
    && !/gen2021Amount\(annualLimit\)/.test(ui)
    // 축별 Record에서 **활성 축만** 꺼내 쓴다(G-5). 그 형태는 그대로다.
    && /const priorPaid = priorPaidByAxis\[paidAxis\];/.test(ui)
    && /const annualLimit = annualLimitByAxis\[generalAxis\];/.test(ui));
}

// ── 범위 밖 무변경 ───────────────────────────────────────────────────
console.log("\n[범위] 다른 세대·엔진·공용 위젯은 건드리지 않았다");
{
  const std = readFileSync("src/components/calculators/HealthCalcStandardized.tsx", "utf8");
  const g5 = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  const amountWidget = readFileSync("src/components/AmountInput.tsx", "utf8");
  const rawWidget = readFileSync("src/components/RawAmountInput.tsx", "utf8");
  const settle = readFileSync("src/lib/insurance/common/settle.ts", "utf8");
  const eng = readFileSync("src/lib/insurance/engine/multiClaim2021.ts", "utf8");
  check("2·3세대는 G-1 계약 그대로다", /const stdAmount = \(v: string\): number \| null =>/.test(std));
  // 5세대 진료비는 G-3에서 별도 파서로 옮겼다. 4세대 파서를 재사용하지 않는지만 본다.
  check("5세대 다회는 4세대 파서를 재사용하지 않는다",
    /const gen2026Amount = \(v: string\): number \| null =>/.test(g5)
    && !/gen2021Amount/.test(g5));
  check("공용 AmountInput은 그대로다",
    /replace\(\/\[\^0-9\]\/g, ""\)\.slice\(0, MAX_AMOUNT_DIGITS\)/.test(amountWidget));
  check("RawAmountInput은 그대로다(정제·절단 없음)",
    !/replace\(/.test(stripComments(rawWidget)) && !/slice\(/.test(stripComments(rawWidget)));
  check("엔진 normalizeAmount는 그대로다",
    /return Number\.isFinite\(amount\) \? Math\.max\(0, Math\.floor\(amount\)\) : 0;/.test(settle));
  check("4세대 엔진은 바뀌지 않았다(승인 게이트·카운터 순서 유지)",
    /countedThisBatch > 0 && visits \+ countedThisBatch > approved/.test(eng)
    && /if \(rc\.annualVisits !== null\) visits \+= 1;/.test(eng));
  check("4세대 다회가 여전히 satisfies로 초과 필드를 막는다",
    (ui.match(/\} satisfies Gen2021Multi\w+\)/g) ?? []).length >= 5);
}

console.log(`\n[4세대 진료비 입력 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
