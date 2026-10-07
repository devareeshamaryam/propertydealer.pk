import { IsEmail, IsNotEmpty, MinLength, IsEnum, IsString } from "class-validator";

export class RegisterDto{
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsEmail()
    email: string;

    /**
     * A length floor, and nothing more.
     *
     * This used to demand 8 characters AND an uppercase AND a lowercase AND a
     * digit AND one of @$!%*?& — while the sign-up form said "at least 6" and
     * offered no way to see what you had typed. The result was people being
     * rejected repeatedly with a rule they could not read back.
     *
     * Composition rules of this kind push people towards "Password1!" and
     * towards reusing a password they already have elsewhere, which is worse
     * for the account than a long passphrase with no symbol in it. Length is
     * the part that actually matters, and the real protections are elsewhere:
     * bcrypt hashing, the account lockout in AuthService.login, and the rate
     * limiter on this endpoint.
     */
    @IsNotEmpty()
    @MinLength(6, { message: 'Use at least 6 characters for your password' })
    password: string;

    @IsEnum(['USER' ,'AGENT'])
    role?: string;

}