import JsonLd from "@/components/JsonLd";
import { contentUpdated } from "@/lib/content-dates";
import { SITE } from "@/lib/site";

export default function PageUpdated({ path, name, structured = true }: {
  path: string;
  name: string;
  structured?: boolean;
}) {
  const updated = contentUpdated(path);
  return (
    <>
      <p className="mt-3 text-xs leading-6 text-slate-500">
        마지막 수정 <time data-content-updated={path} dateTime={updated}>{updated}</time>
      </p>
      {structured && <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name,
        url: SITE.url + (path === "/" ? "" : path),
        dateModified: updated,
        inLanguage: "ko-KR",
      }} />}
    </>
  );
}
