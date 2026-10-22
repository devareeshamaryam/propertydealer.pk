 'use client'

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AreaUnitProvider } from "@/components/area-unit/AreaUnitProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AreaUnitProvider>{children}</AreaUnitProvider>
    </QueryClientProvider>
  );
}