import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { RegisterDto } from './dtos/register.dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '@rent-ghar/db/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dtos/login.dto';
import { DiscordService, DISCORD_COLORS } from '../notify/discord.service';

export interface TokenResponse {
  token: string;
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  status: number;
  message: string;
}

export interface LoginResponse extends TokenResponse {
  refreshToken?: string;
}

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The query that finds an account by email address — the way the mailbox sees it.
 *
 * Gmail ignores dots and anything after a "+" in the name: xo.moeez@gmail.com,
 * xomoeez@gmail.com and xomoeez+ads@gmail.com are one inbox. Google sign-in
 * returns the address exactly as the Google account spells it, so somebody who
 * typed it without the dot when signing up with a password got a second,
 * empty account the first time they pressed "Continue with Google". Matching
 * on the mailbox links the two instead. Every other domain: case-insensitive,
 * exact.
 */
export function emailQuery(raw: string): Record<string, unknown> {
  const email = String(raw ?? '')
    .trim()
    .toLowerCase();
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (at > 0 && (domain === 'gmail.com' || domain === 'googlemail.com')) {
    const base = local.split('+')[0]!.replace(/\./g, '');
    if (base) {
      const name = [...base].map(escapeRe).join('\\.?');
      return {
        email: {
          $regex: new RegExp(
            `^${name}(\\+[^@]*)?@(gmail|googlemail)\\.com$`,
            'i',
          ),
        },
      };
    }
  }
  return { email: { $regex: new RegExp(`^${escapeRe(email)}$`, 'i') } };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private readonly discord: DiscordService,
  ) {}
  async register(dto: RegisterDto): Promise<LoginResponse> {
    const existingUser = await this.userModel
      .findOne(emailQuery(dto.email))
      .select('+password googleId');
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
    if (existingUser) {
      throw new ConflictException(
        !existingUser.password && existingUser.googleId
          ? 'User already exists — this email signs in with Google. Use "Continue with Google", then set a password from My Account.'
          : 'User already exists',
      );
    }
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
    // Only a city that exists — anything else is left for the dashboard to ask again.
    const { city: cityId, ...rest } = dto;
    let city: Types.ObjectId | undefined;
    if (cityId && Types.ObjectId.isValid(cityId)) {
      const found = await this.userModel.db
        .collection('cities')
        .findOne(
          { _id: new Types.ObjectId(cityId) },
          { projection: { _id: 1 } },
        );
      if (!found)
        throw new BadRequestException('Choose your city from the list');
      city = found._id as Types.ObjectId;
    }
    const user = new this.userModel({
      ...rest,
      role: 'AGENT',
      ...(city ? { city } : {}),
    });
    await user.save();

    this.discord.send({
      title: '👤 New account',
      description: `${user.name || 'No name'} — ${user.email}`,
      url: `/dashboard/users?q=${encodeURIComponent(user.email)}`,
      color: DISCORD_COLORS.account,
      category: 'Accounts',
      fields: [{ name: 'Signed up with', value: 'Email + password' }],
      who: [{ label: '👤 Who', id: user._id }],
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
    // Oldest first: if a mailbox ever got two accounts, the original one is the one that signs in.
    const user = await this.userModel
      .findOne(emailQuery(dto.email))
      .sort({ createdAt: 1 })
      .select('+password +loginAttempts +lockUntil +refreshToken');

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // A Google-only account has no password to compare — say so rather than count a "wrong" one.
    if (!user.password) {
      throw new UnauthorizedException(
        'This account signs in with Google. Use "Continue with Google" — you can set a password from My Account afterwards.',
      );
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Account locked due to too many failed login attempts. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}`,
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
        // Someone guessing a password — worth knowing, once per account per lock.
        this.discord.sendOnce(`lock:${user._id}`, 15, {
          title: '🔒 Account locked — 5 wrong passwords',
          description: `${user.email} cannot sign in for 15 minutes.`,
          url: `/dashboard/users?q=${encodeURIComponent(user.email)}`,
          color: DISCORD_COLORS.security,
          category: 'Security',
          who: [{ label: '👤 Account', id: user._id }],
        });
        throw new UnauthorizedException(
          'Account locked due to too many failed login attempts. Please try again in 15 minutes.',
        );
      }

      await user.save();
      const attemptsLeft = 5 - user.loginAttempts;
      throw new UnauthorizedException(
        `Invalid credentials. ${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} remaining before account lockout.`,
      );
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0 || user.lockUntil) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
    }

    if (user.isActive === false) {
      // An agency's agent switched off by the agency owner — not an account waiting for approval.
      throw new ForbiddenException(
        user.agencyId
          ? 'Your agency has paused this account. Please contact your agency owner.'
          : 'Account is pending activation',
      );
    }

    // generate access token and refresh token
    const accessToken = this.generateToken(user);
    const refreshPayload = { sub: user._id.toString() };
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
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
    // The account already linked to this Google login; otherwise the one with
    // this mailbox (dots and +tags ignored), the original first.
    let user: UserDocument | null =
      (await this.userModel
        .findOne({ googleId: profile.googleId })
        .select('+refreshToken')) ??
      (await this.userModel
        .findOne(emailQuery(profile.email))
        .sort({ createdAt: 1 })
        // Written back by issueSession below; selected so the document is not
        // saving a field it never loaded.
        .select('+refreshToken'));

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
        url: `/dashboard/users?q=${encodeURIComponent(profile.email)}`,
        color: DISCORD_COLORS.account,
        category: 'Accounts',
        fields: [{ name: 'Signed up with', value: 'Continue with Google' }],
        who: [{ label: '👤 Who', id: user._id }],
      });
    } else if (!user.googleId) {
      // Existing password account using the button for the first time.
      user.googleId = profile.googleId;
      if (!user.name && profile.name) user.name = profile.name;
      if (!user.avatarUrl && profile.picture) user.avatarUrl = profile.picture;
      await user.save();
    }

    if (user.isActive === false) {
      throw new ForbiddenException(
        user.agencyId
          ? 'Your agency has paused this account. Please contact your agency owner.'
          : 'Account is pending activation',
      );
    }

    return this.issueSession(user, 'Login successful');
  }

  /** How this account signs in — for the "Login & password" card in My Account. */
  async passwordStatus(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('+password googleId email provider')
      .lean();
    if (!user) throw new UnauthorizedException('Account not found');
    return {
      email: user.email,
      hasPassword: !!user.password,
      google: !!user.googleId,
    };
  }

  /**
   * Sets or changes the account's password.
   *
   * A Google account has none, so it sets one without a current password —
   * afterwards both "Continue with Google" and email + password open the same
   * account. An account that has a password must give the current one.
   */
  async setPassword(
    userId: string,
    body: { currentPassword?: string; newPassword?: string },
  ) {
    const next = String(body?.newPassword ?? '');
    if (next.length < 6)
      throw new BadRequestException(
        'Use at least 6 characters for your password',
      );
    if (next.length > 128)
      throw new BadRequestException('That password is too long');
    const user = await this.userModel
      .findById(userId)
      .select('+password +loginAttempts +lockUntil');
    if (!user) throw new UnauthorizedException('Account not found');
    if (user.password) {
      if (
        !body?.currentPassword ||
        !(await user.comparePassword(body.currentPassword))
      ) {
        throw new BadRequestException('Your current password is not right');
      }
    }
    const had = !!user.password;
    user.password = next; // hashed by the schema's pre-save hook
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
    return {
      ok: true,
      hasPassword: true,
      message: had
        ? 'Password changed'
        : 'Password set — you can now sign in with your email and password too',
    };
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
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!refreshSecret) {
      throw new Error('⚠️ SECURITY: JWT_REFRESH_SECRET must be set');
    }
    const refreshToken = this.jwtService.sign({ sub: user._id.toString() }, {
      secret: refreshSecret,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    } as any);

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
      });

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
      });
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
