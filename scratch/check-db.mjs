import { MongoClient } from 'mongodb';

async function checkImages() {
  const uri = "mongodb://fazlani362_db_user:Ts9r4zqAZab8dFf6@ac-zjxivxm-shard-00-00.y55tdfc.mongodb.net:27017,ac-zjxivxm-shard-00-01.y55tdfc.mongodb.net:27017,ac-zjxivxm-shard-00-02.y55tdfc.mongodb.net:27017/rent-ghar?ssl=true&replicaSet=atlas-ixd0oq-shard-0&authSource=admin&retryWrites=true&w=majority";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('rent-ghar');
    const rates = await db.collection('cementrates').find({}).toArray();
    console.log('--- Cement Rates Images ---');
    rates.forEach(r => {
      console.log(`Brand: ${r.brand}, Image: ${r.image}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

checkImages();
