import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import MobileNav from "@/components/MobileNav";
import { CartProvider } from "@/components/shop/CartProvider";
import CartSheet from "@/components/shop/CartSheet";

export default function PagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The materials cart lives here so it follows the visitor across pages.
    <CartProvider>
      <NavBar />
      {children}
      <Footer />

      {/*
        Room for the tab bar, so the end of the footer is never stuck
        underneath it. Footer-coloured so it reads as the footer's last strip.
        Phones only — the bar itself is md:hidden.
      */}
      <div aria-hidden className="h-[calc(3.5rem+env(safe-area-inset-bottom))] bg-navy md:hidden" />
      <MobileNav />
      <CartSheet />
    </CartProvider>
  );
}
