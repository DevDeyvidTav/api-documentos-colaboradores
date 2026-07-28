import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { DocumentTypeListStatus } from './document-type-list-status.enum';

export class ListDocumentTypesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: DocumentTypeListStatus,
    default: DocumentTypeListStatus.Active,
    description:
      'Filtra por status: active (padrão), deleted (somente removidos) ou all (todos).',
  })
  @IsOptional()
  @IsEnum(DocumentTypeListStatus)
  status?: DocumentTypeListStatus = DocumentTypeListStatus.Active;

  @ApiPropertyOptional({ description: 'Filtro por nome (busca parcial).' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
