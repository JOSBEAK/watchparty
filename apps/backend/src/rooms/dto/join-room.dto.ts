import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  roomCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  displayName: string;
}
