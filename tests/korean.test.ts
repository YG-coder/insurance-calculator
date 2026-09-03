// 한국어 조사 유틸 가드.
// 안내 문구가 라벨을 이어 붙이므로, 라벨이 바뀌면 조사도 따라가야 한다.
import { particle, topic } from "../src/lib/insurance/common/korean";
import { GEN2026_NON_BENEFIT_ITEM_LABEL, calc2026 } from "../src/lib/insurance/engine/generation2026";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

// 받침 있음 → 은 / 받침 없음 → 는
const cases: [string, string][] = [
  ["상급병실료 차액", "상급병실료 차액은"],   // 액: 종성 ㄱ
  ["비급여 주사료", "비급여 주사료는"],        // 료: 종성 없음
  ["근골격계 이학요법·체외충격파", "근골격계 이학요법·체외충격파는"], // 파
  ["일반 비급여", "일반 비급여는"],            // 여
  ["비급여 MRI", "비급여 MRI는"],              // I → "아이"
  ["보험금", "보험금은"],                      // 금: 종성 ㅁ
  ["통원", "통원은"],                          // 원: 종성 ㄴ
  ["공제", "공제는"],                          // 제
];
for (const [word, expected] of cases) {
  check(`topic("${word}") → "${expected}"`, topic(word) === expected, topic(word));
}

// 알파벳 끝 — 글자 이름의 받침을 따른다
check('알파벳 L(엘)은 받침 있음', topic("등급 L") === "등급 L은", topic("등급 L"));
check('알파벳 M(엠)은 받침 있음', topic("타입 M") === "타입 M은", topic("타입 M"));
check('알파벳 N(엔)은 받침 있음', topic("N") === "N은", topic("N"));
check('알파벳 R(알)은 받침 있음', topic("R") === "R은", topic("R"));
check('알파벳 A(에이)는 받침 없음', topic("등급 A") === "등급 A는", topic("등급 A"));
check('소문자도 같은 규칙', topic("등급 l") === "등급 l은", topic("등급 l"));

// 숫자 끝 — 읽기의 받침을 따른다
for (const [digit, expected] of [["0","0은"],["1","1은"],["2","2는"],["3","3은"],
                                 ["4","4는"],["5","5는"],["6","6은"],["7","7은"],
                                 ["8","8은"],["9","9는"]] as const) {
  check(`숫자 ${digit} → "${expected}"`, topic(digit) === expected, topic(digit));
}

// 판정 불가 — 받침 없는 쪽으로 떨어뜨린다(덜 어색하다)
check("빈 문자열은 받침 없는 조사", topic("") === "는", topic(""));
check("공백만 있어도 받침 없는 조사", topic("   ") === "   는", JSON.stringify(topic("   ")));
check("기호로 끝나면 받침 없는 조사", topic("항목 %") === "항목 %는", topic("항목 %"));

// particle()은 임의의 조사 쌍에 쓸 수 있다
check('particle: 이/가', "차액" + particle("차액", "이", "가") === "차액이");
check('particle: 을/를', "주사료" + particle("주사료", "을", "를") === "주사료를");
check('particle: 판정 불가 시 두 번째 인자', particle("%", "이", "가") === "가");

// 실제 사용 지점 — 엔진 안내 문구가 라벨마다 올바른 조사를 쓰는지
{
  const expectedParticle: Record<string, string> = {
    musculoskeletal_esw: "는", injection: "는", mri: "는", room_charge: "은",
  };
  for (const [item, want] of Object.entries(expectedParticle)) {
    const label = GEN2026_NON_BENEFIT_ITEM_LABEL[item as keyof typeof GEN2026_NON_BENEFIT_ITEM_LABEL];
    const r = calc2026({ amount: 100_000, coverage: "non_benefit", visit: "outpatient",
      severity: "critical", nonBenefitItem: item as never });
    const note = r.notes[0] ?? "";
    check(`안내 문구: "${label}${want} 현재 계산 대상이 아닙니다."`,
      note.startsWith(`${label}${want} 현재 계산 대상이 아닙니다.`), note);
    check(`안내 문구: "${label}"에 잘못된 조사가 붙지 않음`,
      !note.startsWith(`${label}${want === "은" ? "는" : "은"}`), note);
  }
}

console.log(`\n[korean] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
