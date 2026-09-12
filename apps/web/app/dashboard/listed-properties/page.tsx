import { redirect } from "next/navigation";

/**
 * Leftover scaffold page: it rendered three hard-coded sample properties
 * ("House DHA Phase 6", …) from a local mock file, with Edit and Delete
 * buttons that did nothing. It was never linked from the sidebar, so anyone
 * who reached it saw fake data that looked real.
 *
 * Redirecting rather than deleting keeps any existing bookmark working.
 */
export default function ListedPropertiesPage() {
  redirect("/dashboard/property");
}
