import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RegisterDto } from './dtos/register.dto';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '@rent-ghar/db/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dtos/login.dto';
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';

export interface TokenResponse {
  token: string;
  user: { _id: string; name: string; email: string; role: string; isActive: boolean };
  status: number;
  message: string;
}

export interface LoginResponse extends TokenResponse {
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private readonly discord: DiscordService,
  ) {}
  async register(dto: RegisterDto): Promise<LoginResponse> {
    const existingUser = await this.userModel.findOne({ email: dto.email });
    /*
     * 409, not 502.
     *
     * This threw BadGatewayException, which is HTTP 502 — "the upstream
     * server sent me a bad response". Cloudflare treats 5xx from the origin
     * as the origin being broken and replaces the body with its own error
     * page, so the browser received the string "error code: 502" and never
     * saw `{"message":"User already exists"}`. The sign-up form has a branch
     * for exactly this case — it sends you to /login with the email filled
     * in — and it could never fire, because neither the status nor the
     * message it looks for survived the trip. Everyone with an account
     * already just saw "Could not create your account".
     *
     * An email that is taken is a conflict, not a gateway failure.
     */
    if (existingUser) throw new ConflictException('User already exists');
    /*
     * Everyone is an agent from the first second.
     *
     * The old USER role could read listings and nothing else, so the moment
     * somebody wanted to post one we had to detect it and flip the role
     * underneath them. Starting as AGENT costs a buyer nothing — the dashboard
     * is simply there if they ever want it — and it removes a branch from
     * sign-up, from the listing flow and from this file. The Free plan needs
     * no row: SubscriptionService falls back to it when there is no paid one.
     */
    const user = new this.userModel({ ...dto, role: 'AGENT' });
    await user.save();

    this.discord.send({
      title: '👤 New account',
      description: `${user.name || 'No name'} — ${user.email}`,
      url: '/dashboard/users',
      color: DISCORD_COLORS.account,
      fields: [
        { name: 'Role', value: String(user.role || 'USER') },
        { name: 'Signed up with', value: 'Email + password' },
        { name: 'User id', value: `\`${user._id.toString()}\``, inline: false },
      ],
    });

    /*
     * A real session, not just an access token.
     *
     * register() used to mint only the short-lived access token and return
     * it — no refresh token, so the controller had nothing to put in a
     * cookie. A brand-new account therefore worked for exactly as long as
     * JWT_EXPIRES_IN (an hour by default) and then could not renew: the
     * dashboard emptied out and the person was bounced to /login having done
     * nothing wrong. Sign-up now produces the same session login() does.
     */
    const session = await this.issueSession(user, 'Registered successfully');
    return { ...session, status: 201 };
  }

  // 🔒 SECURITY: Login with account lockout protection (HIGH PRIORITY)
  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.userModel
      .findOne({ email: dto.email })
      .select('+password +loginAttempts +lockUntil +refreshToken');

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Account locked due to too many failed login attempts. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}`
      );
    }

    // Reset lock if lock period has expired
    if (user.lockUntil && user.lockUntil <= new Date()) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
    }

    const isPasswordValid = await user.comparePassword(dto.password);
    
    if (!isPasswordValid) {
      // Increment failed attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      
      // Lock account after 5 failed attempts for 15 minutes
      if (user.loginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await user.save();
        throw new UnauthorizedException(
          'Account locked due to too many failed login attempts. Please try again in 15 minutes.'
        );
      }
      
      await user.save();
      const attemptsLeft = 5 - user.loginAttempts;
      throw new UnauthorizedException(
        `Invalid credentials. ${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} remaining before account lockout.`
      );
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0 || user.lockUntil) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
    }

    if (user.isActive === false) {
      throw new ForbiddenException('Account is pending activation');
    }
    
    // generate access token and refresh token
    const accessToken = this.generateToken(user);
    const refreshPayload = { sub: user._id.toString() };
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!refreshSecret) {
      throw new Error('⚠️ SECURITY: JWT_REFRESH_SECRET must be set');
    }
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    } as any);

    // store refresh token on user record
    user.refreshToken = refreshToken;
    await user.save();

    return {
      token: accessToken,
      refreshToken,
      user: {
        _id: user._id.toString(),
        name: user.name || '',
        email: user.email,
        role: user.role || 'user',
        isActive: user.isActive,
      },
      status: 200,
      message: 'Login successful',
    };
  }
  /**
   * "Continue with Google".
   *
   * Looks the account up by googleId and falls back to the email address, so
   * someone who originally signed up with a password can still use the button —
   * the two are linked onto one account rather than duplicated. A first-time
   * visitor is created here, which is the point: no form, no password to
   * invent, and no OTP.
   */
  async loginWithGoogle(profile: {
    email: string;
    name: string;
    googleId: string;
    picture?: string;
  }): Promise<LoginResponse> {
    let user = await this.userModel
      .findOne({
        $or: [{ googleId: profile.googleId }, { email: profile.email }],
      })
      // Written back by issueSession below; selected so the document is not
      // saving a field it never loaded.
      .select('+refreshToken');

    if (!user) {
      user = new this.userModel({
        email: profile.email,
        name: profile.name,
        googleId: profile.googleId,
        provider: 'google',
        avatarUrl: profile.picture,
        // Same as the password path above: one kind of account.
        role: 'AGENT',
      });
      await user.save();

      this.discord.send({
        title: '👤 New account (Google)',
        description: `${profile.name || 'No name'} — ${profile.email}`,
        url: '/dashboard/users',
        color: DISCORD_COLORS.account,
        fields: [
          { name: 'Role', value: String(user.role || 'USER') },
          { name: 'Signed up with', value: 'Continue with Google' },
          { name: 'User id', value: `\`${user._id.toString()}\``, inline: false },
        ],
      });
    } else if (!user.googleId) {
      // Existing password account using the button for the first time.
      user.googleId = profile.googleId;
      if (!user.name && profile.name) user.name = profile.name;
      if (!user.avatarUrl && profile.picture) user.avatarUrl = profile.picture;
      await user.save();
    }

    if (user.isActive === false) {
      throw new ForbiddenException('Account is pending activation');
    }

    return this.issueSession(user, 'Login successful');
  }

  /**
   * Access token + refresh token, stored on the user record.
   *
   * Mirrors the tail of login() deliberately: a Google sign-in must produce
   * exactly the same session as an email/password one, so that every guard,
   * cookie and refresh call downstream behaves identically.
   */
  private async issueSession(
    user: UserDocument,
    message: string,
  ): Promise<LoginResponse> {
    const accessToken = this.generateToken(user);
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!refreshSecret) {
      throw new Error('⚠️ SECURITY: JWT_REFRESH_SECRET must be set');
    }
    const refreshToken = this.jwtService.sign(
      { sub: user._id.toString() },
      {
        secret: refreshSecret,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      } as any,
    );

    user.refreshToken = refreshToken;
    await user.save();

    return {
      token: accessToken,
      refreshToken,
      user: {
        _id: user._id.toString(),
        name: user.name || '',
        email: user.email,
        role: user.role || 'user',
        isActive: user.isActive,
      },
      status: 200,
      message,
    };
  }

  private generateToken(user: UserDocument): string {
    const payload = {
      email: user.email,
      sub: user._id.toString(),
      role: user.role,
      isActive: user.isActive,
    };

    return this.jwtService.sign(payload as any);
  }

  async refreshToken(oldRefreshToken: string): Promise<TokenResponse> {
    if (!oldRefreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }
    try {
      const payload = this.jwtService.verify(oldRefreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      }) as { sub: string };

      /*
       * `+refreshToken` is not optional here.
       *
       * The field is declared `@Prop({ select: false })` on the user schema,
       * so a plain findById leaves it undefined — and the comparison two lines
       * down then failed for everybody, every time. /auth/refresh could not
       * succeed at all: "Continue with Google" ended on "the session did not
       * stick" (the whole flow hangs off this one call), and a password
       * session simply died the moment its access token expired instead of
       * renewing, which is the dashboard going blank until a manual reload.
       */
      const user = await this.userModel
        .findById(payload.sub)
        .select('+refreshToken');

      if (!user) throw new UnauthorizedException('Invalid token');
      if (user.refreshToken !== oldRefreshToken)
        throw new UnauthorizedException('Invalid token');
      return {
        token: this.generateToken(user),
        user: {
          _id: user._id.toString(),
          name: user.name || '',
          email: user.email,
          role: user.role || 'user',
          isActive: user.isActive,
        },
        status: 200,
        message: 'Refresh token successful',
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  async invalidateRefreshToken(
    oldRefreshToken: string,
  ): Promise<{ status: number; message: string }> {
    if (!oldRefreshToken) return { status: 200, message: 'Logged out' };
    try {
      const payload = this.jwtService.verify(oldRefreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      }) as { sub: string };
      // Same reason as refreshToken() above: without +refreshToken this
      // comparison never matched, so signing out left the stored token in
      // place and the cookie was the only thing actually revoked.
      const user = await this.userModel
        .findById(payload.sub)
        .select('+refreshToken');

      if (user && user.refreshToken === oldRefreshToken) {
        user.refreshToken = undefined;
        await user.save();
      }
    } catch (err) {
      // token invalid/expired → already logged out
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('Invalid refresh token during logout:', errMsg);
    }
    return { status: 200, message: 'Logged out' };
  }
}
