import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";

const component = readFileSync("src/components/RelatedCalculators.tsx", "utf8");
const pages = readdirSync("src/app", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.endsWith("-calculator"))
  .map((entry) => `src/app/${entry.name}/page.tsx`);

const checks = [
  ["공통 계산기 구조화 데이터", component.includes('"@type": "WebApplication"')],
  ["금융 애플리케이션 분류", component.includes('applicationCategory: "FinanceApplication"')],
  ["10개 계산기 페이지 발견", pages.length === 10],
  ["모든 계산기 페이지가 공통 구조화 데이터 컴포넌트 사용", pages.every((page) => readFileSync(page, "utf8").includes("<RelatedCalculators"))],
] as const;

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`  ${ok ? "✅" : "❌"} ${name}`);
if (failed.length) process.exit(1);
console.log(`[structuredData] 통과 ${checks.length} / 실패 0`);
