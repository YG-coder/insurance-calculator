// 안전성 커밋 — 세대별 '반복/복제 횟수' 입력의 엄격 검증 (G-13B).
//
// ⚠ 이 값은 **만들 행 수**일 뿐이다. 보험 횟수·한도·소진 상태와 아무 관계가 없고,
//   합치지도 않는다. 엔진·규칙값·HOLD·진료비·가입금액·공제금액·보험 횟수 입력 계약은
//   이 커밋에서 바뀌지 않았다.
//
// 종전 동작(공용 onlyNum()/digits()/num()) — 기준선 b5477b3 실행으로 확인:
//   `1.5`→15행(2·3·4세대, 점을 지운다) / 1행(5세대, 내림)
//   `1e3`→13행 · `1,0`→10행 · `20만`→20행 · `abc`·빈 값·공백·`0`→1행
//   상한 초과·안전 정수 최대값→상한으로 절삭
//   ⚠ 그리고 **무효값에서도 버튼이 실행돼 이미 입력한 행을 전부 지우고 1행으로 만들었다**
//     (세 화면 모두 4행 → 1행을 실측). 이것이 이번에 고치는 가장 큰 결함이다.
//
// ⚠ 세 화면의 파서를 하나로 합치지 않는다. 상한(20 / 100 / 100)과 라벨·안내가 다르다.
import { readFileSync } from "node:fs";
import HealthCalcStandardized from "../src/components/calculators/HealthCalcStandardized";
import HealthCalcMulti2021 from "../src/components/calculators/HealthCalcMulti2021";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
import { mount, stateNamesFrom } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type H = ReturnType<typeof mount>;
const nodes = (h: H) => (h.render() as any).nodes as any[];
const byAria = (h: H, aria: string) => nodes(h).find((n) => n.props?.["aria-label"] === aria) ?? null;
const byId = (h: H, id: string) => nodes(h).find((n) => n.props?.id === id) ?? null;
const buttons = (h: H, text: string) => nodes(h).filter((n) => n.tag === "button" && n.text === text);
/** 실제 위젯의 onChange로 입력한다. RawAmountInput은 원문 문자열을 그대로 받는다. */
const type = (node: any, v: string) => {
  if (node === null) throw new Error("입력 없음");
  if (node.props.disabled === true) throw new Error("비활성 입력");
  if (node.tag === "#RawAmountInput") node.props.onChange(v);
  else node.props.onChange({ target: { value: v } });
};

const SRC = {
  std: readFileSync("src/components/calculators/HealthCalcStandardized.tsx", "utf8"),
  g21: readFileSync("src/components/calculators/HealthCalcMulti2021.tsx", "utf8"),
  g26: readFileSync("src/components/calculators/HealthCalcMulti2026.tsx", "utf8"),
};
const strip = (s: string) => s
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");

interface Screen {
  name: string; max: number; aria: string; btn: string; addBtn: string;
  setup: () => H;
  /** 복제 원본 금액 입력에 값을 넣는다. */
  setSource: (h: H, v: string) => void;
  /** 현재 행들의 금액 목록. */
  rows: (h: H) => string[];
  src: string;
}
const SCREENS: Screen[] = [
  {
    name: "2·3세대 (반복 횟수)", max: 20, aria: "반복 횟수", btn: "채우기", addBtn: "+ 행 추가",
    setup: () => mount(HealthCalcStandardized, stateNamesFrom(SRC.std)),
    setSource: (h, v) => type(byId(h, "std-quick-amount"), v),
    rows: (h) => (h.get("rows") as { amount: string }[]).map((r) => r.amount),
    src: SRC.std,
  },
  {
    name: "4세대 (복사할 횟수)", max: 100, aria: "복사할 횟수", btn: "첫 금액 × N회", addBtn: "행 추가",
    setup: () => mount(HealthCalcMulti2021, stateNamesFrom(SRC.g21)),
    setSource: (h, v) => type(nodes(h).find((n) => n.tag === "#RawAmountInput") ?? null, v),
    rows: (h) => h.get("amounts") as string[],
    src: SRC.g21,
  },
  {
    name: "5세대 (복사할 횟수)", max: 100, aria: "복사할 횟수", btn: "첫 금액 × N회", addBtn: "행 추가",
    setup: () => mount(HealthCalcMulti2026, stateNamesFrom(SRC.g26)),
    setSource: (h, v) => type(byId(h, "gen2026-amount-0"), v),
    rows: (h) => h.get("amounts") as string[],
    src: SRC.g26,
  },
];

const INVALID = ["", "0", "00", "-1", "+1", "1.5", "1e3", "1,0", "20만", "abc", "   ", " 1 ", "9007199254740993"];

for (const s of SCREENS) {
  console.log(`\n[${s.name}] 상한 ${s.max}`);

  // ── 유효 격자 — 정확히 그 개수만 만든다 ──
  {
    const VALID = ["1", "01", "2", "3", String(s.max)];
    for (const v of VALID) {
      const h = s.setup();
      s.setSource(h, "300000");
      type(byAria(h, s.aria), v);
      const b = buttons(h, s.btn)[0];
      check(`유효 ${JSON.stringify(v)}: 버튼 활성`, b.props.disabled !== true);
      b.props.onClick();
      const rows = s.rows(h);
      check(`유효 ${JSON.stringify(v)}: 정확히 ${Number(v)}행 · 원본 문자열 복제`,
        rows.length === Number(v) && rows.every((a) => a === "300000"),
        `${rows.length}행 [${rows.slice(0, 3).join(",")}]`);
    }
  }

  // ── 무효 격자 — 버튼 비활성 + 행 불변 ──
  {
    const grid = [...INVALID, String(s.max + 1), "9007199254740991"];
    for (const v of grid) {
      const h = s.setup();
      s.setSource(h, "300000");
      for (let i = 0; i < 3; i++) buttons(h, s.addBtn)[0].props.onClick();
      const before = JSON.stringify(s.rows(h));
      type(byAria(h, s.aria), v);
      const b = buttons(h, s.btn)[0];
      const disabled = b.props.disabled === true;
      // 버튼을 직접 호출해도 행 배열이 바뀌지 않아야 한다(UI 우회 방지).
      b.props.onClick();
      const after = JSON.stringify(s.rows(h));
      check(`무효 ${JSON.stringify(v)}: 버튼 비활성 · 직접 호출해도 행 불변`,
        disabled && before === after, `disabled=${disabled} 전=${before} 후=${after}`);
      check(`무효 ${JSON.stringify(v)}: 원문이 화면에 남는다`,
        String(byAria(h, s.aria).props.value) === v);
    }
  }

  // ── 상한 경계 ──
  {
    const ok = s.setup(); s.setSource(ok, "300000");
    type(byAria(ok, s.aria), String(s.max));
    buttons(ok, s.btn)[0].props.onClick();
    const over = s.setup(); s.setSource(over, "300000");
    for (let i = 0; i < 2; i++) buttons(over, s.addBtn)[0].props.onClick();
    const beforeOver = JSON.stringify(s.rows(over));
    type(byAria(over, s.aria), String(s.max + 1));
    over.render();
    const overBtn = buttons(over, s.btn)[0];
    overBtn.props.onClick();
    check(`경계 ${s.max}/${s.max + 1}: ${s.max}은 정확히 ${s.max}행, ${s.max + 1}은 차단(절삭 없음)`,
      s.rows(ok).length === s.max && overBtn.props.disabled === true
      && JSON.stringify(s.rows(over)) === beforeOver,
      `${s.rows(ok).length} / ${JSON.stringify(s.rows(over)).slice(0, 40)}`);
  }

  // ── 원본 유효·무효 × 횟수 유효·무효 교차 ──
  {
    const cases: [string, string, boolean][] = [
      ["300000", "2", false],   // 둘 다 유효 → 실행
      ["-1", "2", true],        // 원본 무효 → 차단(종전 계약)
      ["300000", "abc", true],  // 횟수 무효 → 차단(이번 계약)
      ["-1", "abc", true],      // 둘 다 무효 → 차단
    ];
    for (const [amount, count, blocked] of cases) {
      const h = s.setup();
      s.setSource(h, amount);
      for (let i = 0; i < 2; i++) buttons(h, s.addBtn)[0].props.onClick();
      const before = JSON.stringify(s.rows(h));
      type(byAria(h, s.aria), count);
      const b = buttons(h, s.btn)[0];
      b.props.onClick();
      const after = JSON.stringify(s.rows(h));
      check(`교차 원본=${JSON.stringify(amount)} 횟수=${JSON.stringify(count)} → ${blocked ? "차단" : "실행"}`,
        blocked ? (b.props.disabled === true && before === after)
                : (b.props.disabled !== true && s.rows(h).length === 2),
        `disabled=${b.props.disabled} 전=${before.slice(0, 30)} 후=${after.slice(0, 30)}`);
    }
  }

  // ── 명시적 0원 복제는 그대로 ──
  {
    const h = s.setup();
    s.setSource(h, "0");
    type(byAria(h, s.aria), "3");
    buttons(h, s.btn)[0].props.onClick();
    const rows = s.rows(h);
    check("명시적 진료비 0 복제 유지", rows.length === 3 && rows.every((a) => a === "0"), JSON.stringify(rows));
  }

  // ── 다른 행이 무효여도 첫 행 원본과 횟수가 유효하면 복제한다(종전 계약) ──
  {
    const h = s.setup();
    s.setSource(h, "300000");
    buttons(h, s.addBtn)[0].props.onClick();
    // 두 번째 행을 무효로 만든다 — 화면에서 실제 입력으로.
    const second = s.name.startsWith("2·3")
      ? nodes(h).filter((n) => n.tag === "#RawAmountInput" && String(n.props.id).startsWith("std-amount-"))[1]
      : nodes(h).filter((n) => n.tag === "#RawAmountInput" && /amount-\d/.test(String(n.props.id)))[1];
    if (second) type(second, "-1");
    type(byAria(h, s.aria), "2");
    const b = buttons(h, s.btn)[0];
    check("다른 행이 무효여도 복제는 막지 않는다", b.props.disabled !== true);
    b.props.onClick();
    check("  복제 결과는 첫 행 원본 2개", s.rows(h).length === 2 && s.rows(h).every((a) => a === "300000"),
      JSON.stringify(s.rows(h)));
  }

  // ── 소스 계약 ──
  {
    const body = strip(s.src);
    check("전용 파서를 쓰고 공용 관용 정제로 돌아가지 않았다",
      !/onlyNum\(quickCount\)/.test(body) && !/digits\(copyCount\)/.test(body) && !/num\(copyCount\)/.test(body));
    // ⚠ 복제/채우기 핸들러 안만 본다. 5세대의 `Math.min(100, num(nhisRate))`는 본인부담률이고
    //   G-13C 범위라 이 커밋에서 건드리지 않았다 — 여기서 잡으면 오탐이다.
    const handler = (body.match(/onClick=\{\(\) => \{[\s\S]*?\}\}/g) ?? []).join("\n")
      + (body.match(/const quickFill = \(\) => \{[\s\S]*?\n  \};/g) ?? []).join("\n");
    check("복제 핸들러에 상한 절삭·1 대체가 없다",
      !/Math\.min\(/.test(handler) && !/Math\.max\(/.test(handler) && !/Math\.floor\(/.test(handler),
      handler.slice(0, 120));
    check("핸들러에 조기 반환이 있다(UI 우회 방지)",
      /if \((?:quickCountNum|copyCountNum) === null\) return;/.test(body));
    check("생성 길이는 검증된 숫자 그대로다",
      /Array\.from\(\{ length: (?:quickCountNum|count|copyCountNum) \}/.test(body));
    // ⚠ 소스 문자열이 아니라 **렌더된 위젯 노드**를 본다. 주석이 `type="number"`를 언급하므로
    //   소스 검사로는 판정할 수 없다.
    const w = byAria(s.setup(), s.aria);
    check("원문 보존 입력이다(type=number·min·max 없음)",
      w !== null && w.props.type === undefined && w.props.min === undefined && w.props.max === undefined
      && w.props.inputMode === "numeric",
      JSON.stringify({ type: w?.props.type, min: w?.props.min, max: w?.props.max, inputMode: w?.props.inputMode }));
    check("보험 횟수 상태와 합치지 않는다",
      !/quickCount.*priorVisits|priorVisits.*quickCount/.test(body)
      && !/copyCount.*priorCountByItem|priorCountByItem.*copyCount/.test(body)
      && !/copyCount.*priorOutVisits|priorOutVisits.*copyCount/.test(body));
  }
}

// ── 세대별 상한이 서로 다르고 파서가 분리돼 있다 ──
console.log("\n[분리] 세 화면이 각자의 파서와 상한을 쓴다");
{
  check("2·3세대: stdRepeatCount · MAX_ROWS",
    /const stdRepeatCount = \(v: string\): number \| null =>/.test(SRC.std)
    && /n >= 1 && n <= MAX_ROWS/.test(SRC.std) && /const MAX_ROWS = 20;/.test(SRC.std));
  check("4세대: gen2021CopyCount · GEN2021_MAX_COPIES = 100",
    /const gen2021CopyCount = \(v: string\): number \| null =>/.test(SRC.g21)
    && /n >= 1 && n <= GEN2021_MAX_COPIES/.test(SRC.g21) && /const GEN2021_MAX_COPIES = 100;/.test(SRC.g21));
  check("5세대: gen2026CopyCount · GEN2026_MAX_COPIES = 100",
    /const gen2026CopyCount = \(v: string\): number \| null =>/.test(SRC.g26)
    && /n >= 1 && n <= GEN2026_MAX_COPIES/.test(SRC.g26) && /const GEN2026_MAX_COPIES = 100;/.test(SRC.g26));
  check("세 파서 이름이 서로 다르다(공유 아님)",
    !SRC.std.includes("gen2021CopyCount") && !SRC.std.includes("gen2026CopyCount")
    && !SRC.g21.includes("stdRepeatCount") && !SRC.g21.includes("gen2026CopyCount")
    && !SRC.g26.includes("stdRepeatCount") && !SRC.g26.includes("gen2021CopyCount"));
  check("2·3세대 횟수 파서(stdCount)와도 분리돼 있다",
    /const stdCount = \(v: string\): number \| null =>/.test(SRC.std)
    && /n >= 0 \? n : null;/.test(SRC.std));
  check("4세대 횟수 파서(gen2021Count)와도 분리돼 있다",
    /const gen2021Count = \(v: string\): number \| null =>/.test(SRC.g21));
  check("5세대 통원·보상 횟수 파서와도 분리돼 있다",
    /const nonNegSafeInt = \(v: string\): number \| null =>/.test(SRC.g26)
    && /const coveredCount = nonNegSafeInt;/.test(SRC.g26));
}

// ── 공용 위젯과 다른 입력 계약은 그대로 ──
console.log("\n[무변경] 공용 위젯과 다른 입력 계약");
{
  const raw = readFileSync("src/components/RawAmountInput.tsx", "utf8");
  const amt = readFileSync("src/components/AmountInput.tsx", "utf8");
  check("RawAmountInput 무변경(정제 없음)", !/\.trim\(/.test(raw) && !/\.replace\(/.test(raw) && !/slice\(/.test(raw));
  check("AmountInput 무변경", /replace\(\/\[\^0-9\]\/g, ""\)\.slice\(0, MAX_AMOUNT_DIGITS\)/.test(amt));
  check("진료비 파서 3종 그대로",
    /const stdAmount = \(v: string\): number \| null =>/.test(SRC.std)
    && /const gen2021Amount = \(v: string\): number \| null =>/.test(SRC.g21)
    && /const gen2026Amount = \(v: string\): number \| null =>/.test(SRC.g26));
  check("보험 횟수 게이트 그대로",
    /const needsVisits = usesVisits && stdCount\(priorVisits\) === null;/.test(SRC.std)
    && /const needsOutVisits = usesOutVisits && gen2021Count\(priorOutVisits\) === null;/.test(SRC.g21)
    && /const needsPriorCount = countedItem !== null && priorCountNum === null;/.test(SRC.g26));
  check("엔진·규칙 파일을 이 커밋에서 건드리지 않았다",
    /const counts = spec\.annualVisits !== null && amount > 0;/.test(
      readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8")));
}

console.log(`\n[반복·복제 횟수 입력] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
