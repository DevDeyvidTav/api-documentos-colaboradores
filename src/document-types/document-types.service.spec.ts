import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';
import { DocumentTypesRepository } from './document-types.repository';
import { DocumentTypesService } from './document-types.service';
import { DocumentTypeListStatus } from './dto/document-type-list-status.enum';
import { DocumentType } from './entities/document-type.entity';

type MockedRepository = {
  [K in keyof DocumentTypesRepository]: jest.Mock;
};

describe('DocumentTypesService', () => {
  let service: DocumentTypesService;
  let repository: MockedRepository;

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

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentTypesService,
        {
          provide: DocumentTypesRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findActiveByName: jest.fn(),
            findActiveById: jest.fn(),
            paginate: jest.fn(),
            softDeleteActive: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(DocumentTypesService);
    repository = moduleRef.get(DocumentTypesRepository);
  });

  describe('create', () => {
    it('creates a document type when the name is not in use by an active record', async () => {
      const draft = buildDocumentType();
      repository.findActiveByName.mockResolvedValue(null);
      repository.create.mockReturnValue(draft);
      repository.save.mockResolvedValue(draft);

      const result = await service.create({
        name: draft.name,
        description: draft.description ?? undefined,
      });

      expect(repository.findActiveByName).toHaveBeenCalledWith(draft.name);
      expect(repository.create).toHaveBeenCalledWith({
        name: draft.name,
        description: draft.description,
      });
      expect(repository.save).toHaveBeenCalledWith(draft);
      expect(result).toBe(draft);
    });

    it('stores null description when it is omitted', async () => {
      const draft = buildDocumentType({ description: null });
      repository.findActiveByName.mockResolvedValue(null);
      repository.create.mockReturnValue(draft);
      repository.save.mockResolvedValue(draft);

      await service.create({ name: 'RG' });

      expect(repository.create).toHaveBeenCalledWith({
        name: 'RG',
        description: null,
      });
    });

    it('throws ConflictException when an active document type already uses the name', async () => {
      repository.findActiveByName.mockResolvedValue(buildDocumentType());

      await expect(
        service.create({ name: 'CPF', description: 'Outro' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('maps a database unique-violation race into ConflictException', async () => {
      const draft = buildDocumentType();
      repository.findActiveByName.mockResolvedValue(null);
      repository.create.mockReturnValue(draft);
      const uniqueViolationError: QueryFailedError = Object.assign(
        Object.create(QueryFailedError.prototype) as QueryFailedError,
        { driverError: { code: '23505' } },
      );
      repository.save.mockRejectedValue(uniqueViolationError);

      await expect(service.create({ name: draft.name })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows unexpected repository errors', async () => {
      const draft = buildDocumentType();
      repository.findActiveByName.mockResolvedValue(null);
      repository.create.mockReturnValue(draft);
      const unexpected = new Error('connection lost');
      repository.save.mockRejectedValue(unexpected);

      await expect(service.create({ name: draft.name })).rejects.toBe(
        unexpected,
      );
    });
  });

  describe('findOne', () => {
    it('returns the document type when found and active', async () => {
      const documentType = buildDocumentType();
      repository.findActiveById.mockResolvedValue(documentType);

      await expect(service.findOne(documentType.id)).resolves.toBe(
        documentType,
      );
    });

    it('throws NotFoundException when the document type does not exist or is soft-deleted', async () => {
      repository.findActiveById.mockResolvedValue(null);

      await expect(service.findOne('unknown-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('delegates pagination to the repository and returns the wrapped result', async () => {
      const items = [buildDocumentType()];
      repository.paginate.mockResolvedValue([items, 1]);

      const result = await service.findAll({ page: 2, limit: 5 });

      expect(repository.paginate).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        status: DocumentTypeListStatus.Active,
        name: undefined,
      });
      expect(result).toEqual({ items, total: 1, page: 2, limit: 5 });
    });

    it('applies default pagination values when none are provided', async () => {
      repository.paginate.mockResolvedValue([[], 0]);

      const result = await service.findAll({} as never);

      expect(repository.paginate).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: DocumentTypeListStatus.Active,
        name: undefined,
      });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('forwards name filter to the repository', async () => {
      repository.paginate.mockResolvedValue([[], 0]);

      await service.findAll({ page: 1, limit: 20, name: 'CPF' });

      expect(repository.paginate).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: DocumentTypeListStatus.Active,
        name: 'CPF',
      });
    });

    it('forwards status filter to the repository', async () => {
      repository.paginate.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 1,
        limit: 20,
        status: DocumentTypeListStatus.Deleted,
      });

      expect(repository.paginate).toHaveBeenCalledWith(
        expect.objectContaining({ status: DocumentTypeListStatus.Deleted }),
      );
    });
  });

  describe('remove', () => {
    it('resolves without error when the active document type is soft-deleted', async () => {
      repository.softDeleteActive.mockResolvedValue(true);

      await expect(service.remove('some-id')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when the document type does not exist or was already removed', async () => {
      repository.softDeleteActive.mockResolvedValue(false);

      await expect(service.remove('some-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
