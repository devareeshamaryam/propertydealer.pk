import { IsEmail, IsNotEmpty, MinLength, IsString } from "class-validator";

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

    /*
     * No role here on purpose.
     *
     * Sign-up used to ask "are you buying or selling?" and send USER or AGENT.
     * It is one question too many: a buyer who finds nothing and decides to
     * sell their own flat had to be upgraded mid-flow, and the answer told us
     * nothing we could not learn from what they did next. AuthService.register
     * sets AGENT for everyone; ADMIN is never self-assigned.
     */

}