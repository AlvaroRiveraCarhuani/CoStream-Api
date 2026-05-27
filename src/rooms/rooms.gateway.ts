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

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['my-custom-header'],
  },
  transports: ['websocket'], // Forzar solo WebSocket, sin polling
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  // 1. INTERCEPTOR DE CONEXIÓN
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
      console.log(`✅ Socket conectado: ${payload.email} (ID: ${client.id})`);
    } catch (error) {
      console.error(`❌ Conexión Socket rechazada: ${error.message}`);
      client.disconnect(true);
    }
  }

  // 2. MANEJADOR DE DESCONEXIÓN
  handleDisconnect(client: Socket) {
    console.log(`❌ Socket desconectado (ID: ${client.id})`);
    // Opcional: emitir evento de salida a la sala
  }

  // 3. UNIRSE A SALA
  @SubscribeMessage('room:join')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    if (!client.data.user) return;

    client.join(payload.roomId);

    this.server.to(payload.roomId).emit('room:participant_joined', {
      user: {
        id: client.data.user.sub,
        email: client.data.user.email,
        displayName: client.data.user.email.split('@')[0],
      },
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });

    console.log(`🚪 Socket ${client.id} se unió a la sala: ${payload.roomId}`);
  }

  // 4. MOTOR DE CHAT
  @SubscribeMessage('chat:send')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    console.log(`⚡ LLEGÓ UN MENSAJE DEL FRONTEND:`, payload);

    try {
      const user = client.data.user;

      const message = {
        id: Date.now().toString(),
        senderId: user.sub,
        senderName: user.email.split('@')[0],
        avatar: user.avatar,
        text: payload.text,
        type: payload.type || 'text',
        timestamp: new Date().toISOString(),
      };

      this.server.to(payload.roomId).emit('chat:broadcast', message);
      console.log(`✅ MENSAJE REPARTIDO A LA SALA ${payload.roomId}`);
    } catch (error) {
      console.error('❌ Error fatal al procesar el mensaje:', error);
    }
  }

  // 5. GRITO DE MUERTE (Cierre de sala)
  @SubscribeMessage('room:end_broadcast')
  handleEndRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    // Verificar que el cliente que envía el evento sea el host
    if (!client.data.user) return;

    // Emitir a todos los participantes de la sala que deben salir
    this.server.to(payload.roomId).emit('room:kicked');
    console.log(`🛑 Sala ${payload.roomId} destruida por el anfitrión.`);
  }
}