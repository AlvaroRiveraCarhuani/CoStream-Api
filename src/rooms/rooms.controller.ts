import { Controller, Get, Post, Body, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('public')
  async getPublicRooms() {
    return this.roomsService.getPublicRooms();
  }

  @HttpCode(HttpStatus.OK)
  @Post('join')
  async joinRoom(@Body() body: JoinRoomDto) {
    return this.roomsService.joinRoom(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createRoom(@Request() req, @Body() body: CreateRoomDto) {
    const hostId = req.user.sub; 
    return this.roomsService.createRoom(hostId, body);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post(':id/end')
  async endRoom(@Request() req, @Param('id') roomId: string) {
    const hostId = req.user.sub;
    return this.roomsService.endRoom(roomId, hostId);
  }
  @Get(':id/messages')
  async getRoomMessages(@Param('id') roomId: string) {
    return this.roomsService.getRoomMessages(roomId);
  }
}