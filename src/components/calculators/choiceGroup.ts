// 단일 선택 버튼 묶음의 공통 규칙 (6차 R-06 정책, 7차에 분리).
//
//   종전의 버튼 묶음은 `<label>` 글자와 평범한 `<button>` 들이라, 보조기술에는 그룹 이름도 "지금 무엇이
//   선택됐는지"도 전달되지 않았고(선택 상태는 색상뿐), Tab 이 모든 버튼에 멈췄다.
//   정책: 묶음은 role="radiogroup" + aria-labelledby 로 이름을 갖고, 각 버튼은 role="radio" + aria-checked 로
//   상태를 알린다. 키보드는 네이티브 라디오처럼 **화살표로 옮기고** Tab 은 선택된 항목 한 곳에만 멈춘다
//   (roving tabindex). 아직 아무것도 고르지 않은 묶음은 첫 항목이 Tab 정지점이 된다(네이티브 라디오와 같다).
//   시각 상태·DOM 상태·키보드 모두 같은 상태값 하나를 본다. 상태와 계산 전달 경로는 바꾸지 않는다.
//   ⚠ 훅·컴포넌트를 쓰지 않는다 — tests/_uiRender.ts 의 최소 렌더러는 useState 만 제공하고 하위 함수
//     컴포넌트를 호출하지 않는다. 포커스 이동은 이벤트가 일어난 버튼이 속한 묶음 안에서 DOM 으로 찾는다.
import type { KeyboardEvent } from "react";

export const choiceClass = (selected: boolean) =>
  `px-4 py-3 rounded-xl border text-sm font-semibold transition ${
    selected
      ? "bg-brand-600 text-white border-brand-600"
      : "bg-white text-slate-700 border-slate-300 hover:border-brand-300"
  }`;

/** roving tabindex — 선택된 항목만 0, 선택이 없으면 첫 항목이 0. */
export function choiceTabIndex<T extends string>(values: readonly T[], current: T | null, value: T): 0 | -1 {
  const stop = current !== null && values.includes(current) ? current : values[0];
  return stop === value ? 0 : -1;
}

/** 화살표 키로 같은 묶음의 이웃 선택지로 옮기고 그 값을 선택한다. 다른 키는 그대로 둔다. */
export function moveChoice<T extends string>(
  e: KeyboardEvent<HTMLButtonElement>,
  values: readonly T[],
  current: T | null,
  onChange: (v: T) => void,
) {
  const delta =
    e.key === "ArrowRight" || e.key === "ArrowDown" ? 1
    : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1
    : 0;
  if (delta === 0) return;
  e.preventDefault();
  // 출발점은 **포커스된 버튼**이다(선택된 항목과 같다). 미선택 묶음에서도 네이티브 라디오처럼
  //   첫 항목에서 오른쪽 화살표를 누르면 다음 항목이 선택·포커스된다(포커스된 항목 자체를 고르는 키는 Space/Enter).
  const focused = e.currentTarget.dataset.value as T | undefined;
  const origin = focused !== undefined && values.includes(focused) ? focused : current;
  const index = origin === null ? -1 : values.indexOf(origin);
  const next = values[(index + delta + values.length) % values.length];
  onChange(next);
  const group = e.currentTarget.closest('[role="radiogroup"]');
  const target = group?.querySelector<HTMLButtonElement>(`[role="radio"][data-value="${next}"]`);
  target?.focus();
}
