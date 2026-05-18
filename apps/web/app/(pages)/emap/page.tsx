 "use client";

import dynamic from "next/dynamic";
import { CITIES } from "./cities-data";

const EMap = dynamic(() => import("./EMap"), { ssr: false });

export default function EmapPage() {
  return (
    <div style={{ width: "100%", height: "600px" }}>
      <EMap cities={CITIES} focusedSlug={null} />
    </div>
  );
}