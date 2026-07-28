import { ApiProperty } from '@nestjs/swagger';

export class StatisticsTotalsDto {
  @ApiProperty({ example: 120, description: 'Total de requisitos ativos.' })
  requirements: number;

  @ApiProperty({
    example: 101,
    description: 'Requisitos ativos com versão ativa (completos).',
  })
  completed: number;

  @ApiProperty({
    example: 19,
    description: 'Requisitos ativos sem versão ativa (pendentes).',
  })
  pending: number;
}

export class MostPendingDocumentTypeDto {
  @ApiProperty({ format: 'uuid' })
  documentTypeId: string;

  @ApiProperty({ example: 'ASO' })
  documentTypeName: string;

  @ApiProperty({ example: 8 })
  pendingCount: number;
}

export class StatisticsCollaboratorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'João' })
  name: string;
}

export class StatisticsDocumentTypeDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'CPF' })
  name: string;
}

export class LatestSubmissionDto {
  @ApiProperty({ format: 'uuid' })
  documentVersionId: string;

  @ApiProperty({ example: 4 })
  versionNumber: number;

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty({ type: StatisticsCollaboratorDto })
  collaborator: StatisticsCollaboratorDto;

  @ApiProperty({ type: StatisticsDocumentTypeDto })
  documentType: StatisticsDocumentTypeDto;
}

export class StatisticsResponseDto {
  @ApiProperty({
    example: 84.62,
    description:
      'Percentual de documentação completa: (completed / requirements) * 100, com 2 casas decimais. 0 quando não há requisitos.',
  })
  completionPercentage: number;

  @ApiProperty({ type: StatisticsTotalsDto })
  totals: StatisticsTotalsDto;

  @ApiProperty({
    type: [MostPendingDocumentTypeDto],
    description:
      'Tipos de documento ordenados por quantidade de pendências (DESC) e nome (ASC).',
  })
  mostPendingDocumentTypes: MostPendingDocumentTypeDto[];

  @ApiProperty({
    type: [LatestSubmissionDto],
    description: 'Até 10 envios mais recentes, ordenados por submittedAt DESC.',
  })
  latestSubmissions: LatestSubmissionDto[];
}
