import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

interface AuthedRequest {
  user?: { userId?: string; role?: string };
}

/**
 * Note the guard split.
 *
 * `/users/me` needs authentication only — it is how an agent maintains their
 * own contact details. Everything else stays behind AdminGuard. Previously the
 * whole controller was admin-only, so a non-admin had no way to change their
 * own name or phone number at all and the dashboard's account page could only
 * show those fields read-only.
 *
 * The `me` routes are declared before `:id` so Nest does not match "me" as an
 * id and send it through the admin-only handlers.
 */
@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@Req() req: AuthedRequest) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Authentication required');
    return this.userService.findOne(userId);
  }

  @Patch('me')
  async updateMe(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Authentication required');

    // Trim the text fields; the DTO has already rejected anything else.
    const patch: Record<string, string | number> = {};
    const text: (keyof UpdateProfileDto)[] = [
      'name',
      'phone',
      'whatsappNumber',
      'companyName',
      'bio',
      'address',
      'avatarUrl',
    ];

    for (const field of text) {
      const value = dto[field];
      if (typeof value === 'string') patch[field] = value.trim();
    }

    if (dto.experienceYears !== undefined) {
      patch.experienceYears = dto.experienceYears;
    }

    // An empty body would otherwise issue a pointless write.
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    return this.userService.update(userId, patch);
  }

  /**
   * POST /users/me/become-agent — "I want to list a property".
   *
   * The account type follows what someone is trying to do, not what they
   * ticked at sign-up: everyone starts as USER (including the people who only
   * wanted to see a phone number), and opening the listing form is the moment
   * that changes. No application, no admin step — the same way OLX and Zameen
   * turn a browser into a seller.
   *
   * Idempotent, and it can never touch an ADMIN. The caller refreshes its
   * token afterwards, because the role lives in the JWT.
   */
  @Post('me/become-agent')
  async becomeAgent(@Req() req: AuthedRequest) {
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Authentication required');

    await this.userService.promoteToAgent(userId);
    return { success: true, role: 'AGENT' };
  }

  @Get('stats')
  @UseGuards(AdminGuard)
  async stats() {
    return this.userService.getStats();
  }

  @Get()
  @UseGuards(AdminGuard)
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id') id: string,
    @Body()
    updateData: {
      role?: string;
      isActive?: boolean;
      name?: string;
      phone?: string;
    },
    @Req() req: AuthedRequest,
  ) {
    // An admin editing themselves here could remove their own admin role or
    // deactivate their own account and be locked out mid-session. Self-service
    // changes belong on /users/me, which cannot touch role or isActive.
    if (id === req.user?.userId) {
      throw new BadRequestException(
        'Use /users/me to change your own profile; role and status cannot be self-edited.',
      );
    }
    return this.userService.update(id, updateData);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    if (id === req.user?.userId) {
      throw new BadRequestException('You cannot delete your own account.');
    }
    return this.userService.remove(id);
  }
}
