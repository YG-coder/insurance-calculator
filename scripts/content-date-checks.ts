import { matchesGlob } from "node:path";
import type { ContentDate } from "../src/lib/content-dates";

export type ContentCommit = { sha: string; date: string };

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

export function checkContentDates(
  entries: Record<string, ContentDate>,
  files: readonly string[],
  history: (file: string) => readonly ContentCommit[],
  today: string,
): string[] {
  const errors: string[] = [];
  const covered = new Set<string>();
  for (const [path, entry] of Object.entries(entries)) {
    if (!validDate(entry.updated) || entry.updated > today) {
      errors.push(path + ": 유효하지 않거나 미래인 수정일 " + entry.updated);
      continue;
    }
    const ignored = new Set<string>();
    for (const exception of entry.ignore ?? []) {
      if (!/^[a-f0-9]{40}$/.test(exception.sha) || !exception.reason.trim()) {
        errors.push(path + ": 예외는 전체 커밋 SHA와 사유가 필요합니다");
      }
      ignored.add(exception.sha);
    }
    const watched = new Set<string>();
    if (entry.watch.length === 0) errors.push(path + ": watch가 비어 있습니다");
    for (const pattern of entry.watch) {
      const matches = files.filter((file) => matchesGlob(file, pattern));
      if (matches.length === 0) errors.push(path + ": 파일과 일치하지 않는 watch " + pattern);
      for (const file of matches) { watched.add(file); covered.add(file); }
    }
    const page = "src/app" + (path === "/" ? "" : path) + "/page.tsx";
    if (!watched.has(page)) errors.push(path + ": 페이지 본문이 watch에서 빠졌습니다");
    const created = history(page).at(-1)?.date;
    if (created && entry.updated < created) errors.push(path + ": 생성일 " + created + "보다 수정일이 이릅니다");
    for (const file of watched) {
      // 최신 리팩터를 예외 처리해도 그 앞의 실제 내용 변경을 놓치지 않도록 이력을 모두 본다.
      const pending = history(file).find((commit) => commit.date > entry.updated && !ignored.has(commit.sha));
      if (pending) {
        errors.push(path + ": " + file + " (" + pending.sha + ", " + pending.date
          + ") — 내용 변경이면 updated를 검토하고, 표시·리팩터만이면 SHA와 사유를 ignore에 기록하세요");
      }
    }
  }
  for (const file of files) {
    if ((file.startsWith("src/components/calculators/") || file.startsWith("src/lib/insurance/"))
      && !covered.has(file)) errors.push("watch 누락: " + file);
  }
  return errors;
}
