import 'reflect-metadata';
import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '@rent-ghar/db/schemas/user.schema';

async function checkUser() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  const email = 'user@gmail.com';
  const user = await userModel.findOne({ email }).select('+password +loginAttempts +lockUntil');

  if (!user) {
    console.log('❌ User not found:', email);
    console.log('\n📝 Creating admin user...');
    
    const newUser = new userModel({
      email: 'user@gmail.com',
      password: 'password', // Will be hashed by pre-save hook
      name: 'Admin User',
      role: 'ADMIN',
      isActive: true,
    });
    
    await newUser.save();
    console.log('✅ Admin user created successfully!');
    console.log('   Email: user@gmail.com');
    console.log('   Password: password');
  } else {
    console.log('✅ User found:', email);
    console.log('   Name:', user.name);
    console.log('   Role:', user.role);
    console.log('   Active:', user.isActive);
    console.log('   Login Attempts:', user.loginAttempts || 0);
    console.log('   Lock Until:', user.lockUntil || 'Not locked');
    
    if (user.lockUntil && user.lockUntil > new Date()) {
      console.log('\n⚠️  Account is LOCKED! Unlocking...');
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
      console.log('✅ Account unlocked!');
    }
  }

  await app.close();
  process.exit(0);
}

checkUser().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
