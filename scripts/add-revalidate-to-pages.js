const fs = require('fs');
const path = require('path');

const materials = [
  'today-wood-rate-in-pakistan',
  'today-sand-rate-in-pakistan',
  'today-tile-rate-in-pakistan',
  'today-bajri-rate-in-pakistan',
  'today-steel-rate-in-pakistan',
  'today-bricks-rate-in-pakistan',
];

const webAppDir = path.join(__dirname, '../apps/web/app/(pages)');

materials.forEach(slug => {
  const pagePath = path.join(webAppDir, slug, 'page.tsx');
  
  if (!fs.existsSync(pagePath)) {
    console.log(`⚠️  ${slug}/page.tsx not found`);
    return;
  }

  let content = fs.readFileSync(pagePath, 'utf8');
  
  // Check if revalidate already exists
  if (content.includes('export const revalidate')) {
    console.log(`✅ ${slug} - already has revalidate`);
    return;
  }

  // Add revalidate after imports
  content = content.replace(
    /import MaterialPageClient from "\.\/MaterialPageClient";/,
    `import MaterialPageClient from "./MaterialPageClient";\n\nexport const revalidate = 60; // Revalidate every 60 seconds`
  );

  fs.writeFileSync(pagePath, content);
  console.log(`✅ ${slug} - added revalidate`);
});

console.log('\n🎉 Done!');
