import { IsString, IsBoolean, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty({ message: 'El título de la sala es obligatorio.' })
  title: string;

  @IsBoolean()
  isPublic: boolean;

  @IsBoolean()
  requiresPin: boolean;

  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'El PIN debe tener al menos 4 caracteres.' })
  pin?: string;
}