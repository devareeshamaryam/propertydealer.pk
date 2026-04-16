import { RegisterDto } from './dtos/register.dto';
import { Model } from 'mongoose';
import { UserDocument } from '../../../../packages/db/src/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dtos/login.dto';
export declare class AuthService {
    private userModel;
    private jwtService;
    constructor(userModel: Model<UserDocument>, jwtService: JwtService);
    register(dto: RegisterDto): Promise<void>;
    login(dto: LoginDto): Promise<void>;
    private generateToken;
    refreshToken(oldRefreshToken: string): Promise<void>;
}
//# sourceMappingURL=auth.service.d.ts.map