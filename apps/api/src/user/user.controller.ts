import {
  Controller,
  Get,
  Patch,
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

    // An empty body would otherwise issue a pointless write.
    if (dto.name === undefined && dto.phone === undefined) {
      throw new BadRequestException('Nothing to update');
    }

    const patch: { name?: string; phone?: string } = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.phone !== undefined) patch.phone = dto.phone.trim();

    return this.userService.update(userId, patch);
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
