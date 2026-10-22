import { flushSync } from "react-dom";

/** 사용자가 제출·행 추가/삭제를 했을 때만 새 DOM의 안내 또는 입력으로 이동한다. */
export function focusAfterUpdate(update: () => void, id: string) {
  flushSync(update);
  if (typeof document !== "undefined") document.getElementById(id)?.focus();
}
