import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { extractAndCleanJwt } from '../auth/utils/cookie.util';
import { PrismaService } from '../prisma/prisma.service';
import { RoomServiceClient } from 'livekit-server-sdk';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:4200',
      'https://co-stream-web-nine.vercel.app',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'],
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private roomServiceClient: RoomServiceClient;
  private participantsMap = new Map<string, { socketId: string; userId: string; livekitIdentity: string }>();

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {
    const livekitUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!livekitUrl || !apiKey || !apiSecret) {
      throw new Error('Faltan variables de entorno de LiveKit');
    }

    this.roomServiceClient = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
  }

  async handleConnection(client: Socket) {
    try {

      let token: string | null = client.handshake.auth?.token ?? null;


      if (!token) {
        const cookieHeader = client.handshake.headers.cookie;
        if (!cookieHeader) throw new Error('No hay token ni cookies');
        token = extractAndCleanJwt(cookieHeader);
        if (!token) throw new Error('Token no encontrado en cookies');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'super_secret_costream_key_2026',
      });
      client.data.user = payload;
    } catch (error) {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const user = client.data.user;
    const roomId = client.data.roomId;
    if (user && roomId) {
      this.server.to(roomId).emit('room:user_left', { userId: user.sub });
      this.participantsMap.delete(user.sub);
    }
  }

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    if (!client.data.user) return;
    const userId = client.data.user.sub;
    const roomId = payload.roomId;

    client.data.roomId = roomId;
    client.join(roomId);

    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { hostId: true }
    });

    const isHost = room?.hostId === userId;
    const role = isHost ? 'HOST' : 'PRESENTER'; 
    const livekitIdentity = userId;

    client.data.livekitIdentity = livekitIdentity;
    this.participantsMap.set(userId, {
      socketId: client.id,
      userId: userId,
      livekitIdentity: livekitIdentity,
    });


    this.server.to(roomId).emit('room:participant_joined', {
      user: {
        id: userId,
        email: client.data.user.email,
        displayName: client.data.user.email.split('@')[0],
        role: role,
      },
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });

    const socketsInRoom = await this.server.in(roomId).fetchSockets();
    const participants = await Promise.all(socketsInRoom.map(async (socket) => {
      const userData = socket.data.user;
      if (!userData) return null;
      const participantRoom = await this.prisma.room.findUnique({ where: { id: roomId }, select: { hostId: true } });
      const isParticipantHost = participantRoom?.hostId === userData.sub;
      return {
        user: {
          id: userData.sub,
          email: userData.email,
          displayName: userData.email.split('@')[0],
          role: isParticipantHost ? 'HOST' : 'PRESENTER',
        },
        socketId: socket.id,
      };
    }));
    client.emit('room:current_participants', participants.filter(p => p !== null));
  }

  @SubscribeMessage('chat:send')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; text: string; type?: string },
  ) {
    const user = client.data.user;
    if (!user || !payload.roomId) return;

    const savedMessage = await this.prisma.message.create({
      data: {
        roomId: payload.roomId,
        senderName: user.email.split('@')[0],
        content: payload.text,
      },
    });

    const messageToSend = {
      id: savedMessage.id,
      senderId: user.sub,
      senderName: savedMessage.senderName,
      text: savedMessage.content,
      type: payload.type || 'text',
      timestamp: savedMessage.sentAt.toISOString(),
    };

    this.server.to(payload.roomId).emit('chat:broadcast', messageToSend);
  }

  @SubscribeMessage('room:end_broadcast')
  async handleEndRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    if (!client.data.user) return;
    this.server.to(payload.roomId).emit('room:kicked');
  }

  @SubscribeMessage('room:leave')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    if (!client.data.user) return;
    client.leave(payload.roomId);
    this.server.to(payload.roomId).emit('room:user_left', { userId: client.data.user.sub });
    client.emit('room:left', { success: true });
  }


  @SubscribeMessage('mod:set_microphone')
  async handleModMicrophone(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetUserId: string; enabled: boolean },
  ) {
    const host = client.data.user;
    if (!host) return;
    
    const room = await this.prisma.room.findFirst({ where: { id: data.roomId, hostId: host.sub, isActive: true } });
    if (!room) {
      return;
    }

    const target = this.participantsMap.get(data.targetUserId);
    if (target) {
      this.server.to(target.socketId).emit('force_microphone', { enabled: data.enabled });
    } else {
    }
  }

  @SubscribeMessage('mod:set_camera')
  async handleModCamera(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetUserId: string; enabled: boolean },
  ) {
    const host = client.data.user;
    if (!host) return;
    
    const room = await this.prisma.room.findFirst({ where: { id: data.roomId, hostId: host.sub, isActive: true } });
    if (!room) return;

    const target = this.participantsMap.get(data.targetUserId);
    if (target) {
      this.server.to(target.socketId).emit('force_camera', { enabled: data.enabled });
    }
  }

  @SubscribeMessage('mod:kick')
  async handleModKick(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetUserId: string },
  ) {
    const host = client.data.user;
    if (!host) return;
    
    const room = await this.prisma.room.findFirst({ where: { id: data.roomId, hostId: host.sub, isActive: true } });
    if (!room) return;

    const target = this.participantsMap.get(data.targetUserId);
    if (target) {
      try {
        await this.roomServiceClient.removeParticipant(room.id, target.livekitIdentity);
      } catch (err) {
      }
      this.server.to(target.socketId).emit('room:kicked');
      const targetSocket = this.server.sockets.sockets.get(target.socketId);
      if (targetSocket) targetSocket.leave(room.id);
      this.participantsMap.delete(data.targetUserId);
    }
  }
}