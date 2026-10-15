// 원본 설정뿐 아니라 Next.js가 생성한 색인·공유 주소의 한글 도메인을 확인한다.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const origin = "https://보험계산기.kr";
const encodedOrigin = new URL(origin).origin;
const output = ".next/server/app";
const read = (file) => readFileSync(join(output, file), "utf8");
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}=(['"])(.*?)\\1`))?.[2];
const noEncodedOrigin = (text, file) => {
  assert(!text.includes(encodedOrigin), `${file}: 도메인이 퓨니코드로 변환됐습니다.`);
};

const sitemap = read("sitemap.xml.body");
noEncodedOrigin(sitemap, "sitemap.xml");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert(urls.length > 0, "사이트맵의 공개 페이지가 비어 있습니다.");
assert.equal(new Set(urls).size, urls.length, "사이트맵에 중복 주소가 있습니다.");
for (const url of urls) {
  assert(url === origin || url.startsWith(`${origin}/`), `사이트맵 주소: ${url}`);
  const path = new URL(url).pathname;
  const file = path === "/" ? "index.html" : `${decodeURIComponent(path.slice(1))}.html`;
  const html = read(file);
  const canonical = [...html.matchAll(/<link\b[^>]*>/g)]
    .map(([tag]) => tag).filter((tag) => attribute(tag, "rel") === "canonical");
  assert.equal(canonical.length, 1, `${url}: canonical은 1개여야 합니다.`);
  assert.equal(attribute(canonical[0], "href"), url, `${url}: canonical 표기 불일치`);
  const socialImages = { "og:image": [], "twitter:image": [] };
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/g)) {
    const key = attribute(tag, "property") ?? attribute(tag, "name");
    const value = attribute(tag, "content");
    if (key === "og:url" || Object.hasOwn(socialImages, key)) {
      assert(value === origin || value?.startsWith(`${origin}/`), `${url}: ${key} 표기 불일치`);
    }
    if (Object.hasOwn(socialImages, key)) socialImages[key].push(value);
  }
  for (const [key, images] of Object.entries(socialImages)) {
    assert.deepEqual(images, [`${origin}/opengraph-image.png`], `${url}: ${key} 중복·누락·주소 확인`);
  }
}

const robots = read("robots.txt.body");
noEncodedOrigin(robots, "robots.txt");
assert(robots.split("\n").includes(`Host: ${origin}`), "robots의 Host 표기 불일치");
assert(robots.split("\n").includes(`Sitemap: ${origin}/sitemap.xml`), "robots의 Sitemap 표기 불일치");

// 사이트맵에 없는 오류 페이지와 JSON-LD·RSC 데이터도 포함해 검사한다.
let htmlCount = 0;
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) inspect(file);
    else if (entry.name.endsWith(".html")) {
      noEncodedOrigin(readFileSync(file, "utf8"), file);
      htmlCount++;
    }
  }
}
inspect(output);
console.log(`[도메인 검사] 공개 ${urls.length}개 주소·HTML ${htmlCount}개·robots 한글 표기 확인`);
