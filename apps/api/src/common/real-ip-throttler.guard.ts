import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * The rate limiter, keyed on the real visitor.
 *
 * Requests reach the API two ways, and the stock guard (keyed on `req.ip`)
 * got both wrong at scale:
 *
 *  - Browsers come through Cloudflare → Nginx. With `trust proxy` set to the
 *    local Nginx, `req.ip` is the Cloudflare edge that forwarded the request —
 *    a handful of addresses shared by every visitor in a region — so busy
 *    hours would have hit the per-IP limits for everyone at once. Cloudflare
 *    puts the visitor's own address in CF-Connecting-IP; that is the key now
 *    (only trusted when the request came through the local proxy).
 *
 *  - The Next.js server calls the API directly on localhost to render pages.
 *    Every page view on the site came from that one address, so one bucket
 *    (600 a minute, 10,000 an hour) was shared by all server rendering. Those
 *    internal calls — loopback, no forwarding headers — are not limited; they
 *    are the site itself, not a client.
 *
 * Note: CF-Connecting-IP is only meaningful if the origin accepts traffic from
 * Cloudflare alone (firewall the server to Cloudflare's IP ranges).
 */
@Injectable()
export class RealIpThrottlerGuard extends ThrottlerGuard {
  private static isLoopback(addr?: string): boolean {
    return !!addr && (addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1');
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const peer: string | undefined = req?.socket?.remoteAddress;
    const forwarded = req?.headers?.['x-forwarded-for'] || req?.headers?.['cf-connecting-ip'];
    if (RealIpThrottlerGuard.isLoopback(peer) && !forwarded) return true;
    return super.shouldSkip(context);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const peer: string | undefined = req?.socket?.remoteAddress;
    const cf = req?.headers?.['cf-connecting-ip'];
    if (cf && RealIpThrottlerGuard.isLoopback(peer)) return String(Array.isArray(cf) ? cf[0] : cf).trim();
    return req.ip ?? peer ?? 'unknown';
  }
}
