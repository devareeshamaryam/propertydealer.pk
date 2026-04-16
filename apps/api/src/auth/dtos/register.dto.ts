import { IsEmail, IsNotEmpty, MinLength , IsEnum, IsString, Matches } from "class-validator";

export class RegisterDto{
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsEmail()
    email: string;

    // 🔒 SECURITY: Strong password policy (HIGH PRIORITY)
    @IsNotEmpty()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        {
            message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
        }
    )
    password: string;

    @IsEnum(['USER' ,'AGENT'])
    role?: string;

}