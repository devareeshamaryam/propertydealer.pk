import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';

/**
 * "Continue with Google".
 *
 * Deliberately added to the existing passport/JWT setup rather than swapping
 * the site over to next-auth: the session, the refresh-token cookie and every
 * guard already work the way they do, and replacing that wholesale on a live
 * site is a far bigger risk than one extra strategy.
 *
 * The callback issues exactly the same JWT as an email/password login, so
 * everything downstream — guards, roles, /auth/profile — is unchanged.
 */
export const GOOGLE_STRATEGY = 'google';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, GOOGLE_STRATEGY) {
  private static readonly logger = new Logger(GoogleStrategy.name);

  constructor(config: ConfigService) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';

    super({
      clientID,
      clientSecret,
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') ??
        'http://localhost:3005/api/auth/google/callback',
      scope: ['email', 'profile'],
    });

    if (!clientID || !clientSecret) {
      GoogleStrategy.logger.warn(
        'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set — the "Continue with Google" button will return an error until they are.',
      );
    }
  }

  /** Hands the controller just the fields it needs to find or create a user. */
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value?.toLowerCase();

    if (!email) {
      // Google can withhold the address if the user declined the email scope.
      done(new Error('Google did not share an email address for this account'));
      return;
    }

    done(null, {
      email,
      name: profile.displayName || email.split('@')[0],
      googleId: profile.id,
      picture: profile.photos?.[0]?.value,
    });
  }
}

/** What `validate` puts on the request. */
export interface GoogleProfile {
  email: string;
  name: string;
  googleId: string;
  picture?: string;
}
