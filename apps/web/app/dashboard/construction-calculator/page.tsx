import { redirect } from "next/navigation";

/*
 * The construction calculator's settings now live with the tool, in
 * Dashboard → Tools & Calculators. Old links and bookmarks land there.
 */
export default function ConstructionCalculatorSettings() {
  redirect("/dashboard/tool-pages?page=construction-cost-calculator&tab=settings");
}
