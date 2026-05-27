import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RoomStateService } from './room-state.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule],
  providers: [RoomStateService],
  exports: [RoomStateService], 
})
export class EventsModule {}