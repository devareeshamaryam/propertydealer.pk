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

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
