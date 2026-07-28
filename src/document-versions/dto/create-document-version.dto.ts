import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDocumentVersionDto {
  @ApiProperty({
    maxLength: 500,
    example: 'documents/collaborator-123/cpf-v1.pdf',
    description: 'Referência lógica ao documento (sem upload físico).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  documentReference: string;
}
