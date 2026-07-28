import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';
import { CollaboratorsService } from '../collaborators/collaborators.service';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { DocumentType } from '../document-types/entities/document-type.entity';
import { DocumentTypesService } from '../document-types/document-types.service';
import { DocumentRequirementsRepository } from './document-requirements.repository';
import { DocumentRequirementsService } from './document-requirements.service';
import { DocumentRequirementListStatus } from './dto/document-requirement-list-status.enum';
import { DocumentRequirement } from './entities/document-requirement.entity';

type MockedRepository = {
  [K in keyof DocumentRequirementsRepository]: jest.Mock;
};

type MockedCollaboratorsService = {
  [K in keyof CollaboratorsService]: jest.Mock;
};

type MockedDocumentTypesService = {
  [K in keyof DocumentTypesService]: jest.Mock;
};

describe('DocumentRequirementsService', () => {
  let service: DocumentRequirementsService;
  let repository: MockedRepository;
  let collaboratorsService: MockedCollaboratorsService;
  let documentTypesService: MockedDocumentTypesService;

  const buildCollaborator = (
    overrides: Partial<Collaborator> = {},
  ): Collaborator => ({
    id: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
    name: 'Deyvid Tavares',
    email: 'deyvid@email.com',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  });

  const buildDocumentType = (
    overrides: Partial<DocumentType> = {},
  ): DocumentType => ({
    id: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
    name: 'CPF',
    description: 'Cadastro de Pessoa Física',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  });

  const buildRequirement = (
    overrides: Partial<DocumentRequirement> = {},
  ): DocumentRequirement => {
    const collaborator = buildCollaborator();
    const documentType = buildDocumentType();
    return {
      id: 'c5f2d9d0-1c1a-4b8a-9d3b-000000000001',
      collaboratorId: collaborator.id,
      documentTypeId: documentType.id,
      collaborator,
      documentType,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
      ...overrides,
    };
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentRequirementsService,
        {
          provide: DocumentRequirementsRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findActiveByCollaboratorAndDocumentType: jest.fn(),
            findActiveById: jest.fn(),
            paginate: jest.fn(),
            paginatePending: jest.fn(),
            softDeleteActive: jest.fn(),
          },
        },
        {
          provide: CollaboratorsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DocumentTypesService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(DocumentRequirementsService);
    repository = moduleRef.get(DocumentRequirementsRepository);
    collaboratorsService = moduleRef.get(CollaboratorsService);
    documentTypesService = moduleRef.get(DocumentTypesService);
  });

  describe('create', () => {
    it('creates a requirement when collaborator and document type are active', async () => {
      const requirement = buildRequirement();
      collaboratorsService.findOne.mockResolvedValue(requirement.collaborator);
      documentTypesService.findOne.mockResolvedValue(requirement.documentType);
      repository.findActiveByCollaboratorAndDocumentType.mockResolvedValue(
        null,
      );
      repository.create.mockReturnValue(requirement);
      repository.save.mockResolvedValue(requirement);
      repository.findActiveById.mockResolvedValue(requirement);

      const result = await service.create({
        collaboratorId: requirement.collaboratorId,
        documentTypeId: requirement.documentTypeId,
      });

      expect(collaboratorsService.findOne).toHaveBeenCalledWith(
        requirement.collaboratorId,
      );
      expect(documentTypesService.findOne).toHaveBeenCalledWith(
        requirement.documentTypeId,
      );
      expect(result).toBe(requirement);
    });

    it('throws NotFoundException when the collaborator does not exist', async () => {
      collaboratorsService.findOne.mockRejectedValue(
        new NotFoundException('Colaborador não encontrado.'),
      );

      await expect(
        service.create({
          collaboratorId: 'missing-collaborator',
          documentTypeId: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentTypesService.findOne).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the collaborator is soft-deleted', async () => {
      collaboratorsService.findOne.mockRejectedValue(
        new NotFoundException('Colaborador não encontrado.'),
      );

      await expect(
        service.create({
          collaboratorId: 'deleted-collaborator',
          documentTypeId: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when the document type does not exist', async () => {
      collaboratorsService.findOne.mockResolvedValue(buildCollaborator());
      documentTypesService.findOne.mockRejectedValue(
        new NotFoundException('Tipo de documento não encontrado.'),
      );

      await expect(
        service.create({
          collaboratorId: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
          documentTypeId: 'missing-type',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the document type is soft-deleted', async () => {
      collaboratorsService.findOne.mockResolvedValue(buildCollaborator());
      documentTypesService.findOne.mockRejectedValue(
        new NotFoundException('Tipo de documento não encontrado.'),
      );

      await expect(
        service.create({
          collaboratorId: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
          documentTypeId: 'deleted-type',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when an active requirement already exists', async () => {
      collaboratorsService.findOne.mockResolvedValue(buildCollaborator());
      documentTypesService.findOne.mockResolvedValue(buildDocumentType());
      repository.findActiveByCollaboratorAndDocumentType.mockResolvedValue(
        buildRequirement(),
      );

      await expect(
        service.create({
          collaboratorId: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
          documentTypeId: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('maps a database unique-violation race into ConflictException', async () => {
      const requirement = buildRequirement();
      collaboratorsService.findOne.mockResolvedValue(requirement.collaborator);
      documentTypesService.findOne.mockResolvedValue(requirement.documentType);
      repository.findActiveByCollaboratorAndDocumentType.mockResolvedValue(
        null,
      );
      repository.create.mockReturnValue(requirement);
      const uniqueViolationError: QueryFailedError = Object.assign(
        Object.create(QueryFailedError.prototype) as QueryFailedError,
        { driverError: { code: '23505' } },
      );
      repository.save.mockRejectedValue(uniqueViolationError);

      await expect(
        service.create({
          collaboratorId: requirement.collaboratorId,
          documentTypeId: requirement.documentTypeId,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOne', () => {
    it('returns the requirement when found and active', async () => {
      const requirement = buildRequirement();
      repository.findActiveById.mockResolvedValue(requirement);

      await expect(service.findOne(requirement.id)).resolves.toBe(requirement);
    });

    it('throws NotFoundException when the requirement does not exist or is soft-deleted', async () => {
      repository.findActiveById.mockResolvedValue(null);

      await expect(service.findOne('unknown-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('delegates pagination and filters to the repository', async () => {
      const items = [buildRequirement()];
      repository.paginate.mockResolvedValue([items, 1]);

      const result = await service.findAll({
        page: 2,
        limit: 5,
        collaboratorId: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        documentTypeId: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        status: DocumentRequirementListStatus.Deleted,
      });

      expect(repository.paginate).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        status: DocumentRequirementListStatus.Deleted,
        collaboratorId: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        documentTypeId: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
      });
      expect(result).toEqual({ items, total: 1, page: 2, limit: 5 });
    });

    it('applies default pagination values when none are provided', async () => {
      repository.paginate.mockResolvedValue([[], 0]);

      const result = await service.findAll({} as never);

      expect(repository.paginate).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: DocumentRequirementListStatus.Active,
        collaboratorId: undefined,
        documentTypeId: undefined,
      });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('findPending', () => {
    it('returns an empty page when there are no pending requirements', async () => {
      repository.paginatePending.mockResolvedValue([[], 0]);

      const result = await service.findPending({ page: 1, limit: 20 });

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });

    it('returns pending requirements with totalPages', async () => {
      const items = [buildRequirement()];
      repository.paginatePending.mockResolvedValue([items, 1]);

      const result = await service.findPending({ page: 1, limit: 20 });

      expect(result.items).toEqual(items);
      expect(result.totalPages).toBe(1);
    });

    it('forwards collaborator, document type, name and date filters', async () => {
      repository.paginatePending.mockResolvedValue([[], 0]);
      const createdAfter = new Date('2026-01-01T00:00:00Z');
      const createdBefore = new Date('2026-12-31T23:59:59Z');

      await service.findPending({
        page: 1,
        limit: 10,
        collaboratorId: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        documentTypeId: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        name: 'Deyvid',
        createdAfter,
        createdBefore,
        status: DocumentRequirementListStatus.Active,
      });

      expect(repository.paginatePending).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        status: DocumentRequirementListStatus.Active,
        collaboratorId: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        documentTypeId: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
        name: 'Deyvid',
        createdAfter,
        createdBefore,
      });
    });

    it('computes totalPages using ceil(total / limit)', async () => {
      repository.paginatePending.mockResolvedValue([[], 25]);

      const result = await service.findPending({ page: 1, limit: 10 });

      expect(result.totalPages).toBe(3);
    });

    it('applies default pagination and active status', async () => {
      repository.paginatePending.mockResolvedValue([[], 0]);

      await service.findPending({} as never);

      expect(repository.paginatePending).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 20,
          status: DocumentRequirementListStatus.Active,
        }),
      );
    });
  });

  describe('remove', () => {
    it('resolves without error when the active requirement is soft-deleted', async () => {
      repository.softDeleteActive.mockResolvedValue(true);

      await expect(service.remove('some-id')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when the requirement does not exist or was already removed', async () => {
      repository.softDeleteActive.mockResolvedValue(false);

      await expect(service.remove('some-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
