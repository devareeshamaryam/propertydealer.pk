"use client";

import { RateListPage } from "@/components/dashboard/rate-list-page";

export default function BricksRatesPage() {
  return (
    <RateListPage
      title="Bricks Rates"
      description="Brick prices by quality and city for the public rate page."
      itemName="bricks rate"
      itemNamePlural="bricks rates"
      basePath="/dashboard/bricks-rate"
      listEndpoint="/bricks-rate/admin/all"
      deleteEndpoint="/bricks-rate"
      columns={["city", "unit", "category"]}
      defaultUnit="Per 1000"
    />
  );
}
