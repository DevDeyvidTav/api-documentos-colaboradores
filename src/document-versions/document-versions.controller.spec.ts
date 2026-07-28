import { Test } from '@nestjs/testing';
import { DocumentVersionsController } from './document-versions.controller';
import { DocumentVersionsService } from './document-versions.service';
import { DocumentVersion } from './entities/document-version.entity';

type MockedService = {
  [K in keyof DocumentVersionsService]: jest.Mock;
};

describe('DocumentVersionsController', () => {
  let controller: DocumentVersionsController;
  let service: MockedService;

  const buildVersion = (
    overrides: Partial<DocumentVersion> = {},
  ): DocumentVersion =>
    ({
      id: 'v5f2d9d0-1c1a-4b8a-9d3b-000000000001',
      requirementId: 'r5f2d9d0-1c1a-4b8a-9d3b-000000000001',
      versionNumber: 1,
      isActive: true,
      documentReference: 'documents/collaborator-123/cpf-v1.pdf',
      submittedAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    }) as DocumentVersion;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentVersionsController],
      providers: [
        {
          provide: DocumentVersionsService,
          useValue: {
            submit: jest.fn(),
            findByRequirementId: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(DocumentVersionsController);
    service = moduleRef.get(DocumentVersionsService);
  });

  it('submit() delegates to the service and maps the response', async () => {
    const version = buildVersion();
    service.submit.mockResolvedValue(version);

    const result = await controller.submit(version.requirementId, {
      documentReference: version.documentReference,
    });

    expect(service.submit).toHaveBeenCalledWith(version.requirementId, {
      documentReference: version.documentReference,
    });
    expect(result).toEqual({
      id: version.id,
      requirementId: version.requirementId,
      versionNumber: 1,
      isActive: true,
      documentReference: version.documentReference,
      submittedAt: version.submittedAt,
      createdAt: version.createdAt,
    });
  });

  it('findByRequirement() delegates and maps the list', async () => {
    const versions = [
      buildVersion({ versionNumber: 2, isActive: true }),
      buildVersion({
        id: 'v5f2d9d0-1c1a-4b8a-9d3b-000000000000',
        versionNumber: 1,
        isActive: false,
      }),
    ];
    service.findByRequirementId.mockResolvedValue(versions);

    const result = await controller.findByRequirement(
      versions[0].requirementId,
    );

    expect(result).toHaveLength(2);
    expect(result[0].versionNumber).toBe(2);
    expect(result[0].isActive).toBe(true);
    expect(result[1].isActive).toBe(false);
  });

  it('findOne() delegates and maps the response', async () => {
    const version = buildVersion();
    service.findOne.mockResolvedValue(version);

    const result = await controller.findOne(version.id);

    expect(service.findOne).toHaveBeenCalledWith(version.id);
    expect(result.id).toBe(version.id);
  });
});
