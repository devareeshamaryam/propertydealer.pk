import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { User, UserSchema } from '@rent-ghar/db/schemas/user.schema';

/**
 * GoogleStrategy, but only when it can actually work.
 *
 * passport-google-oauth20 throws "OAuth2Strategy requires a clientID option"
 * from its constructor, so registering it unconditionally would stop the API
 * booting on any deployment that has not set up a Google app. With the keys
 * absent the strategy is simply not registered and /auth/providers reports
 * google: false, so the button never appears.
 */
function googleProvider() {
  return process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [GoogleStrategy]
    : [];
}

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get('JWT_SECRET');
        if (!secret || secret === 'default-secret-key') {
          throw new Error('JWT_SECRET must be set in environment variables and cannot be default value');
        }
        return {
          secret,
          signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') || '1h' },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, ...googleProvider()],
  controllers: [AuthController],
  exports: [AuthService, AuthService],
})
export class AuthModule {
  constructor(private configService: ConfigService) {
    // Verify JWT_SECRET is set without logging it
    const secret = this.configService.get('JWT_SECRET');
    if (!secret || secret === 'default-secret-key') {
      throw new Error('⚠️ SECURITY: JWT_SECRET must be set in environment variables');
    }
  }
}
