import { readFileSync, readdirSync } from "node:fs";
import { CALCULATORS } from "../src/lib/site";

const component = readFileSync("src/components/RelatedCalculators.tsx", "utf8");
const pageDirs = readdirSync("src/app", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.endsWith("-calculator"))
  .map((entry) => entry.name);
const pages = pageDirs.map((name) => `src/app/${name}/page.tsx`);

// 계산기 페이지 수를 상수로 박아두면 계산기를 추가할 때마다 테스트가 깨진다.
// 대신 site.ts의 CALCULATORS 목록과 실제 라우트가 정확히 일치하는지를 검사한다.
const registered = new Set(CALCULATORS.map((c) => c.href.replace(/^\//, "")));
const onDisk = new Set(pageDirs);
const missingRoute = [...registered].filter((href) => !onDisk.has(href));
const unregistered = [...onDisk].filter((dir) => !registered.has(dir));

const checks = [
  ["공통 계산기 구조화 데이터", component.includes('"@type": "WebApplication"')],
  ["금융 애플리케이션 분류", component.includes('applicationCategory: "FinanceApplication"')],
  [`site.ts 등록 계산기에 라우트 존재 (${registered.size}개)`, missingRoute.length === 0],
  ["라우트가 site.ts에 모두 등록됨", unregistered.length === 0],
  ["모든 계산기 페이지가 공통 구조화 데이터 컴포넌트 사용", pages.every((page) => readFileSync(page, "utf8").includes("<RelatedCalculators"))],
] as const;

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`  ${ok ? "✅" : "❌"} ${name}`);
if (missingRoute.length) console.error("    라우트 없음: " + missingRoute.join(", "));
if (unregistered.length) console.error("    site.ts 미등록: " + unregistered.join(", "));
if (failed.length) process.exit(1);
console.log(`[structuredData] 통과 ${checks.length} / 실패 0`);
