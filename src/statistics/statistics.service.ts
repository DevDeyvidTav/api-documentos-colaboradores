import { Injectable } from '@nestjs/common';
import { StatisticsResponseDto } from './dto/statistics-response.dto';
import {
  LATEST_SUBMISSIONS_LIMIT,
  StatisticsRepository,
} from './statistics.repository';

@Injectable()
export class StatisticsService {
  constructor(private readonly statisticsRepository: StatisticsRepository) {}

  async getDashboard(): Promise<StatisticsResponseDto> {
    const [totals, mostPendingDocumentTypes, latestSubmissions] =
      await Promise.all([
        this.statisticsRepository.getRequirementTotals(),
        this.statisticsRepository.findMostPendingDocumentTypes(),
        this.statisticsRepository.findLatestSubmissions(
          LATEST_SUBMISSIONS_LIMIT,
        ),
      ]);

    return {
      completionPercentage: this.calculateCompletionPercentage(
        totals.completed,
        totals.requirements,
      ),
      totals,
      mostPendingDocumentTypes,
      latestSubmissions,
    };
  }

  private calculateCompletionPercentage(
    completed: number,
    requirements: number,
  ): number {
    if (requirements === 0) {
      return 0;
    }

    return Number(((completed / requirements) * 100).toFixed(2));
  }
}
