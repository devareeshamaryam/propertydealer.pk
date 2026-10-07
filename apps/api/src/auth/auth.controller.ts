import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request as ExpressRequest, Response, CookieOptions } from 'express';
import { Throttle } from '@nestjs/throttler';

type AuthRequest = ExpressRequest & { user?: unknown };
import { AuthService, TokenResponse, LoginResponse } from './auth.service';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { GoogleOauthGuard } from './guards/google-oauth.guard';
import type { GoogleProfile } from './strategies/google.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  /**
   * Which sign-in methods the front-end should offer.
   *
   * Public on purpose — it reveals nothing beyond what the login page shows.
   * The button is rendered from this rather than hard-coded, so an install
   * without Google credentials shows no dead button.
   */
  @Get('providers')
  providers(): { google: boolean } {
    return {
      google: Boolean(
        this.config.get<string>('GOOGLE_CLIENT_ID') &&
          this.config.get<string>('GOOGLE_CLIENT_SECRET'),
      ),
    };
  }

  /** Hands off to Google's consent screen; the guard does the redirecting. */
  @Get('google')
  @UseGuards(GoogleOauthGuard)
  googleStart(): void {
    // Never reached — passport redirects first.
  }

  /**
   * Google comes back here. Sets the same two cookies as a password login and
   * then bounces to the web app, which picks the session up from them.
   *
   * The token is deliberately NOT put in the redirect URL: query strings end up
   * in browser history, Referer headers and server logs.
   */
  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  async googleCallback(
    @Req() req: AuthRequest,
    @Res() res: Response,
  ): Promise<void> {
    const webUrl = (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000'
    ).replace(/\/$/, '');

    try {
      const result = await this.authService.loginWithGoogle(
        req.user as GoogleProfile,
      );

      const cookieOpts: CookieOptions = {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      };

      if (result.refreshToken) {
        res.cookie('refreshToken', result.refreshToken, {
          ...cookieOpts,
          maxAge: 1000 * 60 * 60 * 24 * 7,
        });
      }
      res.cookie('access_token', result.token, {
        ...cookieOpts,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });

      res.redirect(`${webUrl}/signing-in`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Google sign-in failed';

      if (/pending activation/i.test(message)) {
        res.redirect(`${webUrl}/pending-activation`);
        return;
      }

      res.redirect(`${webUrl}/login?error=google`);
    }
  }

  // test api endpoint
  @Get('test')
  test() {
    return { message: 'Hello World' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Req() req: AuthRequest) {
    return req.user;
  }

  // 🔒 SECURITY: Strict rate limiting on registration (CRITICAL)
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 registrations per minute
  async register(@Body() dto: RegisterDto): Promise<TokenResponse> {
    return this.authService.register(dto);
  }
  
  // 🔒 SECURITY: Strict rate limiting on login to prevent brute force (CRITICAL)
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<LoginResponse, 'refreshToken'>> {
    const result = await this.authService.login(dto);
    // set HttpOnly refresh token cookie
    const { refreshToken, token, ...rest } = result;
    
    // Cookie options with secure settings
    const cookieOpts: CookieOptions = {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production', // 🔒 SECURITY: HTTPS only in production
      path: '/',
    };

    if (refreshToken) {
      res.cookie('refreshToken', refreshToken, {
        ...cookieOpts,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      });
    }

    if (token) {
      res.cookie('access_token', token, {
        ...cookieOpts,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days (matches increased JWT expiry)
      });
    }

    return { token, ...rest };
  }
  @Post('refresh')
  async refresh(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() oldRefreshToken?: string,
  ): Promise<TokenResponse> {
    const token =
      (typeof oldRefreshToken === 'string' ? oldRefreshToken : undefined) ||
      (req.cookies && (req.cookies.refreshToken as string)) ||
      (req.headers['x-refresh-token'] as string | undefined);

    if (!token) {
      throw new UnauthorizedException('Refresh token is missing');
    }
    const result = await this.authService.refreshToken(token);

    // Cookie options
    const cookieOpts: CookieOptions = {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    };

    // Update access token cookie
    res.cookie('access_token', result.token, {
        ...cookieOpts,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    return result;
  }

  @Post('logout')
  async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: number; message: string }> {
    // clear cookies
    const token =
      (req.cookies && (req.cookies.refreshToken as string)) ||
      (req.headers['x-refresh-token'] as string | undefined);
    
    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('access_token', { path: '/' });
    
    return this.authService.invalidateRefreshToken(token ?? '');
  }
}
