 "use client";

import dynamic from "next/dynamic";
import { CITIES } from "../cities-data";

const EMap = dynamic(() => import("../EMap"), { ssr: false });

export default function EmapClient({ focusedSlug }: { focusedSlug: string }) {
  return (
    <div style={{ width: "100%", height: "600px" }}>
      <EMap cities={CITIES} focusedSlug={focusedSlug} />
    </div>
  );
}