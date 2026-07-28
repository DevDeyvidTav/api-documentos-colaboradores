import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentRequirementCollaboratorDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Deyvid Tavares' })
  name: string;

  @ApiProperty({ example: 'deyvid@email.com' })
  email: string;
}

export class DocumentRequirementDocumentTypeDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'CPF' })
  name: string;

  @ApiPropertyOptional({
    description: 'Descrição opcional do tipo de documento.',
    nullable: true,
    example: 'Cadastro de Pessoa Física',
  })
  description?: string | null;
}

export class DocumentRequirementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: DocumentRequirementCollaboratorDto })
  collaborator: DocumentRequirementCollaboratorDto;

  @ApiProperty({ type: DocumentRequirementDocumentTypeDto })
  documentType: DocumentRequirementDocumentTypeDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Preenchido quando o requisito foi soft-deleted.',
    nullable: true,
  })
  deletedAt?: Date | null;
}
