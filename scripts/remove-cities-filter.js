const fs = require('fs');
const path = require('path');

const materials = [
  'door',
  'wood',
  'sand',
  'tile',
  'bajri',
  'steel',
  'bricks',
];

materials.forEach(material => {
  const filePath = path.join(
    __dirname,
    `../apps/web/app/(pages)/today-${material}-rate-in-pakistan/MaterialPageClient.tsx`
  );

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Remove CITIES constant
  content = content.replace(
    /const CITIES\s*=\s*\["All Cities",\s*\.\.\.Array\.from\(new Set\(ALL_RATES\.map\(\(b\)\s*=>\s*b\.city\)\.filter\(Boolean\)\)\)\];?\n?/g,
    ''
  );

  // Remove selectedCity state
  content = content.replace(
    /const \[selectedCity,\s*setSelectedCity\]\s*=\s*useState\("All Cities"\);?\n?/g,
    ''
  );

  // Remove city filter from filtered useMemo
  content = content.replace(
    /\.filter\(\(b\)\s*=>\s*selectedCity\s*===\s*"All Cities"\s*\|\|\s*b\.city\s*===\s*selectedCity\)\n?/g,
    ''
  );

  // Remove selectedCity from useMemo dependencies
  content = content.replace(
    /, selectedCity/g,
    ''
  );

  // Remove setSelectedCity from resetFilters
  content = content.replace(
    /setSelectedCity\("All Cities"\);?\n?\s*/g,
    ''
  );

  // Remove the entire Cities FilterSection
  content = content.replace(
    /<FilterSection title="Cities">[\s\S]*?<\/FilterSection>\n?/g,
    ''
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Removed cities filter from: ${material}-rate`);
});

console.log('\n🎉 Cities filter removed from all material pages!');
