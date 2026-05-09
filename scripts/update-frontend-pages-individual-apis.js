const fs = require('fs');
const path = require('path');

const materials = [
  { name: 'Door', slug: 'today-door-rate-in-pakistan', apiSlug: 'door-rate' },
  { name: 'Wood', slug: 'today-wood-rate-in-pakistan', apiSlug: 'wood-rate' },
  { name: 'Sand', slug: 'today-sand-rate-in-pakistan', apiSlug: 'sand-rate' },
  { name: 'Tile', slug: 'today-tile-rate-in-pakistan', apiSlug: 'tile-rate' },
  { name: 'Bajri', slug: 'today-bajri-rate-in-pakistan', apiSlug: 'bajri-rate' },
  { name: 'Steel', slug: 'today-steel-rate-in-pakistan', apiSlug: 'steel-rate' },
  { name: 'Bricks', slug: 'today-bricks-rate-in-pakistan', apiSlug: 'bricks-rate' },
];

const webAppDir = path.join(__dirname, '../apps/web/app/(pages)');

materials.forEach(material => {
  const pageDir = path.join(webAppDir, material.slug);
  const pagePath = path.join(pageDir, 'page.tsx');

  const pageContent = `import { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import MaterialPageClient from "./MaterialPageClient";

export const revalidate = 60; // Revalidate every 60 seconds

export const metadata: Metadata = {
  title: "Today ${material.name} Rate in Pakistan 2026 | PropertyDealer.pk",
  description: "Check today's latest ${material.name.toLowerCase()} rates in Pakistan. Updated daily prices from top brands and suppliers.",
};

async function get${material.name}Rates() {
  try {
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:3010";
    const res = await fetch(\`\${apiUrl}/api/${material.apiSlug}\`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    console.error("Error fetching ${material.name.toLowerCase()} rates:", error);
    return [];
  }
}

export default async function ${material.name}RatePage() {
  let rates: any[] = [];
  let pageContent: string | null = null;
  let pageTitle: string | null = null;

  // Fetch rates + CMS page content in parallel
  const [ratesResult, pageResult] = await Promise.allSettled([
    get${material.name}Rates(),
    serverApi.getPageBySlug("${material.slug}"),
  ]);

  if (ratesResult.status === "fulfilled") {
    rates = ratesResult.value ?? [];
  }

  if (pageResult.status === "fulfilled" && pageResult.value) {
    pageContent = pageResult.value.content ?? null;
    pageTitle = pageResult.value.title ?? null;
  }

  return (
    <MaterialPageClient
      initialRates={rates}
      materialType="${material.name}"
      pageTitle="Today ${material.name} Rate in Pakistan"
      pageContent={pageContent}
      cmsPageTitle={pageTitle}
    />
  );
}
`;

  fs.writeFileSync(pagePath, pageContent);
  console.log(`✅ Updated ${material.slug}/page.tsx`);
});

console.log('\n🎉 All frontend pages updated to use individual APIs!');
