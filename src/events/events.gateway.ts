import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RoomStateService } from './room-state.service';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private roomStateService: RoomStateService,
    private prisma: PrismaService,
  ) {}

  // FASE 1: Seguridad de Conexión
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) throw new Error('Token missing');

      // Verificamos el token firmado por LiveKit (El SDK usa la Secret Key para firmar)
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.LIVEKIT_API_SECRET,
      });

      // Extraemos datos del JWT de LiveKit
      const userId = payload.sub; 
      const name = payload.name;
      const roomId = payload.video?.room;
      const isHost = payload.video?.roomCreate === true || payload.name === 'Host'; 
      
      const role = isHost ? 'HOST' : 'VIEWER';

      // Almacenamos el userId y roomId en el objeto socket para fácil acceso
      client.data = { userId, roomId, name, role };
      
      client.join(roomId);

      // FASE 3: Actualizar motor de estado en memoria
      this.roomStateService.addParticipant(roomId, {
        userId,
        name,
        role,
        isOnStage: role === 'HOST', 
      });

      this.broadcastRoomState(roomId);
    } catch (error) {
      client.disconnect(true); 
    }
  }

  // FASE 4: Garbage Collection
  handleDisconnect(client: Socket) {
    const { roomId, userId } = client.data || {};
    if (roomId && userId) {
      this.roomStateService.removeParticipant(roomId, userId);
      this.broadcastRoomState(roomId);
    }
  }

  // Retransmite el estado exacto de la sala
  private broadcastRoomState(roomId: string) {
    const state = {
      roomId,
      participants: this.roomStateService.getRoomState(roomId),
    };
    this.server.to(roomId).emit('room:state_changed', state);
  }

  // FASE 2: Mensajería y Persistencia
  @SubscribeMessage('chat:send')
  async handleChatSend(@ConnectedSocket() client: Socket, @MessageBody() payload: { roomId: string; text: string }) {
    const { name, role } = client.data;

    const savedMessage = await this.prisma.message.create({
      data: {
        roomId: payload.roomId,
        senderName: name,
        content: payload.text,
      },
    });

    // 2. Construir contrato de salida
    const chatMessage = {
      id: savedMessage.id,
      senderName: savedMessage.senderName,
      role: role,
      content: savedMessage.content,
      timestamp: savedMessage.sentAt,
    };

    // 3. Emitir a todos en la sala (incluyendo al emisor)
    this.server.to(payload.roomId).emit('chat:broadcast', chatMessage);
  }

  // FASE 3: Gestión de Escenario
  @SubscribeMessage('stage:update')
  handleStageUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; targetUserId: string; action: string }
  ) {
    const { role: emitterRole } = client.data;

    // Solo el Host puede mutar el escenario
    if (emitterRole !== 'HOST') return;

    switch (payload.action) {
      case 'PROMOTE_TO_PRESENTER':
        this.roomStateService.updateParticipantStage(payload.roomId, payload.targetUserId, false, 'PRESENTER');
        break;
      case 'DEMOTE_TO_VIEWER':
        this.roomStateService.updateParticipantStage(payload.roomId, payload.targetUserId, false, 'VIEWER');
        break;
      case 'MOVE_TO_STAGE':
        this.roomStateService.updateParticipantStage(payload.roomId, payload.targetUserId, true);
        break;
      case 'REMOVE_FROM_STAGE':
        this.roomStateService.updateParticipantStage(payload.roomId, payload.targetUserId, false);
        break;
      case 'KICK_USER':
        break;
    }

    this.broadcastRoomState(payload.roomId);
  }
}