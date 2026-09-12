"use client";

import { RateListPage } from "@/components/dashboard/rate-list-page";

export default function TileRatesPage() {
  return (
    <RateListPage
      title="Tile Rates"
      description="Tile and marble prices shown on the public tile rate page."
      itemName="tile rate"
      itemNamePlural="tile rates"
      basePath="/dashboard/tile-rate"
      listEndpoint="/tile-rate/admin/all"
      deleteEndpoint="/tile-rate"
      columns={["city", "unit", "category"]}
      defaultUnit="Per Sq Ft"
    />
  );
}
