import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import MobileNav from "@/components/MobileNav";

export default function PagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <NavBar />
      {children}
      <Footer />

      {/*
        Room for the floating tab bar, so the end of the footer is never stuck
        underneath it. Phones only — the bar itself is md:hidden.
      */}
      <div aria-hidden className="h-24 md:hidden" />
      <MobileNav />
    </>
  );
}
