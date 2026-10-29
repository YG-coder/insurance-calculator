import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sitemap from "../src/app/sitemap";
import { contentUpdated } from "../src/lib/content-dates";
import { publishedGuides } from "../src/lib/guides";
import { buildOutputFiles } from "./build-output-files.mjs";

const output = buildOutputFiles();
const xml = readFileSync(output.file("sitemap.xml.body"), "utf8");
const guides = new Map(publishedGuides().map((guide) => ["/guide/" + guide.slug, guide]));
for (const entry of sitemap()) {
  const path = new URL(entry.url).pathname;
  const updated = guides.get(path)?.updated ?? contentUpdated(path);
  const file = path === "/" ? "index.html" : path.slice(1) + ".html";
  const html = readFileSync(output.file(file), "utf8");
  const times = [...html.matchAll(/<time\b([^>]*)>([^<]*)<\/time>/g)]
    .filter((match) => match[1].includes('data-content-updated="' + path + '"'));
  assert.equal(times.length, 1, path + ": 수정일 표시 개수");
  assert.equal(times[0][2], updated, path + ": 화면 수정일");
  assert(times[0][1].includes('dateTime="' + updated + '"')
    || times[0][1].includes('datetime="' + updated + '"'), path + ": time 날짜");
  const schemas = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]) as Record<string, unknown>);
  assert(schemas.some((schema) => schema.dateModified === updated
    && (schema.url === entry.url || schema.mainEntityOfPage === entry.url)), path + ": JSON-LD 수정일");
  const loc = entry.url.replace(/&/g, "&amp;");
  const item = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .find((match) => match[1].includes("<loc>" + loc + "</loc>"));
  assert(item?.[1].includes("<lastmod>" + updated), path + ": 사이트맵 수정일");
}
console.log("[콘텐츠 출력 검사] 공개 " + sitemap().length + "개 화면·JSON-LD·사이트맵 수정일 일치");
