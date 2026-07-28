import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatisticsResponseDto } from './dto/statistics-response.dto';
import { StatisticsService } from './statistics.service';

@ApiTags('statistics')
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  @ApiOperation({
    summary: 'Retorna o dashboard consolidado de documentação.',
    description:
      'Endpoint único com métricas agregadas:\n\n' +
      '- **completionPercentage**: `(completos / requisitos ativos) * 100` (2 casas). `0` se não houver requisitos.\n' +
      '- **totals**: contagem de requisitos ativos, completos (com versão ativa) e pendentes (sem versão ativa).\n' +
      '- **mostPendingDocumentTypes**: tipos ordenados por `pendingCount` DESC e nome ASC.\n' +
      '- **latestSubmissions**: até 10 envios mais recentes por `submittedAt` DESC.\n\n' +
      'Status PENDING/COMPLETED **não** são persistidos — são derivados na consulta. Soft-deleted não entram nas métricas.',
  })
  @ApiOkResponse({
    type: StatisticsResponseDto,
    description:
      'Dashboard consolidado. Sistema vazio retorna zeros e listas vazias (200).',
  })
  getDashboard(): Promise<StatisticsResponseDto> {
    return this.statisticsService.getDashboard();
  }
}
