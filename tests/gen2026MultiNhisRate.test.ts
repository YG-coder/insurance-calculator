// 안전성 커밋 — 5세대 **다회** 건강보험 본인부담률 입력의 엄격 검증 (G-13C).
//
// ⚠ 대상은 `HealthCalcMulti2026.tsx`의 `nhisRate` 한 필드뿐이다. 엔진·규칙값·HOLD,
//   진료비·금액·보험 횟수·반복 횟수 계약, 단건 컴포넌트, 공용 위젯은 그대로다.
//
// 종전 동작(`Math.min(100, num(nhisRate)) / 100`) — 기준선 353aae4 실행으로 확인:
//   -1·+1→0.01(부호를 지운다) / .5→0.005 / 1.→0.01 / 1e3→0.13 / 1,0→0.1 /
//   20만·20%· 20 →0.2 / abc·NaN·Infinity·1.2.3·공백만→0 /
//   100.1·101·300,000·1e308·매우 큰 수→**100%로 깎여 보험 적용 0원**.
//   ⚠ 0~20 구간의 변환은 엔진의 20% 하한 때문에 결과가 같았다. 결과가 갈리는 것은 20 초과다.
//
// ⚠ 단건(G-11B)의 `gen2026NhisRate`를 재사용하지 않는다. 형식 규칙이 같아도 화면·안내·게이트가
//   다르고, 한쪽을 고칠 때 다른 쪽이 조용히 따라 바뀌면 안 된다.
// ⚠ 다회 결과 화면에는 **적용 비율(자기부담률) 라벨이 없다.** 단건에 있는 표시 정밀도 문제는
//   다회에 대상이 없으므로, 이 커밋은 라벨을 새로 만들지 않고 그 사실을 아래에서 고정한다.
import { readFileSync } from "node:fs";
import { GEN2026 } from "../src/lib/insurance/engine/constants";
import HealthCalcMulti2026 from "../src/components/calculators/HealthCalcMulti2026";
import HealthCalc5th from "../src/components/calculators/HealthCalc5th";
import { mount, stateNamesFrom } from "./_uiRender";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + " " + detail); }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const MULTI = "src/components/calculators/HealthCalcMulti2026.tsx";
const SINGLE = "src/components/calculators/HealthCalc5th.tsx";
const ui = readFileSync(MULTI, "utf8");
const single = readFileSync(SINGLE, "utf8");
const body = ui
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");

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
const pick = (h: H, label: string, v: string) => {
  const s = selByLabel(h, label);
  if (s === null) throw new Error("선택창 없음: " + label);
  s.props.onChange({ target: { value: v } });
};
const has = (h: H, label: string) => selByLabel(h, label) !== null;
const byId = (h: H, id: string) => nodes(h).find((n) => n.props?.id === id) ?? null;
/** 본인부담률 입력 — 안내 id로 찾는다(접근성 연결까지 함께 본다). */
const rate = (h: H) => nodes(h).find((n) => n.tag === "input"
  && n.props["aria-describedby"] === "gen2026-multi-nhis-rate-help") ?? null;
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
const items = (h: H) => (h.render() as any).resultItems() as { label: string; value: string }[] | null;
const pay = (h: H) => { const it = items(h); return it === null ? "결과 없음" : (it.find((i) => i.label.includes("보험")) ?? { value: "?" }).value; };
const text = (h: H) => (h.render() as any).text as string;
const warned = (h: H) => text(h).includes("건강보험 본인부담률은 0~100 사이의 숫자로 입력해 주세요")
  && text(h).includes("100으로 깎지 않고");
const base = (): H => { const h = mount(HealthCalcMulti2026, names); pick(h, "급여 구분", "benefit"); return h; };

// ── 근거 ──────────────────────────────────────────────────────────────
console.log("\n[근거] 규칙값과 엔진을 건드리지 않았다");
{
  check("20% 하한은 규칙값 그대로", GEN2026.benefit.outpatient.floorRate === 0.2);
  check("화면이 하한을 하드코딩해 계산하지 않는다",
    !/Math\.max\([^)]*0\.2\)/.test(body) && !/nhisRateNum < 20/.test(body));
  check("엔진 파일을 이 커밋에서 건드리지 않았다",
    /const counts = spec\.annualVisits !== null && amount > 0;/.test(
      readFileSync("src/lib/insurance/engine/specialItem2026.ts", "utf8")));
}

// ── ① 유효 격자 ───────────────────────────────────────────────────────
console.log("\n[유효] 검증된 값만 /100 해서 넘긴다");
{
  const VALID: [string, string][] = [
    ["0", "480,000원"], ["00", "480,000원"], ["01", "480,000원"], ["20", "480,000원"],
    ["12.5", "480,000원"], ["12.50", "480,000원"], ["0.001", "480,000원"],
    ["20.12345678901", "479,260원"], ["25.9", "444,600원"], ["26.9", "438,600원"],
    ["30.5", "417,000원"], ["99.99", "60원"], ["100", "0원"], ["100.0", "0원"],
  ];
  for (const [v, expect] of VALID) {
    const h = base(); type(rate(h), v); submit(h);
    check(`유효 ${JSON.stringify(v)} → ${expect}`,
      String(rate(h)!.props.value) === v && pay(h) === expect && !warned(h), pay(h));
  }
}

// ── ② 20% 하한 ────────────────────────────────────────────────────────
console.log("\n[하한] 20% 미만 입력도 계산은 20%로 한다(입력을 바꾸지는 않는다)");
{
  const floorPay = "480,000원";
  for (const v of ["0", "01", "12.5", "19.99"]) {
    const h = base(); type(rate(h), v); submit(h);
    check(`${JSON.stringify(v)} → 하한 적용 ${floorPay} · 원문은 그대로`,
      pay(h) === floorPay && String(rate(h)!.props.value) === v, pay(h));
  }
  const at20 = base(); type(rate(at20), "20"); submit(at20);
  // ⚠ 20을 아주 조금 넘긴 값은 원 단위 반올림에 흡수돼 결과가 같다(`20.0001` 실측 480,000원).
  //   하한이 상수로 굳지 않았는지 보려면 반올림에 묻히지 않는 값을 써야 한다.
  const above = base(); type(rate(above), "21"); submit(above);
  check("20 초과부터 결과가 갈린다(하한이 상수로 굳지 않았다)",
    pay(at20) === floorPay && pay(above) !== floorPay, `${pay(at20)} / ${pay(above)}`);
}

// ── ③ 무효 격자 ───────────────────────────────────────────────────────
console.log("\n[무효] 차단하고 원문을 보존한다");
{
  const INVALID = [".5", "1.", "+1", "-1", "1e3", "1,0", "300,000", "20만", "abc",
    "   ", " 20 ", "NaN", "Infinity", "20%", "1.2.3", "100.1", "101", "1e308",
    "99999999999999999999"];
  for (const v of INVALID) {
    const h = base(); type(rate(h), v); submit(h);
    check(`무효 ${JSON.stringify(v)} → 결과 숨김 + 전용 안내 · 원문 보존`,
      pay(h) === "결과 없음" && warned(h) && String(rate(h)!.props.value) === v,
      `${pay(h)} warned=${warned(h)}`);
  }
  check("100 초과를 100으로 깎지 않는다(소스에 자동 보정 없음)",
    !/Math\.min\(100, /.test(body) && !/Math\.max\(0, /.test(body));
}

// ── ④ 빈 값 → 엔진 PENDING ────────────────────────────────────────────
console.log("\n[빈 값] 미입력은 종전대로 엔진 PENDING이다");
{
  const h = base(); submit(h);
  check("빈 값은 결과 없음 + 엔진의 종전 안내",
    pay(h) === "결과 없음" && text(h).includes("건강보험 본인부담률 미제공"), text(h).slice(0, 0));
  check("  전용 무효 안내는 뜨지 않는다(빈 값은 무효가 아니다)", !warned(h));
  check("소스: 빈 값만 undefined로 간다",
    /const nhisRateNum = !usesNhisRate \|\| nhisRate === "" \? undefined : gen2026MultiNhisRate\(nhisRate\);/.test(body));
}

// ── ⑤ 진료비 안내 우선순위 ────────────────────────────────────────────
console.log("\n[우선순위] 진료비 안내가 먼저다");
{
  const h = base();
  type(rate(h), "20");
  type(byId(h, "gen2026-amount-0"), "-1");
  submit(h);
  check("진료비 무효 + 비율 유효 → 계산 차단(진료비 게이트)", pay(h) === "결과 없음");
  check("  본인부담률 전용 안내는 뜨지 않는다", !warned(h));
  const g = base();
  type(rate(g), "abc");
  type(byId(g, "gen2026-amount-0"), "-1");
  submit(g);
  check("둘 다 무효 → 진료비 안내가 우선(본인부담률 안내는 억제)", pay(g) === "결과 없음" && !warned(g));
  // 진료비 0원은 유효한 숫자다 — 이 정책은 그대로다.
  const z = base();
  type(rate(z), "abc");
  type(byId(z, "gen2026-amount-0"), "0");
  type(byId(z, "gen2026-amount-1"), "0");
  submit(z);
  check("진료비 0원(유효)에서는 본인부담률 무효 안내가 나온다", warned(z));
}

// ── ⑥ 비활성 경로 무간섭 + 복귀 복원 ──────────────────────────────────
console.log("\n[비활성] 숨은 무효값이 다른 경로를 막지 않는다");
{
  const h = base();
  type(rate(h), "abc");
  check("급여 통원: 위젯 보임", rate(h) !== null);

  pick(h, "치료 형태", "inpatient"); submit(h);
  check("급여 입원: 위젯 없음 · 계산됨", rate(h) === null && pay(h) !== "결과 없음", pay(h));

  pick(h, "치료 형태", "outpatient");
  pick(h, "급여 구분", "non_benefit");
  pick(h, "치료유형", "general");
  if (has(h, "질환 구분")) pick(h, "질환 구분", "critical");
  if (has(h, "원인")) pick(h, "원인", "disease");
  const pv = nodes(h).find((n) => n.tag === "input" && n.props.placeholder === "이전 통원이 없으면 0");
  if (pv) type(pv, "0");
  submit(h);
  check("비급여 일반: 위젯 없음 · 계산됨", rate(h) === null && pay(h) !== "결과 없음", pay(h));

  pick(h, "치료유형", "musculoskeletal_esw");
  check("특별약관: 위젯 없음", rate(h) === null);

  pick(h, "급여 구분", "benefit"); submit(h);
  check("급여 통원 복귀: 원문 abc와 전용 안내가 복원된다",
    rate(h) !== null && String(rate(h)!.props.value) === "abc" && warned(h) && pay(h) === "결과 없음");
  type(rate(h), "20"); submit(h);
  check("  고치면 바로 계산된다", pay(h) === "480,000원", pay(h));
}

// ── ⑦ 적용 비율 라벨은 다회에 없다 ────────────────────────────────────
console.log("\n[라벨] 다회에는 적용 비율 표시가 없다 — 만들지 않았다");
{
  const h = base(); type(rate(h), "30.5"); submit(h);
  const labels = (items(h) ?? []).map((i) => i.label);
  check("결과 카드는 금액 3종뿐",
    JSON.stringify(labels) === JSON.stringify(["총 진료비", "총 본인부담금", "총 보험 적용 금액"]),
    JSON.stringify(labels));
  const t = text(h);
  check("화면에 자기부담률 표기가 없다", !/자기부담률 \(/.test(t));
  check("부동소수점 흔적이 화면에 없다", !/(0{6,}|9{6,})\d*%/.test(t) && !/0\.26899999/.test(t));
  check("표시용 값을 계산 인자로 재사용하지 않는다(전달은 검증값 /100 하나뿐)",
    (body.match(/nhisCoinsuranceRate:/g) ?? []).length === 1
    && /nhisCoinsuranceRate: nhisRateNum === undefined \|\| nhisRateNum === null \? undefined : nhisRateNum \/ 100,/.test(body));
}

// ── ⑧ 소스 계약 ───────────────────────────────────────────────────────
console.log("\n[소스] 계약이 코드에 고정돼 있다");
{
  check("다회 전용 파서를 새로 뒀다",
    /const gen2026MultiNhisRate = \(v: string\): number \| null =>/.test(body)
    && /const GEN2026_MULTI_NHIS_RATE_FORMAT = \/\^\[0-9\]\+\(\?:\\\.\[0-9\]\+\)\?\$\/;/.test(body));
  check("단건 파서를 재사용하지 않는다", !body.includes("gen2026NhisRate"));
  check("금액·횟수 파서를 재사용하지 않는다",
    !/gen2026MultiNhisRate = (gen2026Amount|gen2026Money|nonNegSafeInt|coveredCount|gen2026CopyCount)/.test(body));
  check("공용 num()은 마지막 사용처가 사라져 삭제됐다",
    !/const num = \(v: string\) =>/.test(body) && !/\bnum\(/.test(body));
  check("급여 통원일 때만 쓴다(노출·검증·전달이 같은 식)",
    /const usesNhisRate = coverage === "benefit" && visit === "outpatient";/.test(body)
    && /\{usesNhisRate && <label/.test(ui));
  check("무효면 급여 분기 호출을 막는다",
    /const nhisRateInvalid = nhisRateNum === null;/.test(body)
    && /const plainResult = amountsIncomplete \|\| nhisRateInvalid/.test(body));
  check("원문 보존 위젯이다(type=text · inputMode=decimal · min·max·step 없음)",
    /type="text" inputMode="decimal"/.test(ui)
    && !/value=\{nhisRate\}[^>]*type="number"/.test(ui)
    && !/step="0\.1"[^>]*value=\{nhisRate\}/.test(ui));
  check("안내가 안내 요소 id로 연결돼 있다",
    /aria-describedby="gen2026-multi-nhis-rate-help"/.test(ui)
    && /id="gen2026-multi-nhis-rate-help"/.test(ui));
  // ⚠ 두 자리 모두 본다 — 위젯 아래 도움말과 무효 시 경고 상자. 한쪽만 검사하면 다른 쪽에서
  //   20% 설명이 사라져도 통과한다.
  const helpSpan = (ui.match(/id="gen2026-multi-nhis-rate-help"[^]*?<\/span>/) ?? [""])[0];
  const warnBox = (ui.match(/submitted && nhisRateInvalid[^]*?<\/NoticeBox>/) ?? [""])[0];
  check("도움말이 입력 계약과 20% 하한을 함께 말한다",
    helpSpan.includes("0~100 사이의 숫자") && helpSpan.includes("최소 자기부담률은 <b>20%</b>"),
    helpSpan.slice(0, 0));
  check("무효 안내도 입력 계약과 20% 하한을 함께 말한다",
    warnBox.includes("0~100 사이의 숫자") && warnBox.includes("최소 자기부담률은 <b>20%</b>"),
    warnBox.slice(0, 0));
  check("입력값을 20으로 바꿨다고 표현하지 않는다",
    !ui.includes("20으로 바꿉니다") && !ui.includes("20으로 보정") && ui.includes("20으로 바꾸는 것은 아닙니다"));
  check("타입 단언·?? 0으로 통과시키지 않는다",
    !/nhisRateNum as number/.test(body) && !/nhisRateNum \?\? 0/.test(body));
}

// ── ⑨ 단건 G-11B 계약 무회귀 ──────────────────────────────────────────
console.log("\n[단건] G-11B 계약과 고정 비율 경로는 그대로다");
{
  check("단건 파서 그대로",
    /const GEN2026_NHIS_RATE_FORMAT = \/\^\[0-9\]\+\(\?:\\\.\[0-9\]\+\)\?\$\/;/.test(single)
    && /const gen2026NhisRate = \(v: string\): number \| null =>/.test(single));
  check("단건 라벨 계약 그대로(고정 비율 경로는 rateApplied 포맷)",
    /const benefitOutpatientPct = !usesNhisRate \|\| nhisRateNum === null \|\| nhisRateNum === undefined/.test(single)
    && /Math\.max\(nhisRateNum, GEN2026\.benefit\.outpatient\.floorRate \* 100\)/.test(single)
    && /const pct = \(rate: number\) => \{/.test(single));
  // 단건 화면이 실제로 렌더되는지도 확인한다(임포트만으로는 부족하다).
  const s = mount(HealthCalc5th, stateNamesFrom(single));
  check("단건 화면이 그대로 렌더된다", (s.render() as any).nodes.length > 0);
}

console.log(`\n[5세대 다회 본인부담률] ✅ ${pass} / ❌ ${fail}`);
if (fail > 0) process.exit(1);
