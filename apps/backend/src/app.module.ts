import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { RoomsModule } from './rooms/rooms.module';
import { SyncModule } from './sync/sync.module';
import { SignalingModule } from './signaling/signaling.module';
import { VideoModule } from './video/video.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RoomsModule,
    SyncModule,
    SignalingModule,
    VideoModule,
  ],
})
export class AppModule {}
