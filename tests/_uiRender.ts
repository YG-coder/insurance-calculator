/**
 * 최소 React 렌더러 — 상태 전이를 실제로 일으켜 **무엇이 렌더되는지** 검사한다.
 *
 * 왜 필요한가: 게이트 변수(`showRoomChargeForm` 등)와 JSX 조건이 어긋나면
 *   소스 문자열 검사로는 잡히지 않는다. 실제로 커밋 `2ee330d`에서
 *   `showRoomChargeForm`은 질환 구분을 요구하는데 질환 구분 **선택창**은
 *   `!isRoomCharge`로 숨겨져 있어, 안내만 뜨고 고를 수단이 없는 상태가 통과했다.
 *
 * 방식: React가 훅을 찾는 경로(`ReactSharedInternals.H` 디스패처)를 직접 채운다.
 *   렌더러가 하는 일과 같으며, 컴포넌트 코드를 테스트용으로 고치지 않는다.
 *   훅 순서는 Rules of Hooks가 보장하므로 선언 순서 = 슬롯 순서다.
 */
import * as React from "react";

const INTERNALS = (React as unknown as Record<string, { H: unknown }>)
  .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

export interface RenderedNode {
  /** 호스트 태그명(`label`, `select`…) 또는 `#컴포넌트명`. */
  tag: string;
  props: Record<string, unknown>;
  /** 이 노드 아래의 텍스트(중첩 컴포넌트 내부는 제외). */
  text: string;
}

const TEXT_OF = (el: unknown): string => {
  if (el === null || el === undefined || typeof el === "boolean") return "";
  if (typeof el === "string" || typeof el === "number") return String(el);
  if (Array.isArray(el)) return el.map(TEXT_OF).join("");
  const e = el as { type?: unknown; props?: { children?: unknown } };
  if (e.type === undefined) return "";
  // 함수 컴포넌트는 호출하지 않는다(자체 훅이 슬롯을 어지럽히지 않게).
  return TEXT_OF(e.props?.children);
};

function walk(el: unknown, out: RenderedNode[]): void {
  if (el === null || el === undefined || typeof el === "boolean") return;
  if (typeof el === "string" || typeof el === "number") return;
  if (Array.isArray(el)) { for (const c of el) walk(c, out); return; }
  const e = el as { type?: unknown; props?: Record<string, unknown> };
  if (e.type === undefined) return;
  const props = (e.props ?? {}) as Record<string, unknown>;
  if (typeof e.type === "string") {
    out.push({ tag: e.type, props, text: TEXT_OF(props.children) });
  } else if (typeof e.type === "function") {
    const name = (e.type as { name?: string }).name || "Anonymous";
    out.push({ tag: `#${name}`, props, text: TEXT_OF(props.children) });
  }
  walk(props.children, out);
}

export interface Screen {
  nodes: RenderedNode[];
  /** `<label>` 텍스트 목록. 화면에 실제로 보이는 입력이 무엇인지에 해당한다. */
  labels: string[];
  /** 렌더된 모든 텍스트. */
  text: string;
  /** 레이블이 이 접두사로 시작하는 입력이 렌더됐는가. */
  has(labelPrefix: string): boolean;
  /** ResultCard에 전달된 항목(계산 결과가 화면에 나왔는지). */
  resultItems(): { label: string; value: string }[] | null;
}

export interface Harness {
  /** 선언 순서로 얻은 상태 이름 목록. */
  names: string[];
  render(): Screen;
  set(name: string, value: unknown): void;
  get(name: string): unknown;
}

/**
 * @param Component 렌더할 함수 컴포넌트
 * @param stateNames `useState` **선언 순서**의 상태 이름(소스에서 추출해 넘긴다)
 */
export function mount(Component: () => unknown, stateNames: string[]): Harness {
  const slots: unknown[] = [];
  let cursor = 0;
  const dispatcher = {
    useState(init: unknown) {
      const i = cursor++;
      if (i >= slots.length) slots.push(typeof init === "function" ? (init as () => unknown)() : init);
      const set = (v: unknown) => {
        slots[i] = typeof v === "function" ? (v as (p: unknown) => unknown)(slots[i]) : v;
      };
      return [slots[i], set];
    },
  };
  const indexOf = (name: string): number => {
    const i = stateNames.indexOf(name);
    if (i < 0) throw new Error(`상태 이름을 찾을 수 없습니다: ${name}`);
    return i;
  };
  const harness: Harness = {
    names: stateNames,
    render(): Screen {
      cursor = 0;
      const prev = INTERNALS.H;
      INTERNALS.H = dispatcher;
      let tree: unknown;
      try { tree = Component(); } finally { INTERNALS.H = prev; }
      if (cursor === 0) throw new Error("훅 디스패처가 연결되지 않았습니다(React 내부 구조 변경?)");
      if (cursor !== stateNames.length) {
        throw new Error(`useState 호출 수(${cursor})와 상태 이름 수(${stateNames.length})가 다릅니다`);
      }
      const nodes: RenderedNode[] = [];
      walk(tree, nodes);
      const labels = nodes.filter((n) => n.tag === "label").map((n) => n.text);
      const screen: Screen = {
        nodes,
        labels,
        text: nodes.map((n) => n.text).join(" "),
        has: (p) => labels.some((l) => l.startsWith(p)),
        resultItems: () => {
          const card = nodes.find((n) => n.tag === "#ResultCard");
          return card ? (card.props.items as { label: string; value: string }[]) : null;
        },
      };
      return screen;
    },
    set(name, value) {
      // 첫 렌더 전에 쓰면 앞쪽 슬롯이 빈 구멍(undefined)으로 남아
      //   `severity !== ""`처럼 초기값에 기대는 조건이 조용히 뒤집힌다.
      if (slots.length !== stateNames.length) throw new Error("초기 렌더 전에는 상태를 바꿀 수 없습니다");
      slots[indexOf(name)] = value;
    },
    get(name) { return slots[indexOf(name)]; },
  };
  harness.render(); // 슬롯을 초기값으로 채운다 — set()이 구멍을 만들지 않도록.
  return harness;
}

/** 소스에서 `useState` 선언 순서대로 상태 이름을 뽑는다(훅 순서와 같다). */
export function stateNamesFrom(src: string): string[] {
  return [...src.matchAll(/const \[(\w+), set\w+\] = useState/g)].map((m) => m[1]);
}
