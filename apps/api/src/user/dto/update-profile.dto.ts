import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * The only fields a user may change on their own account.
 *
 * Deliberately does NOT include `role`, `isActive`, `email` or `password`.
 * With the global ValidationPipe running `whitelist: true`, anything else in
 * the body is stripped before it reaches the service — so this DTO is what
 * stops `PATCH /users/me` from becoming a privilege-escalation route.
 *
 * Everything here is public: it is what an agent's profile page shows and what
 * a buyer reads before calling. Nothing private is editable through it.
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

  @IsOptional()
  @IsString()
  @Length(0, 32)
  @Matches(/^[\d+\-() ]*$/, {
    message: 'WhatsApp number may only contain digits, spaces and + - ( )',
  })
  whatsappNumber?: string;

  /** Agency / office name, shown as the profile's heading when set. */
  @IsOptional()
  @IsString()
  @Length(0, 160)
  companyName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  bio?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(70)
  experienceYears?: number;

  /** Office address, e.g. "Main Boulevard, DHA Phase 6, Lahore". */
  @IsOptional()
  @IsString()
  @Length(0, 240)
  address?: string;

  /**
   * A URL from the media library, not an upload: the image has already been
   * converted and stored by the time it gets here.
   */
  @IsOptional()
  @IsString()
  @Length(0, 500)
  avatarUrl?: string;
}
