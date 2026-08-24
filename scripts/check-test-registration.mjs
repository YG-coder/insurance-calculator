// 테스트 등록 누락 가드.
// tests/ 디렉터리의 테스트 파일 집합과 package.json의 test:all 등록 집합을 비교한다.
//
// 개수 비교로는 부족하다 — "한 파일 누락 + 다른 파일 중복"이 서로 상쇄되어 통과한다.
// 따라서 양방향 차집합과 중복을 모두 검사한다.
//
// 근본 해결은 vitest 등 글롭 기반 러너로 전환해 등록 자체를 없애는 것이다(감사 M-9).
import { readdirSync, readFileSync } from "node:fs";

const TEST_RE = /tests\/[\w.-]+\.test\.ts/g;

const onDisk = new Set(
  readdirSync("tests")
    .filter((f) => f.endsWith(".test.ts"))
    .map((f) => `tests/${f}`)
);

const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts ?? {};

// test:all — 디스크와 정확히 일치해야 한다(양방향).
const listedAll = [...(scripts["test:all"] ?? "").matchAll(TEST_RE)].map((m) => m[0]);
const registeredAll = new Set(listedAll);

const missing = [...onDisk].filter((f) => !registeredAll.has(f));
const ghost = [...registeredAll].filter((f) => !onDisk.has(f));
const duplicate = listedAll.filter((f, i) => listedAll.indexOf(f) !== i);

// test:insurance — 실손 엔진 테스트만 담으므로 부분집합이면 된다.
const listedIns = [...(scripts["test:insurance"] ?? "").matchAll(TEST_RE)].map((m) => m[0]);
const insGhost = listedIns.filter((f) => !onDisk.has(f));
const insDuplicate = listedIns.filter((f, i) => listedIns.indexOf(f) !== i);

const problems = [];
if (missing.length) problems.push(`test:all 미등록: ${missing.join(", ")}`);
if (ghost.length) problems.push(`test:all 유령 등록(파일 없음): ${ghost.join(", ")}`);
if (duplicate.length) problems.push(`test:all 중복 등록: ${[...new Set(duplicate)].join(", ")}`);
if (insGhost.length) problems.push(`test:insurance 유령 등록(파일 없음): ${insGhost.join(", ")}`);
if (insDuplicate.length) problems.push(`test:insurance 중복 등록: ${[...new Set(insDuplicate)].join(", ")}`);

if (problems.length) {
  console.error("[테스트 등록 가드] 실패");
  problems.forEach((p) => console.error("  ❌ " + p));
  process.exit(1);
}

console.log(`[테스트 등록 가드] ✅ 파일 ${onDisk.size}개 · test:all ${registeredAll.size}개 정합 (양방향 차집합 공집합, 중복 없음)`);
