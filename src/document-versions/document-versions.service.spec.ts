import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { DocumentRequirement } from '../document-requirements/entities/document-requirement.entity';
import { DocumentRequirementsService } from '../document-requirements/document-requirements.service';
import { DocumentVersionsRepository } from './document-versions.repository';
import { DocumentVersionsService } from './document-versions.service';
import { DocumentVersion } from './entities/document-version.entity';

type MockedRepository = {
  [K in keyof DocumentVersionsRepository]: jest.Mock;
};

describe('DocumentVersionsService', () => {
  let service: DocumentVersionsService;
  let repository: MockedRepository;
  let documentRequirementsService: { findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };

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
      submittedAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    }) as DocumentVersion;

  const mockSuccessfulTransaction = () => {
    dataSource.transaction.mockImplementation(
      async (cb: (manager: unknown) => Promise<DocumentVersion>) => cb({}),
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
    const prepareHappyPath = (version: DocumentVersion) => {
      const requirement = buildRequirement();
      repository.lockActiveRequirement.mockResolvedValue(requirement);
      repository.findActiveCollaborator.mockResolvedValue({
        id: requirement.collaboratorId,
        deletedAt: null,
      });
      repository.findActiveDocumentType.mockResolvedValue({
        id: requirement.documentTypeId,
        deletedAt: null,
      });
      repository.deactivateActiveVersions.mockResolvedValue(undefined);
      repository.getNextVersionNumber.mockResolvedValue(version.versionNumber);
      repository.createActiveVersion.mockResolvedValue(version);
      mockSuccessfulTransaction();
      return requirement;
    };

    it('runs inside a transaction and locks the requirement with pessimistic write', async () => {
      const version = buildVersion({ versionNumber: 1 });
      const requirement = prepareHappyPath(version);

      await service.submit(requirement.id, {
        documentReference: version.documentReference,
      });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(repository.lockActiveRequirement).toHaveBeenCalledWith(
        expect.anything(),
        requirement.id,
      );
    });

    it('validates collaborator and document type inside the transaction', async () => {
      const version = buildVersion({ versionNumber: 1 });
      const requirement = prepareHappyPath(version);

      await service.submit(requirement.id, {
        documentReference: version.documentReference,
      });

      expect(repository.findActiveCollaborator).toHaveBeenCalledWith(
        expect.anything(),
        requirement.collaboratorId,
      );
      expect(repository.findActiveDocumentType).toHaveBeenCalledWith(
        expect.anything(),
        requirement.documentTypeId,
      );
    });

    it('creates version 1 on the first submission', async () => {
      const version = buildVersion({ versionNumber: 1 });
      const requirement = prepareHappyPath(version);

      const result = await service.submit(requirement.id, {
        documentReference: version.documentReference,
      });

      expect(repository.createActiveVersion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          requirementId: requirement.id,
          versionNumber: 1,
          documentReference: version.documentReference,
        }),
      );
      expect(result).toBe(version);
    });

    it('creates version 2 after deactivating the previous active version', async () => {
      const version = buildVersion({
        id: 'v5f2d9d0-1c1a-4b8a-9d3b-000000000002',
        versionNumber: 2,
        documentReference: 'documents/collaborator-123/cpf-v2.pdf',
      });
      const requirement = prepareHappyPath(version);

      const result = await service.submit(requirement.id, {
        documentReference: version.documentReference,
      });

      expect(repository.deactivateActiveVersions).toHaveBeenCalledWith(
        expect.anything(),
        requirement.id,
      );
      expect(repository.getNextVersionNumber).toHaveBeenCalledWith(
        expect.anything(),
        requirement.id,
      );
      expect(result.versionNumber).toBe(2);
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException when the locked requirement is missing or inactive', async () => {
      repository.lockActiveRequirement.mockResolvedValue(null);
      mockSuccessfulTransaction();

      await expect(
        service.submit('missing', { documentReference: 'documents/x.pdf' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.createActiveVersion).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the collaborator is inactive', async () => {
      repository.lockActiveRequirement.mockResolvedValue(buildRequirement());
      repository.findActiveCollaborator.mockResolvedValue(null);
      mockSuccessfulTransaction();

      await expect(
        service.submit('r5f2d9d0-1c1a-4b8a-9d3b-000000000001', {
          documentReference: 'documents/x.pdf',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.createActiveVersion).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the document type is inactive', async () => {
      const requirement = buildRequirement();
      repository.lockActiveRequirement.mockResolvedValue(requirement);
      repository.findActiveCollaborator.mockResolvedValue({
        id: requirement.collaboratorId,
      });
      repository.findActiveDocumentType.mockResolvedValue(null);
      mockSuccessfulTransaction();

      await expect(
        service.submit(requirement.id, {
          documentReference: 'documents/x.pdf',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.createActiveVersion).not.toHaveBeenCalled();
    });

    it('maps unique-violation into ConflictException', async () => {
      const uniqueViolationError: QueryFailedError = Object.assign(
        Object.create(QueryFailedError.prototype) as QueryFailedError,
        { driverError: { code: '23505' } },
      );
      dataSource.transaction.mockRejectedValue(uniqueViolationError);

      await expect(
        service.submit('r5f2d9d0-1c1a-4b8a-9d3b-000000000001', {
          documentReference: 'documents/x.pdf',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('maps deadlock into ConflictException', async () => {
      const deadlockError: QueryFailedError = Object.assign(
        Object.create(QueryFailedError.prototype) as QueryFailedError,
        { driverError: { code: '40P01' } },
      );
      dataSource.transaction.mockRejectedValue(deadlockError);

      await expect(
        service.submit('r5f2d9d0-1c1a-4b8a-9d3b-000000000001', {
          documentReference: 'documents/x.pdf',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('propagates persistence errors so the transaction rolls back', async () => {
      const version = buildVersion({ versionNumber: 2 });
      prepareHappyPath(version);
      const persistenceError = new Error('insert failed');
      repository.createActiveVersion.mockRejectedValue(persistenceError);

      await expect(
        service.submit('r5f2d9d0-1c1a-4b8a-9d3b-000000000001', {
          documentReference: 'documents/x.pdf',
        }),
      ).rejects.toBe(persistenceError);
      expect(repository.deactivateActiveVersions).toHaveBeenCalled();
      expect(repository.createActiveVersion).toHaveBeenCalled();
    });

    it('uses the transactional manager for every write/read in submit', async () => {
      const version = buildVersion({ versionNumber: 1 });
      const requirement = prepareHappyPath(version);
      const transactionalManager = { marker: 'tx-manager' };
      dataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<DocumentVersion>) =>
          cb(transactionalManager),
      );

      await service.submit(requirement.id, {
        documentReference: version.documentReference,
      });

      expect(repository.lockActiveRequirement).toHaveBeenCalledWith(
        transactionalManager,
        requirement.id,
      );
      expect(repository.findActiveCollaborator).toHaveBeenCalledWith(
        transactionalManager,
        requirement.collaboratorId,
      );
      expect(repository.findActiveDocumentType).toHaveBeenCalledWith(
        transactionalManager,
        requirement.documentTypeId,
      );
      expect(repository.deactivateActiveVersions).toHaveBeenCalledWith(
        transactionalManager,
        requirement.id,
      );
      expect(repository.getNextVersionNumber).toHaveBeenCalledWith(
        transactionalManager,
        requirement.id,
      );
      expect(repository.createActiveVersion).toHaveBeenCalledWith(
        transactionalManager,
        expect.any(Object),
      );
    });
  });

  describe('findByRequirementId', () => {
    it('returns versions ordered by versionNumber DESC', async () => {
      const requirement = buildRequirement();
      const versions = [
        buildVersion({ versionNumber: 2, isActive: true }),
        buildVersion({
          id: 'v5f2d9d0-1c1a-4b8a-9d3b-000000000000',
          versionNumber: 1,
          isActive: false,
        }),
      ];
      documentRequirementsService.findOne.mockResolvedValue(requirement);
      repository.findByRequirementIdOrdered.mockResolvedValue(versions);

      const result = await service.findByRequirementId(requirement.id);

      expect(repository.findByRequirementIdOrdered).toHaveBeenCalledWith(
        requirement.id,
      );
      expect(result[0].versionNumber).toBe(2);
      expect(result[1].versionNumber).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns the version when found', async () => {
      const version = buildVersion();
      repository.findById.mockResolvedValue(version);

      await expect(service.findOne(version.id)).resolves.toBe(version);
    });

    it('throws NotFoundException when the version does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
