import { Controller, Get, Header, Param } from '@nestjs/common';
import { UserService } from './user.service';

/**
 * The public side of an account: /api/agents/:id.
 *
 * A separate controller on purpose — UserController carries a class-level JWT
 * guard (correctly: it is the admin's user management), and a class-level guard
 * cannot be opted out of per route. Putting the one public read here keeps that
 * controller closed by default rather than poking a hole in it.
 */
@Controller('agents')
export class PublicProfileController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  // A profile changes rarely; let the CDN and the browser hold it briefly.
  @Header('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400')
  async profile(@Param('id') id: string) {
    return this.userService.findPublicProfile(id);
  }
}
