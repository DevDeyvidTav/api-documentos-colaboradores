import { createHash } from 'crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { DocumentRequirement } from '../document-requirements/entities/document-requirement.entity';
import { DocumentRequirementsService } from '../document-requirements/document-requirements.service';
import { DocumentVersionsRepository } from './document-versions.repository';
import { DocumentVersionsService } from './document-versions.service';
import { DocumentVersion } from './entities/document-version.entity';
import { buildDocumentVersionRequestHash } from './utils/document-version-request-hash.util';

type MockedRepository = {
  [K in keyof DocumentVersionsRepository]: jest.Mock;
};

describe('buildDocumentVersionRequestHash', () => {
  it('computes a deterministic sha256 of relevant payload fields', () => {
    const hash = buildDocumentVersionRequestHash({
      documentReference: 'documents/cpf-v1.pdf',
    });
    const expected = createHash('sha256')
      .update(JSON.stringify({ documentReference: 'documents/cpf-v1.pdf' }))
      .digest('hex');

    expect(hash).toBe(expected);
    expect(
      buildDocumentVersionRequestHash({
        documentReference: 'documents/cpf-v1.pdf',
      }),
    ).toBe(hash);
  });

  it('changes when documentReference changes', () => {
    expect(
      buildDocumentVersionRequestHash({ documentReference: 'a.pdf' }),
    ).not.toBe(buildDocumentVersionRequestHash({ documentReference: 'b.pdf' }));
  });
});

describe('DocumentVersionsService', () => {
  let service: DocumentVersionsService;
  let repository: MockedRepository;
  let documentRequirementsService: { findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const IDEMPOTENCY_KEY = '7b8d4d8e-f7af-46d3-a2fc-fc93bba0d96e';

  const buildRequirement = (
    overrides: Partial<DocumentRequirement> = {},
  ): DocumentRequirement =>
    ({
      id: 'r5f2d9d0-1c1a-4b8a-9d3b-000000000001',
      collaboratorId: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
      documentTypeId: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
      deletedAt: null,
      ...overrides,
    }) as DocumentRequirement;

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
      requestHash: buildDocumentVersionRequestHash({
        documentReference: 'documents/collaborator-123/cpf-v1.pdf',
      }),
      submittedAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    }) as DocumentVersion;

  const mockSuccessfulTransaction = () => {
    dataSource.transaction.mockImplementation(
      async (cb: (manager: unknown) => Promise<unknown>) => cb({}),
    );
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentVersionsService,
        {
          provide: DocumentVersionsRepository,
          useValue: {
            findById: jest.fn(),
            findByRequirementIdOrdered: jest.fn(),
            lockActiveRequirement: jest.fn(),
            findActiveCollaborator: jest.fn(),
            findActiveDocumentType: jest.fn(),
            findByRequirementAndIdempotencyKey: jest.fn(),
            deactivateActiveVersions: jest.fn(),
            getNextVersionNumber: jest.fn(),
            createActiveVersion: jest.fn(),
          },
        },
        {
          provide: DocumentRequirementsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(DocumentVersionsService);
    repository = moduleRef.get(DocumentVersionsRepository);
    documentRequirementsService = moduleRef.get(DocumentRequirementsService);
    dataSource = moduleRef.get(DataSource);
  });

  describe('submit', () => {
    const prepareCreatePath = (version: DocumentVersion) => {
      const requirement = buildRequirement();
      repository.lockActiveRequirement.mockResolvedValue(requirement);
      repository.findByRequirementAndIdempotencyKey.mockResolvedValue(null);
      repository.findActiveCollaborator.mockResolvedValue({
        id: requirement.collaboratorId,
      });
      repository.findActiveDocumentType.mockResolvedValue({
        id: requirement.documentTypeId,
      });
      repository.deactivateActiveVersions.mockResolvedValue(undefined);
      repository.getNextVersionNumber.mockResolvedValue(version.versionNumber);
      repository.createActiveVersion.mockResolvedValue(version);
      mockSuccessfulTransaction();
      return requirement;
    };

    it('creates a new version on the first execution and persists idempotency fields', async () => {
      const version = buildVersion({ versionNumber: 1 });
      const requirement = prepareCreatePath(version);
      const dto = { documentReference: version.documentReference };

      const result = await service.submit(requirement.id, dto, IDEMPOTENCY_KEY);

      expect(result.replay).toBe(false);
      expect(result.version).toBe(version);
      expect(
        repository.findByRequirementAndIdempotencyKey,
      ).toHaveBeenCalledWith(
        expect.anything(),
        requirement.id,
        IDEMPOTENCY_KEY,
      );
      expect(repository.createActiveVersion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          idempotencyKey: IDEMPOTENCY_KEY,
          requestHash: buildDocumentVersionRequestHash(dto),
          versionNumber: 1,
        }),
      );
    });

    it('replays the existing version on retry with the same key and payload', async () => {
      const existing = buildVersion({ versionNumber: 4, isActive: true });
      repository.lockActiveRequirement.mockResolvedValue(buildRequirement());
      repository.findByRequirementAndIdempotencyKey.mockResolvedValue(existing);
      mockSuccessfulTransaction();

      const result = await service.submit(
        existing.requirementId,
        { documentReference: existing.documentReference },
        IDEMPOTENCY_KEY,
      );

      expect(result).toEqual({ version: existing, replay: true });
      expect(repository.createActiveVersion).not.toHaveBeenCalled();
      expect(repository.deactivateActiveVersions).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the same key is reused with a different payload', async () => {
      const existing = buildVersion({
        requestHash: buildDocumentVersionRequestHash({
          documentReference: 'documents/old.pdf',
        }),
      });
      repository.lockActiveRequirement.mockResolvedValue(buildRequirement());
      repository.findByRequirementAndIdempotencyKey.mockResolvedValue(existing);
      mockSuccessfulTransaction();

      await expect(
        service.submit(
          existing.requirementId,
          { documentReference: 'documents/new.pdf' },
          IDEMPOTENCY_KEY,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.createActiveVersion).not.toHaveBeenCalled();
    });

    it('locks the requirement and validates related entities on create', async () => {
      const version = buildVersion();
      const requirement = prepareCreatePath(version);

      await service.submit(
        requirement.id,
        { documentReference: version.documentReference },
        IDEMPOTENCY_KEY,
      );

      expect(repository.lockActiveRequirement).toHaveBeenCalled();
      expect(repository.findActiveCollaborator).toHaveBeenCalled();
      expect(repository.findActiveDocumentType).toHaveBeenCalled();
    });

    it('throws NotFoundException when the requirement is missing', async () => {
      repository.lockActiveRequirement.mockResolvedValue(null);
      mockSuccessfulTransaction();

      await expect(
        service.submit(
          'missing',
          { documentReference: 'documents/x.pdf' },
          IDEMPOTENCY_KEY,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps unique-violation into ConflictException', async () => {
      const uniqueViolationError: QueryFailedError = Object.assign(
        Object.create(QueryFailedError.prototype) as QueryFailedError,
        { driverError: { code: '23505' } },
      );
      dataSource.transaction.mockRejectedValue(uniqueViolationError);

      await expect(
        service.submit(
          'r5f2d9d0-1c1a-4b8a-9d3b-000000000001',
          { documentReference: 'documents/x.pdf' },
          IDEMPOTENCY_KEY,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('propagates persistence errors for transaction rollback', async () => {
      const version = buildVersion({ versionNumber: 2 });
      prepareCreatePath(version);
      const persistenceError = new Error('insert failed');
      repository.createActiveVersion.mockRejectedValue(persistenceError);

      await expect(
        service.submit(
          version.requirementId,
          { documentReference: version.documentReference },
          IDEMPOTENCY_KEY,
        ),
      ).rejects.toBe(persistenceError);
    });
  });

  describe('findByRequirementId', () => {
    it('returns versions ordered by versionNumber DESC', async () => {
      const requirement = buildRequirement();
      const versions = [buildVersion({ versionNumber: 2 })];
      documentRequirementsService.findOne.mockResolvedValue(requirement);
      repository.findByRequirementIdOrdered.mockResolvedValue(versions);

      await expect(
        service.findByRequirementId(requirement.id),
      ).resolves.toEqual(versions);
    });
  });

  describe('findOne', () => {
    it('returns the version when found', async () => {
      const version = buildVersion();
      repository.findById.mockResolvedValue(version);
      await expect(service.findOne(version.id)).resolves.toBe(version);
    });

    it('throws NotFoundException when missing', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
