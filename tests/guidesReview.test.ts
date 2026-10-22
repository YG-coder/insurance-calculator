// 가이드 검수 기록 규칙 — "본문이 있으니 검수된 글"로 처리되지 않도록 빌드·테스트가 강제한다.
import assert from "node:assert/strict";
import { GUIDES, assertGuideReview, publishedGuides, type Guide } from "../src/lib/guides";

// 공식 기관 주소만 허용한다. prem.kidi.or.kr 은 보험개발원 '내차보험료 할인할증조회' 서비스(보험료산출방식안내), www.knia.or.kr 은 손해보험협회.
// ⚠ 호스트는 실제로 원문을 확인한 기관 주소만 하나씩 더한다. 와일드카드·도메인 전체 허용은 쓰지 않는다.
//   direct.hi.co.kr 은 현대해상 다이렉트 약관 PDF(Hi2307) 한 건을 위한 허용이다 — 보험사 약관은 공식 기관 자료가 아니라
//   '한 회사 상품의 실제 약관'이므로, 가이드 본문과 locator 에 회사·상품·판본 범위를 밝히는 조건으로만 쓴다.
//   carinfo.knia.or.kr 은 손해보험협회 자동차보험 종합포털(상품설명서 표준안)이다.
//   direct.samsungfire.com 은 확인한 2026 암·운전자 약관, www.axa.co.kr 은 2026.4.30 암보험 약관,
//   www.directdb.co.kr 은 2026 적용일을 밝힌 자동차보험 공개 안내만 상품·조건을 한정해 인용한다.
const OFFICIAL_HOSTS = [
  "www.law.go.kr", "law.go.kr", "www.fsc.go.kr", "www.fss.or.kr", "www.kidi.or.kr", "prem.kidi.or.kr",
  "www.knia.or.kr", "carinfo.knia.or.kr",
  "direct.hi.co.kr", "direct.samsungfire.com", "www.axa.co.kr", "www.directdb.co.kr",
];

// 1) 모든 가이드(초안 포함)에 review 가 있고, 발행 가이드는 규칙을 통과한다.
for (const g of GUIDES) {
  assert.ok(g.review, `${g.slug}: review 누락`);
  assertGuideReview(g);
}

// 2) 발행 가이드의 출처는 공식 기관 https 주소여야 하고, 대조일이 있어야 한다.
for (const g of publishedGuides()) {
  for (const src of g.sources ?? []) {
    const url = new URL(src.url);
    assert.equal(url.protocol, "https:", `${g.slug}: ${src.url}`);
    assert.ok(OFFICIAL_HOSTS.includes(url.hostname), `${g.slug}: 공식 기관 주소가 아닙니다 — ${url.hostname}`);
    assert.match(src.checkedAt, /^\d{4}-\d{2}-\d{2}$/, `${g.slug}: 출처 대조일`);
  }
  if (g.review.status !== "pending") {
    assert.ok((g.sources ?? []).length > 0, `${g.slug}: 대조했다면 출처가 있어야 합니다`);
  }
}

// 3) 규칙 위반은 예외 — verified 인데 출처 없음 / partial 인데 unchecked 없음 / pending 인데 사유 없음 / review 없음
const base: Guide = {
  slug: "x", cluster: "hub", title: "t", description: "d", keyword: "k", intro: "i", updated: "2026-01-01",
  review: { status: "pending", unchecked: "r" }, body: [{ h2: "h", p: ["p"] }],
};
const src = { title: "t", issuer: "i", url: "https://www.law.go.kr/x", checkedAt: "2026-01-01" };
assert.doesNotThrow(() => assertGuideReview(base));
assert.throws(() => assertGuideReview({ ...base, review: { status: "verified", checkedAt: "2026-01-01", scope: "s" } }), /sources/);
assert.throws(() => assertGuideReview({ ...base, review: { status: "verified", scope: "s" }, sources: [src] }), /checkedAt/);
assert.throws(() => assertGuideReview({ ...base, review: { status: "partial", checkedAt: "2026-01-01", scope: "s" }, sources: [src] }), /unchecked/);
assert.throws(() => assertGuideReview({ ...base, review: { status: "verified", checkedAt: "2026-01-01", scope: "s", unchecked: "u" }, sources: [src] }), /partial/);
assert.throws(() => assertGuideReview({ ...base, review: { status: "pending" } }), /unchecked/);
assert.throws(() => assertGuideReview({ ...base, review: undefined as unknown as Guide["review"] }), /review/);
// 초안(body 없음)은 review 만 있으면 통과한다.
assert.doesNotThrow(() => assertGuideReview({ ...base, body: undefined, review: { status: "pending" } }));

const counts = publishedGuides().reduce<Record<string, number>>((acc, g) => { acc[g.review.status] = (acc[g.review.status] ?? 0) + 1; return acc; }, {});
console.log(`[가이드 검수] ✅ 발행 ${publishedGuides().length}편 — 상태 분포 ${JSON.stringify(counts)}, 출처 형식·공식 기관 주소·규칙 위반 예외 확인`);
