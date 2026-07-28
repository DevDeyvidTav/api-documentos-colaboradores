import { ApiProperty } from '@nestjs/swagger';

export class PendingDocumentRequirementCollaboratorDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Deyvid Tavares' })
  name: string;

  @ApiProperty({ example: 'deyvid@email.com' })
  email: string;
}

export class PendingDocumentRequirementDocumentTypeDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'CPF' })
  name: string;
}

export class PendingDocumentRequirementResponseDto {
  @ApiProperty({ format: 'uuid' })
  requirementId: string;

  @ApiProperty({ type: PendingDocumentRequirementCollaboratorDto })
  collaborator: PendingDocumentRequirementCollaboratorDto;

  @ApiProperty({ type: PendingDocumentRequirementDocumentTypeDto })
  documentType: PendingDocumentRequirementDocumentTypeDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PendingDocumentRequirementsPaginatedResponseDto {
  @ApiProperty({ type: [PendingDocumentRequirementResponseDto] })
  items: PendingDocumentRequirementResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({
    example: 3,
    description: 'Total de páginas (`ceil(total / limit)`).',
  })
  totalPages: number;
}
