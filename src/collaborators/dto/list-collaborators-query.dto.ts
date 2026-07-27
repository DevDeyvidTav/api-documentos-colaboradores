import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CollaboratorListStatus } from './collaborator-list-status.enum';

export class ListCollaboratorsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: CollaboratorListStatus,
    default: CollaboratorListStatus.Active,
    description:
      'Filtra por status: active (padrão), deleted (somente removidos) ou all (todos).',
  })
  @IsOptional()
  @IsEnum(CollaboratorListStatus)
  status?: CollaboratorListStatus = CollaboratorListStatus.Active;

  @ApiPropertyOptional({ description: 'Filtro por nome (busca parcial).' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: 'Filtro por e-mail (busca parcial).' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;
}
