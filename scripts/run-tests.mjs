import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const tests = readdirSync("tests")
  .filter((file) => file.endsWith(".test.ts"))
  .sort();

for (const test of tests) {
  const result = spawnSync(resolve("node_modules/.bin/tsx"), [`tests/${test}`], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\n[전체 테스트] ✅ ${tests.length}개 파일 자동 탐색·실행`);
