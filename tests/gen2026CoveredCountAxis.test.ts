// 안전성 커밋 — 5세대 다회 '이미 보상한 횟수'의 항목별 분리와 엄격 검증 (G-13A).
//
// ⚠ 새 규제 숫자를 만들지 않는다. 연 50회 한도·350만/250만 보장한도·승인 회차·지급 0원
//   HOLD는 그대로다. 바뀌는 것은 **화면의 과거 상태를 어떻게 담고 검증하는가**뿐이다.
//
// 종전 동작(단일 상태 + num()): 근골격계에 넣은 값이 주사료로 그대로 넘어갔고, 초기값이
//   "0"이라 사용자가 확인하지 않은 "보상 이력 없음"을 화면이 대신 만들어 냈다.
//   실측: 근골격계 50 → 주사료로 전환하면 주사료도 50회로 보상 제외(0원),
//         주사료 10 → 근골격계로 복귀하면 원래 50이 사라져 420,000원(보험금이 더 나오는 방향).
//
// ⚠ 등록 규칙이 두 항목의 금액·횟수 한도를 <표1>의 서로 다른 행으로 각각 등록하고
//   (GEN2026-MSK-ANNUAL-*, GEN2026-INJECTION-ANNUAL-*), 엔진도 항목별 annualVisits·visitsCap을
//   고른다. 이 커밋은 그 **등록된 항목별 한도와 엔진 입력에 맞춰 UI의 과거 상태를 분리**한 것이다.
//   "두 한도가 약관상 서로 독립"이라는 더 넓은 주장을 하지 않는다.
// ⚠ priorActs(priorAnnualTreatmentActCount)는 승인 회차 전용 축으로 계속 분리한다.
import { readFileSync } from "node:fs";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
import { calculateGen2026Item } from "../src/lib/insurance/engine/specialItem2026";
import { Gen2026ItemClaimInput } from "../src/lib/insurance/engine/types";
import { REGULATORY_RULES } from "../src/lib/insurance/engine/regulatoryRules";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
import { mount, stateNamesFrom } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

const SRC = "src/components/calculators/HealthCalcMulti2026.tsx";
const ui = readFileSync(SRC, "utf8");
/** 주석을 지운 본문 — 설명 문구가 소스 검사를 통과시키지 않게 한다. */
const body = ui
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");

/* eslint-disable @typescript-eslint/no-explicit-any */
type H = ReturnType<typeof mount>;
const names = stateNamesFrom(ui);
const nodes = (h: H) => (h.render() as any).nodes as any[];
const selByLabel = (h: H, prefix: string) => {
  const lab = nodes(h).find((n) => n.tag === "label" && n.text.startsWith(prefix));
  if (!lab) return null;
  const found: any[] = [];
  const walk = (el: any): void => {
    if (el === null || el === undefined || typeof el !== "object") return;
    if (Array.isArray(el)) { el.forEach(walk); return; }
    if (el.type === "select") found.push(el);
    walk(el.props?.children);
  };
  walk(lab.props.children);
  return found[0] ?? null;
};
/** 실제 선택창 핸들러로 고른다. 상태를 직접 넣지 않는다. */
const pick = (h: H, label: string, value: string) => {
  const s = selByLabel(h, label);
  if (s === null) throw new Error(`선택창 없음: ${label}`);
  const opts = (s.props.children as any[]).flat(9).map((o: any) => o?.props?.value);
  if (!opts.includes(value)) throw new Error(`옵션 없음 ${label}=${value} (${opts.join(",")})`);
  s.props.onChange({ target: { value } });
};
const rawById = (h: H, id: string) => nodes(h).find((n) => n.props?.id === id) ?? null;
/** '이미 보상한 횟수' 입력. 접근성 이름으로 찾아 어느 보장종목인지도 함께 본다. */
const countInput = (h: H) => nodes(h).find((n) => n.tag === "input"
  && typeof n.props["aria-label"] === "string"
  && (n.props["aria-label"] as string).endsWith("이미 보상한 횟수")) ?? null;
const actsInput = (h: H) => nodes(h).find((n) => n.tag === "input" && n.props.placeholder === "받은 치료가 없으면 0") ?? null;
const rowVisit = (h: H, i: number) => nodes(h).filter((n) => n.tag === "select"
  && (n.props.children as any[]).flat(9).some((o: any) => o?.props?.value === "outpatient")
  && (n.props.children as any[]).flat(9).some((o: any) => o?.props?.value === ""))[i];
/** 실제 위젯의 onChange로 입력한다. RawAmountInput은 원문 문자열을 그대로 받는다. */
const type = (node: any, v: string) => {
  if (node === null) throw new Error("입력 없음");
  if (node.props.disabled === true) throw new Error("비활성 입력");
  if (node.tag === "#RawAmountInput") node.props.onChange(v);
  else node.props.onChange({ target: { value: v } });
};
const submit = (h: H) => {
  const b = nodes(h).filter((n) => n.tag === "button" && n.text === "여러 건 계산하기")[0];
  if (b && b.props.disabled !== true) b.props.onClick();
};
const pay = (h: H) => {
  const items = (h.render() as any).resultItems() as { label: string; value: string }[] | null;
  if (items === null) return "결과 없음";
  return (items.find((i) => i.label.includes("보험")) ?? { value: "?" }).value;
};
const shown = (h: H) => { const n = countInput(h); return n === null ? null : String(n.props.value); };
const itemOfLabel = (h: H) => { const n = countInput(h); return n === null ? null : String(n.props["aria-label"]); };
const blockNotice = (h: H) => (h.render() as any).text.includes("계산기가 0으로 추정하지 않습니다. 0 이상의 정수만 받으며 음수·소수·지수 표기");

/** 중증 근골격계 · 통원 2행 · 승인 회차 기본값 · 치료행위 수 0. */
const base = (): H => {
  const h = mount(HealthCalcMulti2026, names);
  pick(h, "치료유형", "musculoskeletal_esw");
  pick(h, "질환 구분", "critical");
  type(rawById(h, "gen2026-row-amount-0"), "300000");
  type(rawById(h, "gen2026-row-amount-1"), "300000");
  rowVisit(h, 0).props.onChange({ target: { value: "outpatient" } });
  rowVisit(h, 1).props.onChange({ target: { value: "outpatient" } });
  type(actsInput(h), "0");
  return h;
};
const toInjection = (h: H) => { pick(h, "치료유형", "injection"); pick(h, "약제 용도", "general"); };

// ── 근거 ──────────────────────────────────────────────────────────────
console.log("\n[근거] 새 규제 숫자를 만들지 않는다");
{
  check("연 50회 한도 두 건이 등록부 그대로다",
    REGULATORY_RULES.GEN2026_MSK_ANNUAL_VISITS.value === 50
    && REGULATORY_RULES.GEN2026_INJECTION_ANNUAL_VISITS.value === 50);
  check("항목별 보장한도도 그대로다(350만 / 250만)",
    REGULATORY_RULES.GEN2026_MSK_ANNUAL_COVERAGE.value === 3_500_000
    && REGULATORY_RULES.GEN2026_INJECTION_ANNUAL_COVERAGE.value === 2_500_000);
  check("화면은 숫자를 하드코딩하지 않고 규칙값을 참조한다",
    /musculoskeletal_esw: GEN2026\.specialItem\.msk\.annualVisits,/.test(body)
    && /injection: GEN2026\.specialItem\.injection\.annualVisits,/.test(body)
    && GEN2026.specialItem.msk.annualVisits === 50
    && GEN2026.specialItem.injection.annualVisits === 50);
}

// ── 엔진: 항목별 한도가 실제로 갈리는가 ───────────────────────────────
//   ⚠ 이 커밋의 UI 분리는 "엔진이 항목별 한도를 고른다"는 사실 위에 서 있다. 그 사실
//     자체를 여기서 못박는다 — 종전에는 `limitsOf()`의 주사료 분기를 근골격계로 바꿔도
//     전체 스위트가 잡지 못했다(연 횟수가 둘 다 50이라 횟수로는 구분되지 않는다).
console.log("\n[엔진] 두 보장종목이 각자의 연간 보장한도를 쓴다");
{
  const big = 10_000_000;
  const msk = calculateGen2026Item({
    route: "special_item", coverage: "non_benefit", severity: "critical",
    item: "musculoskeletal_esw", lines: [{ amount: big, visit: "outpatient" }],
    approvedThroughVisit: 10, priorAnnualTreatmentActCount: 0,
    priorAnnualCoveredCount: 0, priorAnnualInsurancePaid: 0,
  } as unknown as Gen2026ItemClaimInput) as unknown as { totalInsurancePay: number | null; appliedCaps: string[] };
  const inj = calculateGen2026Item({
    route: "special_item", coverage: "non_benefit", severity: "critical",
    item: "injection", injectionPurpose: "general", lines: [{ amount: big, visit: "outpatient" }],
    priorAnnualCoveredCount: 0, priorAnnualInsurancePaid: 0,
  } as unknown as Gen2026ItemClaimInput) as unknown as { totalInsurancePay: number | null; appliedCaps: string[] };
  check("근골격계는 350만원 한도에 걸린다",
    msk.totalInsurancePay === REGULATORY_RULES.GEN2026_MSK_ANNUAL_COVERAGE.value
    && msk.appliedCaps.includes("GEN2026_MSK_ANNUAL_COVERAGE"), String(msk.totalInsurancePay));
  check("주사료는 250만원 한도에 걸린다",
    inj.totalInsurancePay === REGULATORY_RULES.GEN2026_INJECTION_ANNUAL_COVERAGE.value
    && inj.appliedCaps.includes("GEN2026_INJECTION_ANNUAL_COVERAGE"), String(inj.totalInsurancePay));
  check("두 한도가 실제로 다르다(항목별 선택이 살아 있다)",
    msk.totalInsurancePay !== inj.totalInsurancePay);
}

// ── ① 항목 전환 왕복 ──────────────────────────────────────────────────
console.log("\n[전환] 근골격계 ↔ 주사료 왕복에서 값이 섞이지 않는다");
{
  const h = base();
  check("근골격계 첫 진입은 미입력이라 계산하지 않는다",
    shown(h) === "" && pay(h) === "결과 없음");
  check("  라벨이 보장종목을 밝힌다", itemOfLabel(h) === "근골격계 이학요법·체외충격파로 이미 보상한 횟수", String(itemOfLabel(h)));

  type(countInput(h), "50"); submit(h);
  check("근골격계 50 → 연 50회 소진으로 0원", pay(h) === "0원", pay(h));

  toInjection(h); submit(h);
  check("주사료 첫 진입은 빈 값이고 계산이 차단된다",
    shown(h) === "" && pay(h) === "결과 없음" && blockNotice(h), `표시=${shown(h)} 보험=${pay(h)}`);
  check("  라벨이 주사료로 바뀐다", itemOfLabel(h) === "비급여 주사료로 이미 보상한 횟수", String(itemOfLabel(h)));

  type(countInput(h), "10"); submit(h);
  check("주사료 10 → 계산됨", pay(h) === "420,000원", pay(h));

  pick(h, "치료유형", "musculoskeletal_esw"); submit(h);
  check("근골격계 복귀 — 원문 50과 0원이 복원된다",
    shown(h) === "50" && pay(h) === "0원", `표시=${shown(h)} 보험=${pay(h)}`);

  toInjection(h); submit(h);
  check("주사료 재복귀 — 원문 10과 결과가 복원된다",
    shown(h) === "10" && pay(h) === "420,000원", `표시=${shown(h)} 보험=${pay(h)}`);

  const store = h.get("priorCountByItem") as Record<string, string>;
  check("부모 상태도 항목별로 남아 있다",
    store.musculoskeletal_esw === "50" && store.injection === "10", JSON.stringify(store));
}

// ── ② 반대 방향 ───────────────────────────────────────────────────────
console.log("\n[전환] 주사료에서 먼저 입력해도 같다");
{
  const h = base();
  toInjection(h);
  type(countInput(h), "50"); submit(h);
  check("주사료 50 → 0원", pay(h) === "0원", pay(h));
  pick(h, "치료유형", "musculoskeletal_esw"); submit(h);
  check("근골격계는 여전히 미입력이라 차단된다",
    shown(h) === "" && pay(h) === "결과 없음" && blockNotice(h), `표시=${shown(h)} 보험=${pay(h)}`);
  type(countInput(h), "0"); submit(h);
  check("  근골격계에 0을 넣으면 계산된다(명시적 0은 유효)", pay(h) === "420,000원", pay(h));
  toInjection(h); submit(h);
  check("주사료 복귀 — 50과 0원 유지", shown(h) === "50" && pay(h) === "0원");
}

// ── ③ 입력 격자 ───────────────────────────────────────────────────────
console.log("\n[격자] 유효는 그대로 전달, 무효는 차단한다");
{
  const VALID: [string, string][] = [
    ["0", "420,000원"], ["00", "420,000원"], ["1", "420,000원"],
    ["49", "210,000원"], ["50", "0원"], ["51", "0원"], ["100", "0원"],
    ["9007199254740991", "0원"],
  ];
  for (const [v, expect] of VALID) {
    const h = base(); type(countInput(h), v); submit(h);
    check(`유효 ${JSON.stringify(v)} → ${expect}`, shown(h) === v && pay(h) === expect, `표시=${shown(h)} 보험=${pay(h)}`);
  }
  const INVALID = ["", "1.5", "-1", "+1", "1e3", "1,0", "20만", "abc", "   ", " 1 ", "9007199254740993"];
  for (const v of INVALID) {
    const h = base(); type(countInput(h), v); submit(h);
    check(`무효 ${JSON.stringify(v)} → 차단·원문 보존`,
      shown(h) === v && pay(h) === "결과 없음" && blockNotice(h), `표시=${shown(h)} 보험=${pay(h)}`);
  }
}

// ── ④ 경계 — 50으로 절삭하지 않는다 ───────────────────────────────────
console.log("\n[경계] 한도를 넘긴 과거값을 절삭하지 않는다");
{
  const h49 = base(); type(countInput(h49), "49"); submit(h49);
  const h50 = base(); type(countInput(h50), "50"); submit(h50);
  const h51 = base(); type(countInput(h51), "51"); submit(h51);
  check("49는 남은 1회만 보상된다", pay(h49) === "210,000원", pay(h49));
  check("50·51·안전 정수 최대값 모두 0원", pay(h50) === "0원" && pay(h51) === "0원");
  check("소스에 50 절삭이 없다",
    !/Math\.min\(\s*50/.test(body) && !/Math\.min\(GEN2026\.specialItem/.test(body));
}

// ── ⑤ 비활성 경로 — 숨은 무효값이 간섭하지 않는다 ─────────────────────
console.log("\n[비활성] 숨은 값은 보존만 되고 전달되지 않는다");
{
  const mk = () => { const h = base(); type(countInput(h), "abc"); return h; };
  const g1 = mk(); pick(g1, "치료유형", "injection"); pick(g1, "약제 용도", "anticancer"); submit(g1);
  check("항암 주사료(일반 (1)(2) 전환)에는 칸이 없다", countInput(g1) === null);
  const g2 = mk(); pick(g2, "치료유형", "mri"); submit(g2);
  check("중증 MRI에는 칸이 없고 계산이 막히지 않는다", countInput(g2) === null && pay(g2) === "420,000원", pay(g2));
  const g3 = mk(); pick(g3, "질환 구분", "non_critical"); submit(g3);
  check("비중증에는 칸이 없다", countInput(g3) === null);
  const g4 = mk(); pick(g4, "급여 구분", "benefit"); submit(g4);
  check("급여에는 칸이 없다", countInput(g4) === null);
  const g5 = mk(); pick(g5, "치료유형", "mri"); pick(g5, "치료유형", "musculoskeletal_esw"); submit(g5);
  check("복귀하면 무효 원문이 그대로 남고 다시 차단된다",
    shown(g5) === "abc" && pay(g5) === "결과 없음" && blockNotice(g5), `표시=${shown(g5)}`);
}

// ── ⑥ 원인 축을 만들지 않는다 ─────────────────────────────────────────
console.log("\n[원인] 상해·질병 축을 추가하지 않는다");
{
  const h = base();
  type(countInput(h), "7");
  check("별도 보장종목 경로에는 원인 선택창이 없다", selByLabel(h, "원인") === null);
  pick(h, "치료유형", "general");
  pick(h, "원인", "injury");
  pick(h, "원인", "disease");
  pick(h, "치료유형", "musculoskeletal_esw"); submit(h);
  check("원인을 오가도 항목 값이 그대로다", shown(h) === "7" && pay(h) === "420,000원", `표시=${shown(h)} 보험=${pay(h)}`);
  check("상태 키는 두 보장종목뿐이다(원인·MRI 키 없음)",
    JSON.stringify(Object.keys(h.get("priorCountByItem") as object).sort()) === '["injection","musculoskeletal_esw"]',
    JSON.stringify(h.get("priorCountByItem")));
}

// ── ⑦ 승인 회차 축은 그대로 분리 ──────────────────────────────────────
console.log("\n[분리] 승인 회차 축은 계속 별개다");
{
  const h = base();
  type(countInput(h), "0");
  type(actsInput(h), "40");
  submit(h);
  const a = pay(h);
  const h2 = base();
  type(countInput(h2), "0");
  type(actsInput(h2), "0");
  submit(h2);
  check("치료행위 수만 바꿔도 결과가 달라진다(두 축이 다른 일을 한다)", a !== pay(h2), `${a} vs ${pay(h2)}`);
  check("소스에서 두 축을 서로 대신 쓰지 않는다",
    /priorAnnualCoveredCount: coveredSoFar,/.test(body)
    && /priorAnnualTreatmentActCount: outpatientDays\(priorActs\) \?\? undefined,/.test(body));
  check("priorActs 상태는 그대로 남아 있다", names.includes("priorActs"));
}

// ── ⑦-b 안내 문구가 확인 범위를 넘지 않는가 ───────────────────────────
//   ⚠ 확인한 범위는 등록된 항목별 한도(<표1>의 서로 다른 행)와 엔진의 항목별 비교까지다.
//     "두 보장종목의 횟수가 약관상 서로 독립적으로 소진된다"는 문장은 원문에서 직접 읽어
//     확인하지 않았으므로, **화면에 보이는 문구**가 그보다 강하게 단정하면 안 된다.
//   ⚠ 검사 대상은 렌더된 화면 텍스트다. 소스 주석에는 이 확인 범위를 설명하려고 같은
//     단어가 들어가므로, 주석까지 함께 보는 소스 검사로는 판정할 수 없다.
console.log("\n[문구] 화면 안내가 확인 범위를 넘어 단정하지 않는다");
{
  /** 두 보장종목 각각의 정상 화면과 미입력 차단 화면. */
  const screens: [string, string][] = [];
  {
    const h = base(); type(countInput(h), "0"); submit(h);
    screens.push(["근골격계 · 입력 상태", (h.render() as any).text as string]);
  }
  {
    const h = base(); submit(h);
    screens.push(["근골격계 · 미입력 차단", (h.render() as any).text as string]);
  }
  {
    const h = base(); toInjection(h); type(countInput(h), "0"); submit(h);
    screens.push(["주사료 · 입력 상태", (h.render() as any).text as string]);
  }
  {
    const h = base(); toInjection(h); submit(h);
    screens.push(["주사료 · 미입력 차단", (h.render() as any).text as string]);
  }
  const BANNED = ["독립적으로 소진", "서로 독립", "각각 독립", "별개로 소진", "약관상 독립", "따로 셉니다"];
  for (const [name, text] of screens) {
    const hit = BANNED.filter((b) => text.includes(b));
    check(`${name}: 확인 범위를 넘는 표현이 없다`, hit.length === 0, hit.join(", "));
  }
  const [, typed] = screens[0];
  check("계산기가 값을 어떻게 쓰는지로 설명한다",
    typed.includes("이 칸은") && typed.includes("보장종목마다 따로") && typed.includes("입력받습니다")
    && typed.includes("다른 보장종목의 값을 대신 쓰지 않으며"));
  const [, blocked] = screens[1];
  check("차단 안내는 그 보장종목의 한도까지만 말한다",
    blocked.includes("이 보장종목은 연") && !blocked.includes("독립"));
}

// ── ⑧ 소스 계약 ───────────────────────────────────────────────────────
console.log("\n[소스] 계약이 코드에 고정돼 있다");
{
  check("단일 priorCount 상태가 사라졌다",
    !names.includes("priorCount") && names.includes("priorCountByItem"));
  check("두 항목 모두 빈 문자열로 시작한다",
    /const GEN2026_COUNTED_ITEMS = \["musculoskeletal_esw", "injection"\] as const;/.test(body)
    && /Object\.fromEntries\(GEN2026_COUNTED_ITEMS\.map\(\(k\) => \[k, ""\]\)\)/.test(body));
  check("활성 축은 showSpecialForm·중증·항목을 함께 본다",
    /const countedItem: Gen2026CountedItem \| null = showSpecialForm && severity === "critical"/.test(body)
    && /\(specialItem === "musculoskeletal_esw" \|\| specialItem === "injection"\)/.test(body));
  check("미입력이면 엔진 호출을 막는다",
    /const needsPriorCount = countedItem !== null && priorCountNum === null;/.test(body)
    && /&& !needsPriorActs && !needsPriorCount/.test(body));
  check("확정된 숫자만 전달한다(타입 단언·?? 0 없음)",
    /const coveredSoFar = priorCountNum === null \? undefined : priorCountNum;/.test(body)
    && !/priorAnnualCoveredCount: num\(/.test(body)
    && !/priorCountNum as number/.test(body)
    && !/priorCountNum \?\? 0/.test(body));
  check("전용 파서를 쓰고 공용 num()으로 돌아가지 않았다",
    /const coveredCount = nonNegSafeInt;/.test(body)
    && /const priorCountNum = countedItem === null \? null : coveredCount\(priorCountRaw\);/.test(body));
  check("원문 보존 입력이다(type=number 아님)",
    /value=\{priorCountRaw\}/.test(ui)
    && !/type="number"[^>]*value=\{priorCountRaw\}/.test(ui)
    && /inputMode="numeric"/.test(ui));
  check("숨은 항목 값을 읽지 않는다(활성 항목 하나만 참조)",
    /const priorCountRaw = countedItem === null \? "" : priorCountByItem\[countedItem\];/.test(body));
  check("MRI 축을 만들지 않았다", !/mri: ""/.test(body) && !/"mri"\]/.test(body.split("GEN2026_COUNTED_ITEMS")[1] ?? ""));
  check("다른 세대 계산기를 건드리지 않았다",
    !/HealthCalcMulti2021|HealthCalcStandardized/.test(ui));
}

console.log(`\n[5세대 보상 횟수 축] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
