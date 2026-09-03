// 커버리지 측정 설정 가드.
//
// 이 테스트가 지키려는 것은 세 가지다.
//
//  (1) 측정 범위가 설명과 일치할 것.
//      --src는 --all이 훑을 디렉터리만 제한할 뿐, 테스트 실행 중 로드된 바깥 파일
//      (scripts/run-tests.mjs, src/lib/site.ts 등)까지 막지 못한다. 그대로 두면
//      보험 코드와 무관한 파일의 변화가 99% 하한을 흔든다. 그래서 include로 범위를
//      못박고, 여기서 c8를 한 번 더 돌려 실제 보고서의 파일 목록을 검사한다.
//
//  (2) types.ts 제외의 근거가 계속 유효할 것.
//      근거는 "컴파일 산출물에 실행 코드가 없다"이므로, 소스를 정규식으로 훑지 않고
//      TypeScript API로 실제 변환해 결과가 비어 있는지 본다. 정규식은 부작용 import,
//      런타임 re-export, namespace, 여러 줄 선언을 놓친다.
//
//  (3) 기본 제외 목록과 하한이 낡거나 내려가지 않을 것.
//      c8/istanbul은 exclude를 지정하면 기본 목록을 병합이 아니라 '대체'한다.
//      과거 --exclude 한 줄로 tests/가 측정에 유입돼 커버리지가 붕괴한 적이 있다.
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + "  " + detail); }
}

const TYPES_FILE = "src/lib/insurance/engine/types.ts";
const c8rc = JSON.parse(readFileSync(".c8rc.json", "utf8")) as { include: string[]; exclude: string[] };
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
const readme = readFileSync("README.md", "utf8");
const script = pkg.scripts["test:coverage"];

// ─────────────────────────────────────────────────────────────
// 1. 기본 제외 목록 — 원본과 자동 대조
// ─────────────────────────────────────────────────────────────
let istanbulDefaults: string[] | null = null;
try {
  const req = createRequire(import.meta.url);
  istanbulDefaults = (req("@istanbuljs/schema") as { defaults: { nyc: { exclude: string[] } } })
    .defaults.nyc.exclude;
} catch (e) {
  console.log("  (원본 로드 실패: " + String(e) + ")");
}
check("istanbul 기본 제외 목록 원본을 읽을 수 있음(자동 대조 가능)", istanbulDefaults !== null,
  "@istanbuljs/schema를 찾지 못했습니다. c8 의존성이 바뀌었는지 확인하고 .c8rc.json의 기본 목록을 손으로 대조하세요.");
const defaultsList = istanbulDefaults ?? [];
const missing = defaultsList.filter((p) => !c8rc.exclude.includes(p));
check(`.c8rc.json: istanbul 기본 제외 ${defaultsList.length}개를 모두 포함`,
  istanbulDefaults !== null && missing.length === 0, missing.join(", "));

const extra = c8rc.exclude.filter((p) => !defaultsList.includes(p));
check(".c8rc.json: 기본 목록 외 추가 제외는 1건", extra.length === 1, JSON.stringify(extra));
check(".c8rc.json: 추가 제외 대상은 types.ts뿐", extra[0] === TYPES_FILE, JSON.stringify(extra));
check(".c8rc.json: include가 보험 디렉터리로 한정", JSON.stringify(c8rc.include) === JSON.stringify(["src/lib/insurance/**"]),
  JSON.stringify(c8rc.include));

// ─────────────────────────────────────────────────────────────
// 2. types.ts가 정말 '컴파일 산출물이 빈' 타입 전용 파일인지
//    — 소스가 아니라 TypeScript가 뱉은 JavaScript를 본다.
// ─────────────────────────────────────────────────────────────
/** 변환 후 남는 JavaScript. 빈 ESM 표식(export {};)만 있으면 빈 문자열이 된다. */
function emittedJs(source: string): string {
  const out = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      removeComments: true,
      isolatedModules: true,
    },
  }).outputText;
  return out
    .replace(/^﻿/, "")
    .replace(/\bexport\s*\{\s*\}\s*;?/g, "") // 타입만 있는 모듈에 붙는 빈 표식
    .replace(/^\s*["']use strict["'];?\s*$/gm, "")
    .trim();
}

const typesSource = readFileSync(TYPES_FILE, "utf8");
const typesEmit = emittedJs(typesSource);
check(`${TYPES_FILE}: 컴파일 산출물에 실행 코드 없음(제외 근거)`, typesEmit === "",
  "남은 JS: " + typesEmit.slice(0, 300));

// 검출기가 실제로 무는지 — 소스 문자열에만 변이를 얹어 확인한다(파일을 만들지 않는다).
const MUTATIONS: [string, string][] = [
  ["런타임 상수", 'export const runtimeValue = 1;'],
  ["enum", 'export enum RuntimeEnum { A }'],
  ["부작용 import", 'import "./some-runtime-module";'],
  ["런타임 re-export", 'export { runtimeValue } from "./some-runtime-module";'],
  ["namespace", 'export namespace RuntimeNs { export const x = 1; }'],
  ["여러 줄 실행 선언", 'export const runtimeObject = {\n  a: 1,\n  b: 2,\n};'],
];
for (const [label, code] of MUTATIONS) {
  check(`검출기 확인: ${label}가 섞이면 실행 코드로 잡힘`, emittedJs(typesSource + "\n" + code) !== "");
}

// ─────────────────────────────────────────────────────────────
// 3. 실제 커버리지 보고서의 파일 목록
//    — 설정만 보지 않고 c8를 한 번 더 돌려 결과를 검사한다.
//    중첩 실행을 막기 위해 자식에게는 COVERAGE_GUARD_CHILD를 넘긴다.
// ─────────────────────────────────────────────────────────────
if (process.env.COVERAGE_GUARD_CHILD === "1") {
  console.log("  ⏭  보고서 파일 목록 검사는 상위 실행에서 수행됨(중첩 방지)");
} else {
  const tmp = mkdtempSync(join(tmpdir(), "cov-guard-"));
  try {
    // test:coverage의 c8 인자를 그대로 재사용한다. 하한·리포터만 갈아끼운다.
    const args = script
      .replace(/^c8\s+/, "")
      .replace(/\s*node\s+scripts\/run-tests\.mjs\s*$/, "")
      .split(/\s+/)
      .filter((a) => a && !/^--(check-coverage|lines|statements|functions|branches|reporter)/.test(a))
      .filter((a) => !/^\d+$/.test(a)); // 하한 플래그의 숫자 인자
    const env = { ...process.env };
    env.COVERAGE_GUARD_CHILD = "1";
    // 상위 c8의 수집 디렉터리를 물려받지 않도록(중첩 실행 시 데이터 오염 방지)
    delete (env as Record<string, string | undefined>).NODE_V8_COVERAGE;
    const run = spawnSync(resolve("node_modules/.bin/c8"), [
      ...args,
      "--reporter=json-summary",
      "--report-dir", join(tmp, "report"),
      "--temp-directory", join(tmp, "tmp"),
      "node", "scripts/run-tests.mjs",
    ], { encoding: "utf8", env });

    check("보고서 생성용 c8 재실행 성공", run.status === 0, (run.stderr || "").slice(-400));
    const summary = JSON.parse(readFileSync(join(tmp, "report", "coverage-summary.json"), "utf8")) as Record<string, unknown>;
    const files = Object.keys(summary)
      .filter((k) => k !== "total")
      .map((k) => k.replace(process.cwd() + "/", ""))
      .sort();

    check(`측정 대상이 비어 있지 않음 (${files.length}개)`, files.length > 20, String(files.length));
    const outside = files.filter((f) => !f.startsWith("src/lib/insurance/"));
    check("모든 측정 파일이 src/lib/insurance/ 아래", outside.length === 0, outside.join(", "));
    for (const banned of ["scripts/", "tests/"]) {
      const hits = files.filter((f) => f.startsWith(banned));
      check(`측정 대상에 ${banned} 없음`, hits.length === 0, hits.join(", "));
    }
    check("측정 대상에 src/lib/site.ts 없음", !files.includes("src/lib/site.ts"));
    check(`측정 대상에 ${TYPES_FILE} 없음`, !files.includes(TYPES_FILE));

    // 빠지면 안 되는 보험 런타임 파일 — 범위를 너무 좁혀 놓치는 사고를 막는다.
    for (const required of [
      "src/lib/insurance/common/settle.ts",
      "src/lib/insurance/engine/engine.ts",
      "src/lib/insurance/engine/constants.ts",
      "src/lib/insurance/engine/generation2026.ts",
      "src/lib/insurance/engine/multiClaim2026.ts",
      "src/lib/insurance/engine/regulatoryRules.ts",
      "src/lib/insurance/engine/feature/discount.ts",
      "src/lib/insurance/decision/premiumRatio.ts",
    ]) {
      check(`측정 대상에 ${required} 포함`, files.includes(required));
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ─────────────────────────────────────────────────────────────
// 4. 하한 — 낮추는 방향의 변경을 막는다.
// ─────────────────────────────────────────────────────────────
const th = (name: string) => {
  const m = script.match(new RegExp(`--${name}\\s+(\\d+)`));
  return m ? Number(m[1]) : NaN;
};
const FLOORS = { lines: 99, statements: 99, functions: 90, branches: 80 } as const;
for (const [name, min] of Object.entries(FLOORS)) {
  check(`test:coverage 하한 --${name} ≥ ${min}`, th(name) >= min, `현재 ${th(name)}`);
}
check("test:coverage가 --check-coverage로 실제 강제", script.includes("--check-coverage"));

// ─────────────────────────────────────────────────────────────
// 5. README는 순간 수치가 아니라 하한과 확인 경로를 적는다.
//    ⚠ 전역 금지는 쓰지 않는다 — 보험 설명의 정상적인 12.5% 같은 비율까지 막는다.
//    검사 대상은 (가)커버리지 절 본문과 (나)과거 실측값 표기 형식뿐이다.
// ─────────────────────────────────────────────────────────────
const covSection = (readme.match(/^###\s*커버리지[\s\S]*?(?=^##\s|\Z)/m) ?? [""])[0];
check("README: 커버리지 절이 존재", covSection.trim() !== "");
const inSection = covSection.match(/\d+\.\d+\s*%/g) ?? [];
check("README 커버리지 절: 낡기 쉬운 실측 퍼센트 없음", inSection.length === 0, inSection.join(", "));
// 과거 표기 형식(지표명 + 소수점 퍼센트)은 문서 어디에 있어도 낡는다.
const metricPercents = readme.match(/(Statements|Branches|Functions|Lines|스테이트먼트|브랜치)[^\n|]{0,20}\d+\.\d+\s*%/gi) ?? [];
check("README: 지표명과 붙은 실측 퍼센트 없음", metricPercents.length === 0, metricPercents.join(" | "));

for (const [name, min] of Object.entries(FLOORS)) {
  check(`README: --${name} 하한 ${min}% 명시`, new RegExp(`${name}[^\\n]*${min}%`, "i").test(readme));
}
check("README: 커버리지 확인 경로(npm run test:coverage) 안내", readme.includes("npm run test:coverage"));
check("README: types.ts 제외 근거 명시", readme.includes("타입 전용") && readme.includes("types.ts"));
check("README: 측정 범위 설명이 include와 일치", readme.includes("src/lib/insurance"));

console.log(`\n[coverageConfig] 통과 ${pass} / 실패 ${fail}`);
if (fail) process.exit(1);
