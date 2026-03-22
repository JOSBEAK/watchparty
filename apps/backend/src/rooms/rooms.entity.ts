import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 6 })
  code: string;

  @Column({ name: 'host_socket_id', nullable: true })
  hostSocketId: string;

  @Column({ name: 'video_key', nullable: true })
  videoKey: string;

  @Column({ name: 'video_filename', nullable: true })
  videoFilename: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
