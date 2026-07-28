import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { DocumentRequirementListStatus } from './document-requirement-list-status.enum';

export class ListDocumentRequirementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: DocumentRequirementListStatus,
    default: DocumentRequirementListStatus.Active,
    description:
      'Filtra por status: active (padrão), deleted (somente removidos) ou all (todos).',
  })
  @IsOptional()
  @IsEnum(DocumentRequirementListStatus)
  status?: DocumentRequirementListStatus = DocumentRequirementListStatus.Active;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filtra requisitos do colaborador informado.',
  })
  @IsOptional()
  @IsUUID()
  collaboratorId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filtra requisitos do tipo de documento informado.',
  })
  @IsOptional()
  @IsUUID()
  documentTypeId?: string;
}
