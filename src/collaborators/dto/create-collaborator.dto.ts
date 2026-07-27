import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCollaboratorDto {
  @ApiProperty({ maxLength: 150, example: 'Ana Silva' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ maxLength: 255, example: 'ana.silva@empresa.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;
}
