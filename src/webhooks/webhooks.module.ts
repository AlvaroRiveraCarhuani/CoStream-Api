import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { RoomsModule } from '../rooms/rooms.module'; 

@Module({
  imports: [PrismaModule, EventsModule, RoomsModule], 
  controllers: [WebhooksController],
})
export class WebhooksModule {}