import { Controller, Post, Req, Headers, UnauthorizedException, Logger, HttpCode } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WebhookReceiver } from 'livekit-server-sdk';
import { RoomStateService } from '../events/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomsGateway } from '../rooms/rooms.gateway';

@Controller('webhooks')
export class WebhooksController {
  private receiver: WebhookReceiver;
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private prisma: PrismaService,
    private roomStateService: RoomStateService,
    private roomsGateway: RoomsGateway
  ) {
    this.receiver = new WebhookReceiver(
      process.env.LIVEKIT_API_KEY || '',
      process.env.LIVEKIT_API_SECRET || ''
    );
  }

  @Post('livekit')
  @HttpCode(200)
  async handleLiveKitWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('Authorization') authHeader: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Falta la cabecera de autorización');
    }

    try {
      const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
      const event = await this.receiver.receive(rawBody, authHeader);
      
      this.logger.log(`Evento de LiveKit recibido: ${event.event}`);

      const roomId = event.room?.name;
      if (!roomId) return { received: true };

      if (event.event === 'participant_left') {
        const userId = event.participant?.identity;
        if (userId) {
          this.roomStateService.removeParticipant(roomId, userId);
          this.roomsGateway.server.to(roomId).emit('room:state_changed', {
            roomId,
            participants: this.roomStateService.getRoomState(roomId),
          });
        }
      }

      if (event.event === 'room_finished') {
        await this.prisma.room.update({
          where: { id: roomId },
          data: { 
            isActive: false, 
            endedAt: new Date() 
          },
        });

        this.roomStateService.getRoomState(roomId).forEach(participant => {
          this.roomStateService.removeParticipant(roomId, participant.userId);
        });

        this.roomsGateway.server.to(roomId).emit('room:state_changed', {
          roomId,
          participants: [],
        });
        
        this.logger.log(`Sala ${roomId} finalizada y persistida correctamente.`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`Fallo en el Webhook: ${(error as Error).message}`);
      throw new UnauthorizedException('Firma criptográfica inválida');
    }
  }
}