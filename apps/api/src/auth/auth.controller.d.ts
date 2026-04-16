import { AuthService } from './auth.service';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    test(): Promise<{
        message: string;
    }>;
    register(dto: RegisterDto): Promise<void>;
    login(dto: LoginDto): Promise<void>;
    refresh(oldRefreshToken: string): Promise<void>;
    logout(oldRefreshToken: string): Promise<void>;
}
//# sourceMappingURL=auth.controller.d.ts.map