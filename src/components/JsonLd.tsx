/**
 * 구조화 데이터(JSON-LD)를 **서버 HTML에 그대로** 싣는다.
 *
 * ⚠ `next/script`로 넣으면 RSC 페이로드에만 실리고 `<script type="application/ld+json">` 태그가
 *   서버 HTML에 나오지 않는다. JS를 실행하지 않는 수집기(네이버 Yeti·생성형 검색 수집기·진단 도구)는
 *   그 데이터를 읽지 못한다. Next.js 공식 문서도 네이티브 `<script>` 렌더링을 권장한다.
 * ⚠ `<`를 `<`로 바꿔, 값 안의 문자열 "</script>"가 태그를 닫지 못하게 한다(같은 문서의 권장).
 * ⚠ 재발 방지 검사: tests/jsonLdServerRender.test.ts
 */
export default function JsonLd({ id, data }: { id?: string; data: object }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
