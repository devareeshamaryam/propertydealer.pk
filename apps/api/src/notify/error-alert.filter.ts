import { ArgumentsHost, Catch, HttpException, HttpServer, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { DISCORD_COLORS, DiscordService } from './discord.service';

/*
 * A server error (500) tells the admin in Discord — the route, the message
 * and where in the code — while the visitor gets the usual response. The
 * same error is announced at most once every 30 minutes, so a broken page
 * hit a thousand times is one alert, not a thousand. 4xx (a wrong password,
 * a missing listing) are normal traffic and never announced.
 */
@Catch()
export class ErrorAlertFilter extends BaseExceptionFilter {
  private readonly log = new Logger('ServerError');

  constructor(
    private readonly discord: DiscordService,
    adapter: HttpServer,
  ) {
    super(adapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    try {
      const status = exception instanceof HttpException ? exception.getStatus() : 500;
      if (status >= 500 && host.getType() === 'http') {
        const req = host.switchToHttp().getRequest();
        const err = exception as Error;
        const message = String(err?.message ?? exception).slice(0, 400);
        const route = `${req?.method ?? ''} ${String(req?.route?.path ?? req?.url ?? '').split('?')[0]}`;
        const where = String(err?.stack ?? '')
          .split('\n')
          .find((l) => l.includes('/src/') || l.includes('\\src\\'))
          ?.trim()
          .slice(0, 200);
        this.discord.sendOnce(`${route}|${message}`, 30, {
          title: '💥 Server error',
          description: message,
          color: DISCORD_COLORS.error,
          category: 'Errors',
          fields: [
            { name: 'Route', value: `\`${route}\``, inline: false },
            { name: 'Status', value: String(status) },
            { name: 'Page', value: String(req?.headers?.referer ?? '—').slice(0, 200) },
            ...(where ? [{ name: 'Where', value: `\`${where}\``, inline: false }] : []),
          ],
        });
      }
    } catch (e) {
      this.log.warn(`Could not announce an error: ${(e as Error).message}`);
    }
    super.catch(exception, host);
  }
}
