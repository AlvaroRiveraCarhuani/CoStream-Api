import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class JoinRoomDto {
  @IsUUID('4', { message: 'El ID de la sala debe ser un UUID válido.' })
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre a mostrar es obligatorio.' })
  displayName: string;

  @IsOptional()
  @IsString()
  pin?: string;
}