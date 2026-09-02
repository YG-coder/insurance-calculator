// 한도 라벨 완전성 가드.
//
// CAP_LABELS는 Record<CapCode, string>이라 키 누락은 컴파일이 막지만, 빈 문자열이나
// 공백만 있는 라벨은 막지 못한다. 그 경우 UI의 "적용된 한도:" 안내가 빈칸으로 렌더링된다.
// 엔진이 실제로 반환하는 모든 CapCode에 사람이 읽을 라벨이 있는지 확인한다.
import { CAP_LABELS } from "../src/lib/insurance/engine/capLabels";
import { CapCode } from "../src/lib/insurance/engine/types";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const entries = Object.entries(CAP_LABELS) as [CapCode, string][];

check("라벨이 하나 이상 등록됨", entries.length > 0);

const blank = entries.filter(([, label]) => label.trim() === "");
check("빈 라벨 없음", blank.length === 0, blank.map(([code]) => code).join(", "));

const tooShort = entries.filter(([, label]) => label.trim().length < 4);
check("라벨이 안내로 쓸 만한 길이", tooShort.length === 0, tooShort.map(([code]) => code).join(", "));

// 세대 접두사가 붙은 코드는 그 세대의 계산기에서만 쓰인다. 접두사 규칙을 고정한다.
const badPrefix = entries.filter(([code]) => !/^GEN(2009|2017|2021|2026)_/.test(code));
check("모든 CapCode가 세대 접두사를 가짐", badPrefix.length === 0, badPrefix.map(([code]) => code).join(", "));

console.log(`\n[capLabels] 라벨 ${entries.length}개 · 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
