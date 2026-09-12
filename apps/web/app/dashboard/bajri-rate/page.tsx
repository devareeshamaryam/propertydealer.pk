"use client";

import { RateListPage } from "@/components/dashboard/rate-list-page";

export default function BajriRatesPage() {
  return (
    <RateListPage
      title="Bajri Rates"
      description="Crush and gravel prices shown on the public bajri rate page."
      itemName="bajri rate"
      itemNamePlural="bajri rates"
      basePath="/dashboard/bajri-rate"
      listEndpoint="/bajri-rate/admin/all"
      deleteEndpoint="/bajri-rate"
      columns={["city", "unit", "category"]}
      defaultUnit="Per Trolley"
    />
  );
}
