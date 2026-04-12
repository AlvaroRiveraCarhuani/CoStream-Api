import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'El formato del correo electrónico no es válido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  @MaxLength(50, { message: 'La contraseña es demasiado larga.' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre a mostrar es obligatorio.' })
  @MaxLength(100)
  displayName: string;
}