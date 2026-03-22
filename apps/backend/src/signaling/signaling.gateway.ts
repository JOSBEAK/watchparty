import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SignalingEvents } from '../shared/events';
import type { SignalPayload } from '../shared/events';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SignalingGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SignalingGateway.name);

  /**
   * Relay WebRTC signaling data (offer / answer / ICE candidate)
   * from one peer to another. The server never inspects the signal —
   * it just forwards it to the target socket.
   */
  @SubscribeMessage(SignalingEvents.SIGNAL)
  handleSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SignalPayload,
  ): void {
    this.logger.debug(
      `Relaying signal from ${client.id} to ${payload.to}`,
    );

    this.server.to(payload.to).emit(SignalingEvents.SIGNAL, {
      from: client.id,
      signal: payload.signal,
    });
  }
}
