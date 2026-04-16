import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import PropertiesFilterBar from "@/components/PropertiesFilterBar";
import { Suspense } from "react";

export default function PropertiesLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Suspense fallback={<div className="h-20 bg-background border-b animate-pulse" />}>
                <PropertiesFilterBar />
            </Suspense>
            {children}
        </>
    )
}
