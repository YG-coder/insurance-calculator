// 한국어 조사 선택.
//
// 화면·안내 문구가 라벨을 문자열로 이어 붙이는 곳에서 쓴다. 라벨을 바꾸거나
// 항목을 추가할 때 조사가 틀어지는 것을 막는 것이 목적이다.
//   예) "상급병실료 차액" + 는  →  "차액"에 받침(ㄱ)이 있어 "은"이 맞다.

/**
 * 마지막 글자에 받침이 있는지. 판정할 수 없으면 null.
 *   · 한글 음절 — 유니코드 조합 공식으로 종성 유무를 직접 계산한다.
 *   · 라틴 문자·숫자 — 한국어 읽기의 받침 유무를 표로 둔다(MRI → "아이", 받침 없음).
 */
function hasFinalConsonant(word: string): boolean | null {
  const last = word.trim().slice(-1);
  if (!last) return null;

  const code = last.charCodeAt(0);
  // 한글 음절 가(0xAC00) ~ 힣(0xD7A3): (코드 - 0xAC00) % 28 이 0이면 종성 없음
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;

  // 알파벳은 글자 이름을 한국어로 읽었을 때의 받침 여부를 따른다.
  //   받침 있는 것만 나열: L(엘) M(엠) N(엔) R(알)
  const alpha = last.toUpperCase();
  if (alpha >= "A" && alpha <= "Z") return "LMNR".includes(alpha);

  // 숫자도 읽기 기준. 받침 있는 것: 0(영) 1(일) 3(삼) 6(육) 7(칠) 8(팔)
  if (last >= "0" && last <= "9") return "013678".includes(last);

  return null;
}

/**
 * 받침 유무에 따라 조사를 고른다. 판정할 수 없으면 `withoutFinal`을 쓴다
 * (한국어 관행상 받침 없는 쪽이 덜 어색하다).
 */
export function particle(word: string, withFinal: string, withoutFinal: string): string {
  const has = hasFinalConsonant(word);
  return has === null ? withoutFinal : has ? withFinal : withoutFinal;
}

/** 주제 조사. "차액" → "차액은", "주사료" → "주사료는" */
export function topic(word: string): string {
  return word + particle(word, "은", "는");
}
