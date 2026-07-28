import { BadRequestException, HttpStatus } from '@nestjs/common';
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

  const IDEMPOTENCY_KEY = '7b8d4d8e-f7af-46d3-a2fc-fc93bba0d96e';

  const buildVersion = (
    overrides: Partial<DocumentVersion> = {},
  ): DocumentVersion =>
    ({
      id: 'v5f2d9d0-1c1a-4b8a-9d3b-000000000001',
      requirementId: 'r5f2d9d0-1c1a-4b8a-9d3b-000000000001',
      versionNumber: 1,
      isActive: true,
      documentReference: 'documents/collaborator-123/cpf-v1.pdf',
      idempotencyKey: IDEMPOTENCY_KEY,
      requestHash: 'abc',
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

  it('submit() returns 201 on first execution', async () => {
    const version = buildVersion();
    service.submit.mockResolvedValue({ version, replay: false });
    const res = { status: jest.fn() };

    const result = await controller.submit(
      version.requirementId,
      { documentReference: version.documentReference },
      IDEMPOTENCY_KEY,
      res as never,
    );

    expect(service.submit).toHaveBeenCalledWith(
      version.requirementId,
      { documentReference: version.documentReference },
      IDEMPOTENCY_KEY,
    );
    expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
    expect(result.id).toBe(version.id);
  });

  it('submit() returns 200 on idempotent replay', async () => {
    const version = buildVersion({ versionNumber: 4 });
    service.submit.mockResolvedValue({ version, replay: true });
    const res = { status: jest.fn() };

    await controller.submit(
      version.requirementId,
      { documentReference: version.documentReference },
      IDEMPOTENCY_KEY,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('submit() rejects a missing Idempotency-Key with 400', async () => {
    const res = { status: jest.fn() };

    await expect(
      controller.submit(
        'r5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        { documentReference: 'documents/x.pdf' },
        undefined,
        res as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.submit).not.toHaveBeenCalled();
  });

  it('submit() rejects an invalid Idempotency-Key with 400', async () => {
    const res = { status: jest.fn() };

    await expect(
      controller.submit(
        'r5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        { documentReference: 'documents/x.pdf' },
        'not-a-uuid',
        res as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findByRequirement() maps the list', async () => {
    const versions = [buildVersion()];
    service.findByRequirementId.mockResolvedValue(versions);

    const result = await controller.findByRequirement(
      versions[0].requirementId,
    );

    expect(result).toHaveLength(1);
  });

  it('findOne() maps the response', async () => {
    const version = buildVersion();
    service.findOne.mockResolvedValue(version);

    const result = await controller.findOne(version.id);
    expect(result.id).toBe(version.id);
  });
});
