import { Test } from '@nestjs/testing';
import { StatisticsRepository } from './statistics.repository';
import { StatisticsService } from './statistics.service';

describe('StatisticsService', () => {
  let service: StatisticsService;
  let repository: {
    getRequirementTotals: jest.Mock;
    findMostPendingDocumentTypes: jest.Mock;
    findLatestSubmissions: jest.Mock;
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StatisticsService,
        {
          provide: StatisticsRepository,
          useValue: {
            getRequirementTotals: jest.fn(),
            findMostPendingDocumentTypes: jest.fn(),
            findLatestSubmissions: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(StatisticsService);
    repository = moduleRef.get(StatisticsRepository);
  });

  it('returns zeros and empty lists when the system has no data', async () => {
    repository.getRequirementTotals.mockResolvedValue({
      requirements: 0,
      completed: 0,
      pending: 0,
    });
    repository.findMostPendingDocumentTypes.mockResolvedValue([]);
    repository.findLatestSubmissions.mockResolvedValue([]);

    await expect(service.getDashboard()).resolves.toEqual({
      completionPercentage: 0,
      totals: { requirements: 0, completed: 0, pending: 0 },
      mostPendingDocumentTypes: [],
      latestSubmissions: [],
    });
  });

  it('calculates completion percentage with two decimal places', async () => {
    repository.getRequirementTotals.mockResolvedValue({
      requirements: 13,
      completed: 11,
      pending: 2,
    });
    repository.findMostPendingDocumentTypes.mockResolvedValue([]);
    repository.findLatestSubmissions.mockResolvedValue([]);

    const result = await service.getDashboard();

    // 11/13 * 100 = 84.615... → 84.62
    expect(result.completionPercentage).toBe(84.62);
    expect(result.totals).toEqual({
      requirements: 13,
      completed: 11,
      pending: 2,
    });
  });

  it('returns 100 when all requirements are completed', async () => {
    repository.getRequirementTotals.mockResolvedValue({
      requirements: 5,
      completed: 5,
      pending: 0,
    });
    repository.findMostPendingDocumentTypes.mockResolvedValue([]);
    repository.findLatestSubmissions.mockResolvedValue([]);

    const result = await service.getDashboard();
    expect(result.completionPercentage).toBe(100);
  });

  it('maps most pending document types and latest submissions from the repository', async () => {
    repository.getRequirementTotals.mockResolvedValue({
      requirements: 10,
      completed: 7,
      pending: 3,
    });
    const mostPending = [
      {
        documentTypeId: 'type-aso',
        documentTypeName: 'ASO',
        pendingCount: 8,
      },
      {
        documentTypeId: 'type-cpf',
        documentTypeName: 'CPF',
        pendingCount: 2,
      },
    ];
    const latest = [
      {
        documentVersionId: 'version-1',
        versionNumber: 4,
        submittedAt: new Date('2026-07-28T10:00:00Z'),
        collaborator: { id: 'collab-1', name: 'João' },
        documentType: { id: 'type-cpf', name: 'CPF' },
      },
    ];
    repository.findMostPendingDocumentTypes.mockResolvedValue(mostPending);
    repository.findLatestSubmissions.mockResolvedValue(latest);

    const result = await service.getDashboard();

    expect(result.mostPendingDocumentTypes).toEqual(mostPending);
    expect(result.latestSubmissions).toEqual(latest);
    expect(repository.findLatestSubmissions).toHaveBeenCalledWith(10);
  });

  it('runs the three repository aggregations in parallel', async () => {
    repository.getRequirementTotals.mockResolvedValue({
      requirements: 0,
      completed: 0,
      pending: 0,
    });
    repository.findMostPendingDocumentTypes.mockResolvedValue([]);
    repository.findLatestSubmissions.mockResolvedValue([]);

    await service.getDashboard();

    expect(repository.getRequirementTotals).toHaveBeenCalledTimes(1);
    expect(repository.findMostPendingDocumentTypes).toHaveBeenCalledTimes(1);
    expect(repository.findLatestSubmissions).toHaveBeenCalledTimes(1);
  });
});
