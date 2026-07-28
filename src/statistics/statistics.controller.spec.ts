import { Test } from '@nestjs/testing';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

describe('StatisticsController', () => {
  let controller: StatisticsController;
  let service: { getDashboard: jest.Mock };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [StatisticsController],
      providers: [
        {
          provide: StatisticsService,
          useValue: {
            getDashboard: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(StatisticsController);
    service = moduleRef.get(StatisticsService);
  });

  it('getDashboard() delegates to the service', async () => {
    const dashboard = {
      completionPercentage: 0,
      totals: { requirements: 0, completed: 0, pending: 0 },
      mostPendingDocumentTypes: [],
      latestSubmissions: [],
    };
    service.getDashboard.mockResolvedValue(dashboard);

    await expect(controller.getDashboard()).resolves.toEqual(dashboard);
    expect(service.getDashboard).toHaveBeenCalledTimes(1);
  });
});
