// src/rooms/rooms.gateway.ts

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

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['my-custom-header'],
  },
  transports: ['websocket'],
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const cookieHeader = client.handshake.headers.cookie;
      if (!cookieHeader) throw new Error('No hay cookies en el handshake');

      const token = extractAndCleanJwt(cookieHeader);
      if (!token) throw new Error('Token no encontrado o inválido');

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

  // Guardar roomId en el socket
  client.data.roomId = roomId;
  client.join(roomId);

  // Obtener la sala para saber quién es el host
  const room = await this.prisma.room.findUnique({
    where: { id: roomId },
    select: { hostId: true }
  });

  const isHost = room?.hostId === userId;
  const role = isHost ? 'HOST' : 'VIEWER';

  // 1. Emitir a los demás que un nuevo participante se ha unido
  this.server.to(roomId).emit('room:participant_joined', {
    user: {
      id: userId,
      email: client.data.user.email,
      displayName: client.data.user.email.split('@')[0],
      role: role,        // ✅ ahora enviamos el rol real
    },
    socketId: client.id,
    timestamp: new Date().toISOString(),
  });

  // 2. Enviar al recién llegado la lista de participantes actuales (para sincronizar)
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
        role: isParticipantHost ? 'HOST' : 'VIEWER',
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
}