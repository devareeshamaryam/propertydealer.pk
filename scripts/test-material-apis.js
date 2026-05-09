const axios = require('axios');

const API_BASE = 'http://localhost:3010/api';

const materials = [
  'cement-rate',
  'door-rate',
  'wood-rate',
  'sand-rate',
  'tile-rate',
  'bajri-rate',
  'steel-rate',
  'bricks-rate',
];

async function testAPI(material) {
  try {
    console.log(`\n🧪 Testing ${material}...`);
    
    // Test public endpoint
    const publicResponse = await axios.get(`${API_BASE}/${material}`);
    console.log(`  ✅ GET /${material} - ${publicResponse.status} - ${publicResponse.data.length} items`);
    
    return { material, status: 'success', count: publicResponse.data.length };
  } catch (error) {
    console.error(`  ❌ GET /${material} - ${error.response?.status || error.message}`);
    return { material, status: 'failed', error: error.message };
  }
}

async function testAllAPIs() {
  console.log('🚀 Testing all Material Rate APIs...\n');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const material of materials) {
    const result = await testAPI(material);
    results.push(result);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 SUMMARY:\n');
  
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  
  console.log(`✅ Successful: ${successful.length}/${materials.length}`);
  console.log(`❌ Failed: ${failed.length}/${materials.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ Working APIs:');
    successful.forEach(r => console.log(`   - ${r.material} (${r.count} items)`));
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed APIs:');
    failed.forEach(r => console.log(`   - ${r.material}: ${r.error}`));
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (failed.length === 0) {
    console.log('\n🎉 All APIs are working correctly!');
  } else {
    console.log('\n⚠️  Some APIs need attention.');
  }
}

// Run the tests
testAllAPIs().catch(console.error);
