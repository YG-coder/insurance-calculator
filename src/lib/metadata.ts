import type { Metadata } from "next";
import { SITE } from "./site";

type SocialMetadataInput = {
  title: string;
  description: string;
  url: string;
  type?: "website" | "article";
};

// openGraph는 얕게 병합되므로 각 페이지에서 이미지와 기본 속성을 함께 제공한다.
export function socialMetadata({
  title,
  description,
  url,
  type = "website",
}: SocialMetadataInput): Pick<Metadata, "openGraph" | "twitter"> {
  const image = {
    url: `${SITE.url}/opengraph-image.png`,
    width: 1200,
    height: 630,
    alt: SITE.name,
  };
  return {
    openGraph: {
      type,
      locale: "ko_KR",
      siteName: SITE.name,
      title,
      description,
      url,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
