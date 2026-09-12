"use client";

import { RateListPage } from "@/components/dashboard/rate-list-page";

export default function SteelRatesPage() {
  return (
    <RateListPage
      title="Steel Rates"
      description="Sarya and steel prices shown on the public steel rate page."
      itemName="steel rate"
      itemNamePlural="steel rates"
      basePath="/dashboard/steel-rate"
      listEndpoint="/steel-rate/admin/all"
      deleteEndpoint="/steel-rate"
      columns={["city", "unit", "category"]}
      defaultUnit="Per Ton"
    />
  );
}
