import { ApiProperty } from '@nestjs/swagger';

export class DocumentVersionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ format: 'uuid' })
  requirementId: string;

  @ApiProperty({ example: 1 })
  versionNumber: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 'documents/collaborator-123/cpf-v1.pdf' })
  documentReference: string;

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty()
  createdAt: Date;
}
