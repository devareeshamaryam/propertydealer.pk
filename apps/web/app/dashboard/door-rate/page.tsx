"use client";

import { RateListPage } from "@/components/dashboard/rate-list-page";

export default function DoorRatesPage() {
  return (
    <RateListPage
      title="Door Rates"
      description="Door brand prices shown on the public door rate page."
      itemName="door rate"
      itemNamePlural="door rates"
      basePath="/dashboard/door-rate"
      listEndpoint="/door-rate/admin/all"
      deleteEndpoint="/door-rate"
      columns={["city", "unit", "category"]}
      defaultUnit="Per Door"
    />
  );
}
