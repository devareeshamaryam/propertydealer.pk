import { IsEmail, IsNotEmpty, MinLength , IsEnum, IsString } from "class-validator";

export class RegisterDto{
    @IsNotEmpty()
    @IsString()
    name!: string;

    @IsEmail()
    email!: string;

    /**
     * Six characters, and nothing else asked of it.
     *
     * The form has always said "at least 6" while this said 8, so a 6 or 7
     * character password passed the browser and was then rejected by the API
     * with a message nobody saw. Six is the floor both sides now agree on.
     */
    @IsNotEmpty()
    @MinLength(6, { message: 'Use at least 6 characters for your password' })
    password!: string;

    @IsEnum(['USER' ,'AGENT'])
    role?: string;

}