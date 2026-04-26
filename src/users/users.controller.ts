import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.usersService.createHost(body.email, body.password, body.displayName);
  }
}