// G-1 — 2·3세대 다회 **진료비** 입력의 엄격 검증.
//
// 종전 동작: 행 진료비와 빠른 채우기 금액이 공용 `AmountInput` → `onlyNum()` 경로였다.
//   `AmountInput`이 **파서보다 먼저** `replace(/[^0-9]/g,"")`로 문자를 지우고 15자리로
//   자르므로, 뒤에 엄격한 파서를 두어도 늦는다. 원문이 이미 다른 유효값이 된 뒤다.
//     -1 → 1(부호를 지워 양수) / 1.5 → 15(10배) / 1e3 → 13 / 1,0 → 10
//     빈 값·abc·NaN·Infinity → 0원 / 안전 정수 초과 → 15자리로 잘려 유효값
//   그리고 0원 행은 연간 외래·처방전 횟수를 1회 소진하므로, 빈 행 하나가
//   **마지막 정상 청구를 한도 초과 제외로 뒤집는다**.
//
// ⚠ 명시적으로 입력한 `0`은 유효값이다. 0원 행의 기존 처리(계산 포함·횟수 소진)는
//   이번에 바꾸지 않는다. 바뀌는 것은 "미입력·잘못된 입력이 0원이 되던 것"뿐이다.
// ⚠ 공용 `AmountInput`은 고치지 않는다. 진료비가 아닌 금액 입력까지 함께 바뀐다.
// ⚠ 부분합을 결과로 내보내지 않는다. 엔진 호출을 막고 결과를 숨기는 기존 방식을 쓴다.
// ⚠ 4·5세대와 엔진 정규화는 이번 범위가 아니다.
import { readFileSync } from "node:fs";
import HealthCalcStandardized from "../src/components/calculators/HealthCalcStandardized";
import RawAmountInput from "../src/components/RawAmountInput";
import AmountInput from "../src/components/AmountInput";
import { mount, stateNamesFrom } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const UI_PATH = "src/components/calculators/HealthCalcStandardized.tsx";
const ui = readFileSync(UI_PATH, "utf8");
const rawWidget = readFileSync("src/components/RawAmountInput.tsx", "utf8");
const amountWidget = readFileSync("src/components/AmountInput.tsx", "utf8");
const names = stateNamesFrom(ui);

/** 소스의 파서를 그대로 실행한다(테스트가 규칙을 다시 쓰지 않는다). */
const parserSrc = /const stdAmount = \(v: string\): number \| null => \{[\s\S]*?\n\};/.exec(ui)?.[0] ?? "";
const formatSrc = /const STD_AMOUNT_FORMAT = .*;/.exec(ui)?.[0] ?? "";
const stdAmount = new Function(`${formatSrc}\n${parserSrc.replace(": string", "").replace(": number | null", "")}\nreturn stdAmount;`)() as (v: string) => number | null;

/** 위젯의 실제 onChange를 통과시킨다 — state에 문자열을 직접 넣는 것과 다르다. */
const typeInto = (Comp: (p: never) => unknown, props: Record<string, unknown>, typed: string): string => {
  let got = "__NOT_CALLED__";
  const tree = Comp({ ...props, onChange: (v: string) => { got = v; } } as never) as { props: { children: unknown[] } };
  const input = (tree.props.children as { props: { onChange: (e: unknown) => void } }[])[0];
  input.props.onChange({ target: { value: typed } });
  return got;
};

// 주석은 금지형을 설명하는 자리라 제외하고, 실행되는 코드만 본다.
const stripComments = (src: string) =>
  src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

const setup = (over: Record<string, unknown> = {}) => {
  const h = mount(HealthCalcStandardized as unknown as () => unknown, names);
  h.set("plan", "standard"); h.set("submitted", true); h.set("priorVisits", "0");
  for (const [k, v] of Object.entries(over)) h.set(k, v);
  return h;
};
const withRows = (amounts: string[], over: Record<string, unknown> = {}) =>
  setup({ rows: amounts.map((a, i) => ({ id: i + 1, amount: a, visit: "outpatient", facility: "clinic" })), ...over });
const screenOf = (h: ReturnType<typeof setup>) => {
  const s = h.render();
  return {
    s,
    calculated: s.resultItems() !== null,
    values: (s.resultItems() ?? []).map((x) => x.value).join(" / "),
    warns: s.nodes.filter((n) => n.tag === "#NoticeBox" && n.props.variant === "warning"),
  };
};

const BAD: [string, string][] = [
  ["빈 문자열", ""], ["공백", "   "], ["음수", "-1"], ["소수", "1.5"], ["소수점만", "."],
  ["끝소수점", "1."], ["소수 0", "1.0"], ["선행 소수점", ".5"],
  ["잘못된 쉼표", "1,0"], ["쉼표 그룹 오류", "1,00,000"], ["선행 쉼표", ",300"],
  ["문자", "abc"], ["지수 표기", "1e3"], ["NaN", "NaN"], ["Infinity", "Infinity"],
  ["부호+", "+1"], ["공백 섞임", "300 000"], ["안전 정수 초과", "9007199254740993"],
];

// ── 파서 ──────────────────────────────────────────────────────────────
console.log("\n[파서] 원문 형식을 먼저 판정한다");
for (const [what, v] of BAD) check(`${what} → null`, stdAmount(v) === null, String(stdAmount(v)));
for (const [what, v, want] of [
  ["명시적 0", "0", 0], ["0 반복", "00", 0], ["정수", "300000", 300000],
  ["천 단위 쉼표", "300,000", 300000], ["백만 단위", "1,234,567", 1234567],
  ["선행 0", "0300000", 300000], ["안전 정수 최대", "9007199254740991", 9007199254740991],
] as [string, string, number][]) {
  check(`${what} → ${want}`, stdAmount(v) === want, String(stdAmount(v)));
}
check("쉼표를 형식 검증 뒤에만 제거한다(먼저 지우지 않는다)",
  /STD_AMOUNT_FORMAT\.test\(v\)\) return null;[\s\S]{0,80}replace\(\/,\/g/.test(ui));
check("파서가 소수점을 허용하지 않는다(5세대 다회 num()과 다르다)",
  !/\[\^0-9\.\]/.test(formatSrc) && stdAmount("1.5") === null);

// ── 위젯 ──────────────────────────────────────────────────────────────
console.log("\n[위젯] 실제 onChange를 통과해도 원문이 변형되지 않는다");
for (const [what, v] of [...BAD, ["정수", "300000"], ["천 단위 쉼표", "300,000"]] as [string, string][]) {
  check(`RawAmountInput: ${what} 원문 보존`,
    typeInto(RawAmountInput as never, { id: "t", value: "" }, v) === v,
    JSON.stringify(typeInto(RawAmountInput as never, { id: "t", value: "" }, v)));
}
check("RawAmountInput은 표시도 원문 그대로다(콤마를 만들지 않는다)",
  /value=\{value\}/.test(rawWidget) && !/toLocaleString/.test(rawWidget));
check("RawAmountInput이 입력을 정제하지 않는다",
  !/replace\(/.test(stripComments(rawWidget)) && !/slice\(/.test(stripComments(rawWidget)));

console.log("\n[범위 밖] 공용 AmountInput은 그대로다");
check("AmountInput은 여전히 숫자 외 문자를 지운다",
  typeInto(AmountInput as never, { id: "t", value: "" }, "-1") === "1"
  && typeInto(AmountInput as never, { id: "t", value: "" }, "1.5") === "15");
check("AmountInput은 여전히 15자리로 자른다",
  typeInto(AmountInput as never, { id: "t", value: "" }, "9007199254740993") === "900719925474099");
check("AmountInput 소스가 바뀌지 않았다(정제·절단 유지)",
  /replace\(\/\[\^0-9\]\/g, ""\)\.slice\(0, MAX_AMOUNT_DIGITS\)/.test(amountWidget));
// ⚠ 이 두 검사는 G-1 당시 "금액 두 축은 아직 AmountInput"을 고정했다. G-7이 그 축을
//   RawAmountInput으로 옮겼으므로, 이제 이 화면에는 AmountInput이 남아 있지 않다.
//   금액 축 자체의 계약은 tests/gen2009MoneyInput.test.ts가 검사한다.
check("2·3세대는 네 금액 입력 모두 RawAmountInput을 쓴다",
  (ui.match(/<AmountInput/g) ?? []).length === 0
  && !/import AmountInput/.test(ui)
  && (ui.match(/<RawAmountInput/g) ?? []).length === 4
  && /id=\{`std-amount-\$\{row\.id\}`\}/.test(ui) && /id="std-quick-amount"/.test(ui)
  && /id="std-per-visit-limit"/.test(ui) && /id="std-prior-paid"/.test(ui));
check("공용 AmountInput 파일 자체는 그대로다(다른 화면이 계속 쓴다)",
  /replace\(\/\[\^0-9\]\/g, ""\)\.slice\(0, MAX_AMOUNT_DIGITS\)/.test(amountWidget));

// ── 화면 전이 ────────────────────────────────────────────────────────
console.log("\n[화면] 실제 입력 → 상태 → 결과");
{
  const h = withRows(["300000"]);
  const before = screenOf(h);
  check("정상 입력은 계산된다", before.calculated && before.values.startsWith("300,000원"));

  const node = h.render().nodes.find((n) => n.tag === "#RawAmountInput" && String(n.props.id).startsWith("std-amount-"));
  check("행 진료비가 RawAmountInput으로 렌더된다", node !== undefined);
  // 위젯의 onChange를 통과시켜 부모 상태를 바꾼다(문자열 직접 주입이 아니다).
  const fire = (typed: string) => {
    const n = h.render().nodes.find((x) => x.tag === "#RawAmountInput" && String(x.props.id).startsWith("std-amount-"))!;
    const tree = (RawAmountInput as unknown as (p: never) => { props: { children: unknown[] } })(n.props as never);
    ((tree.props.children as { props: { onChange: (e: unknown) => void } }[])[0]).props.onChange({ target: { value: typed } });
  };
  fire("-1");
  check("'-1'이 state에 원문으로 남는다(1이 되지 않는다)", (h.get("rows") as { amount: string }[])[0].amount === "-1");
  const afterBad = screenOf(h);
  check("'-1' 입력 시 결과가 사라진다", !afterBad.calculated);
  check("'-1' 입력 시 진료비 안내가 뜬다", afterBad.warns.some((w) => w.text.includes("진료비")));
  fire("300,000");
  check("'300,000'이 state에 원문으로 남는다", (h.get("rows") as { amount: string }[])[0].amount === "300,000");
  const afterGood = screenOf(h);
  check("'300,000' 입력 시 계산이 재개된다", afterGood.calculated && afterGood.values.startsWith("300,000원"));
  fire("0");
  check("'0'은 유효값이라 안내가 뜨지 않는다", !screenOf(h).warns.some((w) => w.text.includes("올바르게 입력")));
}

console.log("\n[화면] 한 행만 어긋나도 묶음 전체를 계산하지 않는다");
for (const [what, v] of BAD) {
  const scr = screenOf(withRows(["300000", v]));
  check(`행2 ${what} → 결과 없음`, !scr.calculated);
  check(`행2 ${what} → 안내 1건`, scr.warns.filter((w) => w.text.includes("진료비")).length === 1);
}
check("안내가 몇 번째 행인지 밝힌다",
  screenOf(withRows(["300000", "abc", "300000"])).warns.some((w) => w.text.includes("2") && w.text.includes("진료비")));
check("안내가 0원 입력 방법을 알려준다",
  screenOf(withRows(["300000", ""])).warns.some((w) => w.text.includes("0") && w.text.includes("입력하세요")));
// G-7이 금액 두 축을 게이트에 합류시켜 `gated`가 `money`를 거쳐 엔진 인자를 만든다.
//   차단 계약 자체는 그대로다 — 게이트가 걸리면 엔진 호출식에 도달하지 않는다.
check("차단 중에는 엔진을 호출하지 않는다(부분합 계약을 만들지 않는다)",
  /const money = gated \|\| perVisitNum === null \|\| priorPaidNum === null \? null : \{/.test(ui)
  && /const result = money === null \? null : calculateMany\(/.test(ui));
// ⚠ 게이트가 있으니 `?? 0`이 닿지 않는다 — 지금은 동작이 같다. 그래도 금지한다:
//   나중에 게이트를 손대면 무효 행이 조용히 0원으로 되살아나 이 커밋의 결함이 되돌아온다.
check("무효 행을 0원으로 대체하는 경로를 두지 않는다",
  /amount: stdAmount\(r\.amount\) as number,/.test(ui)
  && !/stdAmount\([^)]*\) \?\? 0/.test(stripComments(ui))
  && !/onlyNum\(r\.amount\)/.test(stripComments(ui)));

// ── 무회귀 ───────────────────────────────────────────────────────────
console.log("\n[무회귀] 명시적 0원과 기존 카운터 동작은 그대로다");
{
  const both = screenOf(withRows(["0", "300000"]));
  check("0원 행은 계산에 포함된다", both.calculated && both.values.startsWith("300,000원"));
  const boundary = screenOf(withRows(["0", "300000"], { priorVisits: "179" }));
  check("0원 행이 외래 횟수를 1회 소진한다(기존 동작 유지)",
    boundary.calculated && boundary.values === "300,000원 / 300,000원 / 0원");
  const noZero = screenOf(withRows(["300000"], { priorVisits: "179" }));
  check("0원 행이 없으면 180회째가 보상된다", noZero.values === "300,000원 / 60,000원 / 240,000원");
  check("전체 합이 0원이면 결과를 숨기는 기존 게이트가 유지된다",
    !screenOf(withRows(["0"])).calculated && /result\.totalAmount > 0/.test(ui));
}

console.log("\n[빠른 채우기] 잘못된 금액을 행에 복사하지 않는다");
{
  const bad = setup({ quickAmount: "-1" });
  const fillBtn = bad.render().nodes.find((n) => n.tag === "button" && n.text.includes("채우기"));
  check("잘못된 금액이면 채우기 버튼이 비활성", fillBtn !== undefined && fillBtn.props.disabled === true);
  check("잘못된 금액이면 이유를 화면에 밝힌다",
    bad.render().nodes.some((n) => n.tag === "p" && n.text.includes("채울 금액은")));
  const ok = setup({ quickAmount: "300,000" });
  const okBtn = ok.render().nodes.find((n) => n.tag === "button" && n.text.includes("채우기"));
  check("정상 금액이면 채우기 버튼이 활성", okBtn !== undefined && okBtn.props.disabled === false);
  check("빠른 채우기도 RawAmountInput을 쓴다",
    ok.render().nodes.some((n) => n.tag === "#RawAmountInput" && n.props.id === "std-quick-amount"));
  check("quickFill이 잘못된 금액이면 조기 반환한다",
    /if \(quickAmountInvalid\) return;/.test(ui));
}

// ── 이번 범위 밖 무변경 ──────────────────────────────────────────────
console.log("\n[범위] 다른 세대·엔진은 건드리지 않았다");
{
  const g4 = readFileSync("src/components/calculators/HealthCalcMulti2021.tsx", "utf8");
  const g5 = readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8");
  const settle = readFileSync("src/lib/insurance/common/settle.ts", "utf8");
  const multi = readFileSync("src/lib/insurance/engine/multiClaim.ts", "utf8");
  check("4세대 다회는 여전히 digits()로 진료비를 읽는다(범위 밖)",
    /const digits = \(v: string\) => Number\(v\.replace\(\/\[\^0-9\]\/g, ""\)\) \|\| 0;/.test(g4));
  check("5세대 다회는 여전히 num()으로 진료비를 읽는다(범위 밖)",
    /const num = \(v: string\) => Number\(v\.replace\(\/\[\^0-9.\]\/g, ""\)\) \|\| 0;/.test(g5));
  check("엔진 normalizeAmount는 그대로다",
    /return Number\.isFinite\(amount\) \? Math\.max\(0, Math\.floor\(amount\)\) : 0;/.test(settle));
  check("2·3세대 엔진은 여전히 normalizeAmount로 방어한다",
    /normalizeAmount\(line\.amount\)/.test(multi));
  check("2·3세대 횟수 파서는 그대로다",
    /const STD_COUNT_FORMAT = \/\^\[0-9\]\+\$\/;/.test(ui));
  // ⚠ 이 검사는 G-1 당시 "금액 두 축은 아직 onlyNum()"을 고정했다. G-7이 그 축을
  //   `stdMoney`로 옮겼으므로, 여기서는 **진료비 파서가 그 축에 번지지 않았는지**만 본다.
  //   ⚠ `priorAnnualPaid`는 지급보험금이 아니라 **기존 입원 자기부담금**이다(화면 라벨과
  //     generationStandardized.ts의 200만원 상한 소진 산식이 그렇다). 이름으로 4세대의
  //     `priorAnnualInsurancePaid`와 같은 것으로 읽으면 방향이 반대가 된다.
  check("금액 두 축은 진료비 파서를 재사용하지 않는다",
    /priorAnnualPaid: money\.priorPaid,/.test(ui)
    && /perVisitCoverageLimit: money\.perVisit,/.test(ui)
    && !/stdAmount\(priorPaid\)/.test(ui) && !/stdAmount\(perVisitLimit\)/.test(ui)
    && !/onlyNum\(priorPaid\)/.test(ui) && !/onlyNum\(perVisitLimit\)/.test(ui));
  check("빠른 채우기 횟수는 여전히 onlyNum()을 쓴다(범위 밖)",
    /Math\.max\(1, onlyNum\(quickCount\) \|\| 1\)/.test(ui));
}

console.log(`\n[2·3세대 진료비 입력 검증] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
