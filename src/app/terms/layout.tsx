import PageUpdated from "@/components/PageUpdated";

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<div className="container-base mb-8"><PageUpdated path="/terms" name="이용약관" /></div></>;
}
