import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/**
 * ApiKeyGuard
 * -----------
 * Protects external automation endpoints (e.g. n8n) using a static API key.
 *
 * Security characteristics:
 *  - Reads the expected key from `LISTING_API_KEY` env var. Refuses to allow
 *    any request if the env var is not set (fail-closed).
 *  - Reads the caller-supplied key from the `x-api-key` header (preferred) or,
 *    as a fallback, from `Authorization: Bearer <key>`.
 *  - Uses `crypto.timingSafeEqual` for constant-time comparison to prevent
 *    timing-based key disclosure.
 *
 * Scope: this guard is only used by the `ListingApi` module, which exposes a
 * minimal, listing-only set of endpoints. It does NOT grant access to the rest
 * of the application (admin endpoints continue to require JWT + AdminGuard).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('LISTING_API_KEY');

    if (!expected || expected.trim().length < 16) {
      // Fail closed: refuse to authenticate if the server isn't configured
      // with a sufficiently strong key. We don't want a misconfiguration to
      // accidentally open the endpoints up.
      throw new UnauthorizedException(
        'Listing API is not configured on this server',
      );
    }

    const req = context.switchToHttp().getRequest();
    const headerKey =
      (req.headers['x-api-key'] as string | undefined) ||
      (typeof req.headers['authorization'] === 'string' &&
      req.headers['authorization'].toLowerCase().startsWith('bearer ')
        ? (req.headers['authorization'] as string).slice(7)
        : undefined);

    if (!headerKey || typeof headerKey !== 'string') {
      throw new UnauthorizedException('Missing API key');
    }

    // Constant-time compare. Buffers must be the same length, so we hash to a
    // fixed length is overkill — instead, pad the shorter to the longer to
    // avoid throwing, and rely on length comparison too.
    const a = Buffer.from(headerKey);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Stamp the request so downstream handlers know this came via the API key.
    req.apiKeyAuth = true;
    return true;
  }
}
