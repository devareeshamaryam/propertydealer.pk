import { IsEmail, IsNotEmpty, MinLength , IsEnum, IsString } from "class-validator";

export class RegisterDto{
    @IsNotEmpty()
    @IsString()
    name!: string;

    @IsEmail()
    email!: string;

    @IsNotEmpty()
    @MinLength(8)
    password!: string;

    @IsEnum(['USER' ,'AGENT'])
    role?: string;

}