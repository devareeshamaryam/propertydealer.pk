import { Logger, Module, Provider } from '@nestjs/common';
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
 *
 * ---
 *
 * This has to be a factory, and the reason is pure timing.
 *
 * It used to read `process.env` directly from the @Module decorator. Decorator
 * arguments are evaluated while the file is being imported, and app.module.ts
 * imports this file at the top — strictly before its own decorator runs and
 * therefore before `ConfigModule.forRoot()` has had a chance to read .env into
 * process.env. So on any server whose credentials live in a .env file rather
 * than the real shell environment, the check saw two undefineds and quietly
 * registered nothing.
 *
 * The symptom was a liar: /auth/providers reads the same two values through
 * ConfigService at request time, by which point they exist, so it answered
 * `{"google":true}` and the button appeared — while /auth/google threw
 * "Unknown authentication strategy google" from passport and surfaced as a
 * bare 500.
 *
 * A useFactory runs during Nest's DI bootstrap instead, after ConfigModule has
 * loaded, so it sees what the rest of the app sees. Returning null when the
 * keys are absent keeps the original behaviour: nothing is registered, nothing
 * throws, and GoogleOauthGuard answers 503.
 */
const googleStrategyProvider: Provider = {
  provide: GoogleStrategy,
  inject: [ConfigService],
  useFactory: (config: ConfigService): GoogleStrategy | null => {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientID || !clientSecret) {
      Logger.log(
        'Google sign-in is off: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set.',
        'AuthModule',
      );
      return null;
    }

    // Constructing it is what registers it with passport (the PassportStrategy
    // mixin calls passport.use in its constructor).
    Logger.log('Google sign-in is on.', 'AuthModule');
    return new GoogleStrategy(config);
  },
};

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
  providers: [AuthService, JwtStrategy, googleStrategyProvider],
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
