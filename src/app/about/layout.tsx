import PageUpdated from "@/components/PageUpdated";

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<div className="container-base mb-8"><PageUpdated path="/about" name="사이트 소개" /></div></>;
}
