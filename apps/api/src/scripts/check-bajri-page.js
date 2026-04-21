const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://fazlani362_db_user:Ts9r4zqAZab8dFf6@ac-zjxivxm-shard-00-00.y55tdfc.mongodb.net:27017,ac-zjxivxm-shard-00-01.y55tdfc.mongodb.net:27017,ac-zjxivxm-shard-00-02.y55tdfc.mongodb.net:27017/rent-ghar?ssl=true&replicaSet=atlas-ixd0oq-shard-0&authSource=admin&retryWrites=true&w=majority';

async function checkBajriPage() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Page = mongoose.connection.collection('pages');
    
    const slug = 'today-bajri-rate-in-pakistan';
    const page = await Page.findOne({ slug });

    if (!page) {
      console.log(`❌ Bajri page NOT found in database!`);
      console.log(`   Slug: ${slug}`);
      console.log('\n📝 You need to create this page from admin panel.');
    } else {
      console.log(`✅ Bajri page found!`);
      console.log(`   Title: ${page.title}`);
      console.log(`   Status: ${page.status}`);
      console.log(`   Content length: ${page.content?.length || 0} characters`);
      console.log(`\n📄 Content preview (first 200 chars):`);
      console.log(page.content?.substring(0, 200) + '...');
      
      if (page.status !== 'PUBLISHED') {
        console.log('\n⚠️  Page is NOT published!');
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkBajriPage();
