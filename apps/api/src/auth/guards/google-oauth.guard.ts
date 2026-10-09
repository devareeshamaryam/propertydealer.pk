import {
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { GOOGLE_STRATEGY } from '../strategies/google.strategy';

/**
 * AuthGuard('google') with one extra check in front of it.
 *
 * The strategy is only registered when GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET are present (see auth.module.ts), because
 * passport-google-oauth20 throws from its constructor without them and would
 * take the whole API down with it. Without that guard clause, hitting
 * /auth/google on an install that has no Google app would surface as
 * "Unknown authentication strategy" — a 500 that looks like a crash.
 *
 * This turns it into a plain 503 with a sentence that says what to do.
 */
@Injectable()
export class GoogleOauthGuard extends AuthGuard(GOOGLE_STRATEGY) {
  constructor(private readonly config: ConfigService) {
    super({
      // Ask Google for an account every time rather than silently reusing the
      // one already signed in — people share devices.
      prompt: 'select_account',
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      !this.config.get<string>('GOOGLE_CLIENT_ID') ||
      !this.config.get<string>('GOOGLE_CLIENT_SECRET')
    ) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then restart the API.',
      );
    }

    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      /*
       * "Unknown authentication strategy" means the keys are set but nothing
       * ever registered the strategy with passport — the exact state the
       * module's factory provider now prevents. It reached the browser as a
       * bare `{"statusCode":500,"message":"Internal server error"}`, which
       * says nothing about what to fix, so it is translated here as well:
       * the guard is the only place that knows both halves of the story.
       */
      if (/unknown authentication strategy/i.test((error as Error)?.message ?? '')) {
        throw new ServiceUnavailableException(
          'Google sign-in is configured but the strategy did not load. Restart the API; if it persists, check the API log at boot for the "Google sign-in is" line.',
        );
      }
      throw error;
    }
  }
}
