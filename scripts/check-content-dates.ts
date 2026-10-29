import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_DATES } from "../src/lib/content-dates";
import { publishedGuides } from "../src/lib/guides";
import { checkContentDates, validDate, type ContentCommit } from "./content-date-checks";

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
if (git("rev-parse", "--is-shallow-repository") === "true") {
  throw new Error("수정일 검사에는 전체 Git 이력이 필요합니다. CI checkout의 fetch-depth를 0으로 설정하세요.");
}
const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    // 빈 디렉터리 보존용 파일은 계산 콘텐츠가 아니다. 그 밖의 새 파일은 확장자와 무관하게 검사한다.
    if (entry.name === ".gitkeep") return [];
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
  });
const files = walk("src");
const cache = new Map<string, ContentCommit[]>();
function history(file: string): ContentCommit[] {
  if (!cache.has(file)) {
    const log = git("log", "--format=%H %cs", "--", file);
    cache.set(file, log ? log.split("\n").map((line) => {
      const [sha, date] = line.split(" ");
      return { sha, date };
    }) : []);
  }
  return cache.get(file)!;
}
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const errors = checkContentDates(CONTENT_DATES, files, history, today);
for (const guide of publishedGuides()) {
  if (!validDate(guide.updated) || guide.updated > today) errors.push("가이드 수정일: " + guide.slug);
  if (guide.published && (!validDate(guide.published) || guide.published > guide.updated)) {
    errors.push("가이드 발행일: " + guide.slug);
  }
}
for (const entry of Object.values(CONTENT_DATES)) {
  for (const exception of entry.ignore ?? []) git("cat-file", "-e", exception.sha + "^{commit}");
}
if (errors.length) throw new Error("\n" + errors.join("\n"));
console.log("[수정일 검사] 경로 " + Object.keys(CONTENT_DATES).length
  + "개·발행 가이드 " + publishedGuides().length + "개·계산기/엔진 watch 범위 확인");
