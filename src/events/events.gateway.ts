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


  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) throw new Error('Token missing');


      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.LIVEKIT_API_SECRET,
      });


      const userId = payload.sub; 
      const name = payload.name;
      const roomId = payload.video?.room;
      const isHost = payload.video?.roomCreate === true || payload.name === 'Host'; 
      
      const role = isHost ? 'HOST' : 'VIEWER';


      client.data = { userId, roomId, name, role };
      
      client.join(roomId);


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


  handleDisconnect(client: Socket) {
    const { roomId, userId } = client.data || {};
    if (roomId && userId) {
      this.roomStateService.removeParticipant(roomId, userId);
      this.broadcastRoomState(roomId);
    }
  }


  private broadcastRoomState(roomId: string) {
    const state = {
      roomId,
      participants: this.roomStateService.getRoomState(roomId),
    };
    this.server.to(roomId).emit('room:state_changed', state);
  }


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


    const chatMessage = {
      id: savedMessage.id,
      senderName: savedMessage.senderName,
      role: role,
      content: savedMessage.content,
      timestamp: savedMessage.sentAt,
    };


    this.server.to(payload.roomId).emit('chat:broadcast', chatMessage);
  }


  @SubscribeMessage('stage:update')
  handleStageUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; targetUserId: string; action: string }
  ) {
    const { role: emitterRole } = client.data;


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