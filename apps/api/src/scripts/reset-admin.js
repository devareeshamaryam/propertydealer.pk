const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URI = 'mongodb://fazlani362_db_user:Ts9r4zqAZab8dFf6@ac-zjxivxm-shard-00-00.y55tdfc.mongodb.net:27017,ac-zjxivxm-shard-00-01.y55tdfc.mongodb.net:27017,ac-zjxivxm-shard-00-02.y55tdfc.mongodb.net:27017/rent-ghar?ssl=true&replicaSet=atlas-ixd0oq-shard-0&authSource=admin&retryWrites=true&w=majority';

async function resetAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = mongoose.connection.collection('users');
    
    const email = 'user@gmail.com';
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ User not found. Creating admin user...');
      
      const hashedPassword = await bcrypt.hash('password', 10);
      
      await User.insertOne({
        email: 'user@gmail.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'ADMIN',
        isActive: true,
        loginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log('✅ Admin user created!');
      console.log('   Email: user@gmail.com');
      console.log('   Password: password');
    } else {
      console.log('✅ User found:', email);
      console.log('   Role:', user.role);
      console.log('   Active:', user.isActive);
      console.log('   Login Attempts:', user.loginAttempts || 0);
      
      if (user.lockUntil && user.lockUntil > new Date()) {
        console.log('⚠️  Account is LOCKED! Unlocking...');
      }
      
      // Reset password and unlock account
      const hashedPassword = await bcrypt.hash('password', 10);
      
      await User.updateOne(
        { email },
        {
          $set: {
            password: hashedPassword,
            loginAttempts: 0,
            role: 'ADMIN',
            isActive: true,
          },
          $unset: { lockUntil: '' }
        }
      );
      
      console.log('✅ Admin account reset!');
      console.log('   Email: user@gmail.com');
      console.log('   Password: password');
      console.log('   Role: ADMIN');
    }

    await mongoose.disconnect();
    console.log('\n🎉 Done! You can now login.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetAdmin();
