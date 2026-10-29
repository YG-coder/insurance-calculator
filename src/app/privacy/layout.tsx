import PageUpdated from "@/components/PageUpdated";

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<div className="container-base mb-8"><PageUpdated path="/privacy" name="개인정보 처리방침" /></div></>;
}
