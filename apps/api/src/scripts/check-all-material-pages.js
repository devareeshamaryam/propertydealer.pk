const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://fazlani362_db_user:Ts9r4zqAZab8dFf6@ac-zjxivxm-shard-00-00.y55tdfc.mongodb.net:27017,ac-zjxivxm-shard-00-01.y55tdfc.mongodb.net:27017,ac-zjxivxm-shard-00-02.y55tdfc.mongodb.net:27017/rent-ghar?ssl=true&replicaSet=atlas-ixd0oq-shard-0&authSource=admin&retryWrites=true&w=majority';

const materialPages = [
  'today-door-rate-in-pakistan',
  'today-wood-rate-in-pakistan',
  'today-sand-rate-in-pakistan',
  'today-tile-rate-in-pakistan',
  'today-bajri-rate-in-pakistan',
  'today-steel-rate-in-pakistan',
  'today-bricks-rate-in-pakistan',
];

async function checkAllPages() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Page = mongoose.connection.collection('pages');
    
    console.log('📄 Checking all material pages:\n');
    
    for (const slug of materialPages) {
      const page = await Page.findOne({ slug });
      
      if (!page) {
        console.log(`❌ ${slug}`);
        console.log(`   Status: NOT FOUND\n`);
      } else {
        const hasContent = page.content && page.content.length > 100;
        const status = page.status === 'PUBLISHED' ? '✅' : '⚠️';
        const contentStatus = hasContent ? '✅' : '❌';
        
        console.log(`${status} ${slug}`);
        console.log(`   Status: ${page.status}`);
        console.log(`   Content: ${contentStatus} ${page.content?.length || 0} chars`);
        console.log(`   Title: ${page.title}`);
        console.log('');
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAllPages();
