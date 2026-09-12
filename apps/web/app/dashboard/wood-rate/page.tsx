"use client";

import { RateListPage } from "@/components/dashboard/rate-list-page";

export default function WoodRatesPage() {
  return (
    <RateListPage
      title="Wood Rates"
      description="Timber and wood prices shown on the public wood rate page."
      itemName="wood rate"
      itemNamePlural="wood rates"
      basePath="/dashboard/wood-rate"
      listEndpoint="/wood-rate/admin/all"
      deleteEndpoint="/wood-rate"
      columns={["city", "unit", "category"]}
      defaultUnit="Per Cubic Ft"
    />
  );
}
