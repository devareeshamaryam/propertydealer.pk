"use client";

import { RateListPage } from "@/components/dashboard/rate-list-page";

export default function CementRatesPage() {
  return (
    <RateListPage
      title="Cement Rates"
      description="Cement brand prices shown on the public cement rate page."
      itemName="cement rate"
      itemNamePlural="cement rates"
      basePath="/dashboard/cement-rate"
      listEndpoint="/cement-rate/admin/all"
      deleteEndpoint="/cement-rate"
      columns={["category", "weight"]}
      defaultUnit="Per Bag"
    />
  );
}
