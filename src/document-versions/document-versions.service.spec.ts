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
      collaborator: {
        id: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        name: 'Deyvid',
        email: 'deyvid@email.com',
        deletedAt: null,
      },
      documentType: {
        id: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        name: 'CPF',
        description: null,
        deletedAt: null,
      },
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

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentVersionsService,
        {
          provide: DocumentVersionsRepository,
          useValue: {
            findById: jest.fn(),
            findByRequirementIdOrdered: jest.fn(),
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
    it('creates version 1 on the first submission', async () => {
      const requirement = buildRequirement();
      const version = buildVersion({ versionNumber: 1 });
      documentRequirementsService.findOne.mockResolvedValue(requirement);
      repository.deactivateActiveVersions.mockResolvedValue(undefined);
      repository.getNextVersionNumber.mockResolvedValue(1);
      repository.createActiveVersion.mockResolvedValue(version);
      dataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<DocumentVersion>) => cb({}),
      );

      const result = await service.submit(requirement.id, {
        documentReference: version.documentReference,
      });

      expect(repository.deactivateActiveVersions).toHaveBeenCalled();
      expect(repository.getNextVersionNumber).toHaveBeenCalled();
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

    it('creates version 2, deactivating the previous active version', async () => {
      const requirement = buildRequirement();
      const version = buildVersion({
        id: 'v5f2d9d0-1c1a-4b8a-9d3b-000000000002',
        versionNumber: 2,
        documentReference: 'documents/collaborator-123/cpf-v2.pdf',
      });
      documentRequirementsService.findOne.mockResolvedValue(requirement);
      repository.deactivateActiveVersions.mockResolvedValue(undefined);
      repository.getNextVersionNumber.mockResolvedValue(2);
      repository.createActiveVersion.mockResolvedValue(version);
      dataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<DocumentVersion>) => cb({}),
      );

      const result = await service.submit(requirement.id, {
        documentReference: version.documentReference,
      });

      expect(repository.deactivateActiveVersions).toHaveBeenCalledWith(
        expect.anything(),
        requirement.id,
      );
      expect(result.versionNumber).toBe(2);
      expect(result.isActive).toBe(true);
    });

    it('throws NotFoundException when the requirement does not exist', async () => {
      documentRequirementsService.findOne.mockRejectedValue(
        new NotFoundException('Requisito documental não encontrado.'),
      );

      await expect(
        service.submit('missing', {
          documentReference: 'documents/x.pdf',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the requirement is soft-deleted', async () => {
      documentRequirementsService.findOne.mockRejectedValue(
        new NotFoundException('Requisito documental não encontrado.'),
      );

      await expect(
        service.submit('deleted-requirement', {
          documentReference: 'documents/x.pdf',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when the related collaborator is soft-deleted', async () => {
      documentRequirementsService.findOne.mockResolvedValue(
        buildRequirement({
          collaborator: {
            id: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
            name: 'Deyvid',
            email: 'deyvid@email.com',
            deletedAt: new Date(),
          } as DocumentRequirement['collaborator'],
        }),
      );

      await expect(
        service.submit('r5f2d9d0-1c1a-4b8a-9d3b-000000000001', {
          documentReference: 'documents/x.pdf',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the related document type is soft-deleted', async () => {
      documentRequirementsService.findOne.mockResolvedValue(
        buildRequirement({
          documentType: {
            id: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
            name: 'CPF',
            description: null,
            deletedAt: new Date(),
          } as DocumentRequirement['documentType'],
        }),
      );

      await expect(
        service.submit('r5f2d9d0-1c1a-4b8a-9d3b-000000000001', {
          documentReference: 'documents/x.pdf',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps unique-violation into ConflictException', async () => {
      documentRequirementsService.findOne.mockResolvedValue(buildRequirement());
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

    it('propagates persistence errors so the transaction rolls back', async () => {
      documentRequirementsService.findOne.mockResolvedValue(buildRequirement());
      repository.deactivateActiveVersions.mockResolvedValue(undefined);
      repository.getNextVersionNumber.mockResolvedValue(2);
      const persistenceError = new Error('insert failed');
      repository.createActiveVersion.mockRejectedValue(persistenceError);
      dataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<DocumentVersion>) => cb({}),
      );

      await expect(
        service.submit('r5f2d9d0-1c1a-4b8a-9d3b-000000000001', {
          documentReference: 'documents/x.pdf',
        }),
      ).rejects.toBe(persistenceError);
      expect(repository.deactivateActiveVersions).toHaveBeenCalled();
      expect(repository.createActiveVersion).toHaveBeenCalled();
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
