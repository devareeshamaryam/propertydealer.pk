import { MongoClient } from 'mongodb';

async function inspectMultan() {
    const client = await MongoClient.connect('mongodb+srv://admin:admin1234@cluster0.lmunqjj.mongodb.net/rent-ghar');
    const db = client.db();
    
    console.log('--- Inspecting Multan Properties ---');
    const properties = await db.collection('properties').find({ 
        $or: [
            { city: /multan/i },
            { 'location': /multan/i }
        ]
    }).toArray();

    console.log(`Found ${properties.length} potential matches for Multan`);
    
    properties.forEach(p => {
        console.log(`- ID: ${p._id}`);
        console.log(`  Title: ${p.title}`);
        console.log(`  City: "${p.city}"`);
        console.log(`  Status: ${p.status}`);
        console.log(`  ListingType: ${p.listingType}`);
        console.log(`  Area: ${p.area}`);
    });

    // Check Areas for Multan
    const multanCity = await db.collection('cities').findOne({ name: /multan/i });
    if (multanCity) {
        console.log(`\n--- Multan City in DB ---`);
        console.log(`ID: ${multanCity._id}, Name: ${multanCity.name}`);
        
        const areas = await db.collection('areas').find({ city: multanCity._id }).toArray();
        console.log(`Found ${areas.length} areas for Multan`);
        areas.slice(0, 5).forEach(a => console.log(` - ${a.name} (${a._id})`));
    } else {
        console.log('\n!!! Multan City NOT FOUND in cities collection');
    }

    await client.close();
}

inspectMultan();
