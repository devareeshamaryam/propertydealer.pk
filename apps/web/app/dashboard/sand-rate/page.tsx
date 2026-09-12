"use client";

import { RateListPage } from "@/components/dashboard/rate-list-page";

export default function SandRatesPage() {
  return (
    <RateListPage
      title="Sand Rates"
      description="Sand prices by source and city for the public rate page."
      itemName="sand rate"
      itemNamePlural="sand rates"
      basePath="/dashboard/sand-rate"
      listEndpoint="/sand-rate/admin/all"
      deleteEndpoint="/sand-rate"
      columns={["city", "unit", "category"]}
      defaultUnit="Per Trolley"
    />
  );
}
