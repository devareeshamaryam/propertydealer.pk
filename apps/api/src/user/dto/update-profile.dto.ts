import { IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * The only fields a user may change on their own account.
 *
 * Deliberately does NOT include `role`, `isActive`, `email` or `password`.
 * With the global ValidationPipe running `whitelist: true`, anything else in
 * the body is stripped before it reaches the service — so this DTO is what
 * stops `PATCH /users/me` from becoming a privilege-escalation route.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 120, { message: 'Name must be between 1 and 120 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 32)
  @Matches(/^[\d+\-() ]*$/, {
    message: 'Phone number may only contain digits, spaces and + - ( )',
  })
  phone?: string;
}
