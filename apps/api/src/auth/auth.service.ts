import {
  BadGatewayException,
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
  ) {}
  async register(dto: RegisterDto): Promise<TokenResponse> {
    const existingUser = await this.userModel.findOne({ email: dto.email });
    if (existingUser) throw new BadGatewayException('User already exists');
    const user = new this.userModel(dto);
    await user.save();

    const token = this.generateToken(user);
    return {
      token,
      user: {
        _id: user._id.toString(),
        name: user.name || '',
        email: user.email,
        role: user.role || 'user',
        isActive: user.isActive,
      },
      status: 201,
      message: 'Registered successfully',
    };
  }

  // 🔒 SECURITY: Login with account lockout protection (HIGH PRIORITY)
  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.userModel
      .findOne({ email: dto.email })
      .select('+password +loginAttempts +lockUntil');

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
      const user = await this.userModel.findById(payload.sub);
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
      const user = await this.userModel.findById(payload.sub);
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
