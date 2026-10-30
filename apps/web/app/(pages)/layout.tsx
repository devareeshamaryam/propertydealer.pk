import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import MobileNav from "@/components/MobileNav";
import { CartProvider } from "@/components/shop/CartProvider";
import CartSheet from "@/components/shop/CartSheet";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import AssistantWidget from "@/components/assistant/AssistantWidget";
import { OtherPagesAdZone } from "@/components/ads/AdSlot";

export default function PagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The materials cart lives here so it follows the visitor across pages.
    <CartProvider>
      {/* .site-shell: phones get the edge-to-edge gutter (globals.css). */}
      <div className="site-shell">
      <NavBar />
      <OtherPagesAdZone at="top" wrap="container mx-auto px-[var(--gutter)] sm:px-4" />
      {children}
      <OtherPagesAdZone at="bottom" wrap="container mx-auto px-[var(--gutter)] sm:px-4" />
      <Footer />

      {/*
        Room for the tab bar, so the end of the footer is never stuck
        underneath it. Footer-coloured so it reads as the footer's last strip.
        Phones only — the bar itself is md:hidden.
      */}
      <div aria-hidden className="h-[calc(5.5rem+env(safe-area-inset-bottom))] bg-navy md:hidden" />
      <MobileNav />
      <CartSheet />
      <FloatingWhatsApp />
      <AssistantWidget />
      </div>
    </CartProvider>
  );
}
