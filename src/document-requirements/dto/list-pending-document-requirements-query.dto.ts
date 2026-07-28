import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { DocumentRequirementListStatus } from './document-requirement-list-status.enum';

export class ListPendingDocumentRequirementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: DocumentRequirementListStatus,
    default: DocumentRequirementListStatus.Active,
    description:
      'Filtra requisitos por status: active (padrão), deleted ou all. Pendência = sem versão ativa.',
  })
  @IsOptional()
  @IsEnum(DocumentRequirementListStatus)
  status?: DocumentRequirementListStatus = DocumentRequirementListStatus.Active;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filtra pendências do colaborador informado.',
  })
  @IsOptional()
  @IsUUID()
  collaboratorId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filtra pendências do tipo de documento informado.',
  })
  @IsOptional()
  @IsUUID()
  documentTypeId?: string;

  @ApiPropertyOptional({
    description: 'Filtro parcial pelo nome do colaborador (ILIKE).',
    example: 'Deyvid',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({
    description: 'Inclui requisitos criados a partir desta data (inclusive).',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdAfter?: Date;

  @ApiPropertyOptional({
    description: 'Inclui requisitos criados até esta data (inclusive).',
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdBefore?: Date;
}
