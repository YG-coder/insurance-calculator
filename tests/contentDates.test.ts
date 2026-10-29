import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { checkContentDates, validDate } from "../scripts/content-date-checks";
import { CONTENT_DATES, contentUpdated } from "../src/lib/content-dates";
import PageUpdated from "../src/components/PageUpdated";
import sitemap from "../src/app/sitemap";
import { publishedGuides } from "../src/lib/guides";

const page = "src/app/demo/page.tsx";
const engine = "src/lib/insurance/engine/example.ts";
const sha = "a".repeat(40), ignored = "b".repeat(40);
const dates = { "/demo": { updated: "2026-10-27", watch: [page, "src/lib/insurance/**"] } };
const histories = (file: string) => file === engine
  ? [{ sha: ignored, date: "2026-10-29" }, { sha, date: "2026-10-28" }]
  : [{ sha, date: "2026-10-01" }];
assert(checkContentDates(dates, [page, engine], histories, "2026-10-29").some((error) => error.includes(engine)));
const excepted = { "/demo": { ...dates["/demo"], ignore: [{ sha: ignored, reason: "표시만 변경" }] } };
assert(checkContentDates(excepted, [page, engine], histories, "2026-10-29").some((error) => error.includes(sha)));
assert.equal(checkContentDates({ "/demo": { ...excepted["/demo"], updated: "2026-10-28" } },
  [page, engine], histories, "2026-10-29").length, 0);
assert(checkContentDates(dates, [page, engine, "src/components/calculators/New.tsx"], histories, "2026-10-29")
  .some((error) => error.includes("watch 누락")));
assert(checkContentDates({ "/demo": { ...dates["/demo"], updated: "2026-11-01" } },
  [page, engine], histories, "2026-10-29").some((error) => error.includes("미래")));
assert(checkContentDates({ "/demo": { ...dates["/demo"], updated: "2026-09-01" } },
  [page, engine], histories, "2026-10-29").some((error) => error.includes("생성일")));
assert(!validDate("2026-02-30"));
assert.throws(() => contentUpdated("/missing"));
for (const [path, entry] of Object.entries(CONTENT_DATES)) {
  const html = renderToStaticMarkup(React.createElement(PageUpdated, { path, name: path }));
  assert(html.includes('dateTime="' + entry.updated + '"'));
  assert(html.includes('"dateModified":"' + entry.updated + '"'));
  const item = sitemap().find((row) => new URL(row.url).pathname === path);
  assert.equal(item?.lastModified, entry.updated);
}
const paths = sitemap().map((entry) => new URL(entry.url).pathname).sort();
assert.deepEqual(paths, [...Object.keys(CONTENT_DATES), ...publishedGuides().map((guide) => "/guide/" + guide.slug)].sort());
console.log("✅ 내용 수정일: 엔진 변경·예외 뒤 변경·새 파일 누락·날짜 검증·사이트맵 일치");
