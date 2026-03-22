import { Module } from '@nestjs/common';
import { SyncGateway } from './sync.gateway';
import { SyncService } from './sync.service';
import { RoomsModule } from '../rooms/rooms.module';
import { VideoModule } from '../video/video.module';

@Module({
  imports: [RoomsModule, VideoModule],
  providers: [SyncGateway, SyncService],
  exports: [SyncService],
})
export class SyncModule {}
