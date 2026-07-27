import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';
import { CollaboratorsRepository } from './collaborators.repository';
import { CollaboratorsService } from './collaborators.service';
import { CollaboratorListStatus } from './dto/collaborator-list-status.enum';
import { Collaborator } from './entities/collaborator.entity';

type MockedRepository = {
  [K in keyof CollaboratorsRepository]: jest.Mock;
};

describe('CollaboratorsService', () => {
  let service: CollaboratorsService;
  let repository: MockedRepository;

  const buildCollaborator = (
    overrides: Partial<Collaborator> = {},
  ): Collaborator => ({
    id: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
    name: 'Ana Silva',
    email: 'ana@example.com',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CollaboratorsService,
        {
          provide: CollaboratorsRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findActiveByEmail: jest.fn(),
            findActiveById: jest.fn(),
            paginate: jest.fn(),
            softDeleteActive: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(CollaboratorsService);
    repository = moduleRef.get(CollaboratorsRepository);
  });

  describe('create', () => {
    it('creates a collaborator when the e-mail is not in use by an active record', async () => {
      const draft = buildCollaborator();
      repository.findActiveByEmail.mockResolvedValue(null);
      repository.create.mockReturnValue(draft);
      repository.save.mockResolvedValue(draft);

      const result = await service.create({
        name: draft.name,
        email: draft.email,
      });

      expect(repository.findActiveByEmail).toHaveBeenCalledWith(draft.email);
      expect(repository.create).toHaveBeenCalledWith({
        name: draft.name,
        email: draft.email,
      });
      expect(repository.save).toHaveBeenCalledWith(draft);
      expect(result).toBe(draft);
    });

    it('throws ConflictException when an active collaborator already uses the e-mail', async () => {
      repository.findActiveByEmail.mockResolvedValue(buildCollaborator());

      await expect(
        service.create({ name: 'Outra Pessoa', email: 'ana@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('maps a database unique-violation race into ConflictException', async () => {
      const draft = buildCollaborator();
      repository.findActiveByEmail.mockResolvedValue(null);
      repository.create.mockReturnValue(draft);
      const uniqueViolationError: QueryFailedError = Object.assign(
        Object.create(QueryFailedError.prototype) as QueryFailedError,
        { driverError: { code: '23505' } },
      );
      repository.save.mockRejectedValue(uniqueViolationError);

      await expect(
        service.create({ name: draft.name, email: draft.email }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows unexpected repository errors', async () => {
      const draft = buildCollaborator();
      repository.findActiveByEmail.mockResolvedValue(null);
      repository.create.mockReturnValue(draft);
      const unexpected = new Error('connection lost');
      repository.save.mockRejectedValue(unexpected);

      await expect(
        service.create({ name: draft.name, email: draft.email }),
      ).rejects.toBe(unexpected);
    });
  });

  describe('findOne', () => {
    it('returns the collaborator when found and active', async () => {
      const collaborator = buildCollaborator();
      repository.findActiveById.mockResolvedValue(collaborator);

      await expect(service.findOne(collaborator.id)).resolves.toBe(
        collaborator,
      );
    });

    it('throws NotFoundException when the collaborator does not exist or is soft-deleted', async () => {
      repository.findActiveById.mockResolvedValue(null);

      await expect(service.findOne('unknown-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('delegates pagination to the repository and returns the wrapped result', async () => {
      const items = [buildCollaborator()];
      repository.paginate.mockResolvedValue([items, 1]);

      const result = await service.findAll({ page: 2, limit: 5 });

      expect(repository.paginate).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        status: CollaboratorListStatus.Active,
        name: undefined,
        email: undefined,
      });
      expect(result).toEqual({ items, total: 1, page: 2, limit: 5 });
    });

    it('applies default pagination values when none are provided', async () => {
      repository.paginate.mockResolvedValue([[], 0]);

      const result = await service.findAll({} as never);

      expect(repository.paginate).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: CollaboratorListStatus.Active,
        name: undefined,
        email: undefined,
      });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('forwards name and e-mail filters to the repository', async () => {
      repository.paginate.mockResolvedValue([[], 0]);

      await service.findAll({ page: 1, limit: 20, name: 'Ana', email: 'ana' });

      expect(repository.paginate).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        status: CollaboratorListStatus.Active,
        name: 'Ana',
        email: 'ana',
      });
    });

    it('forwards status filter to the repository', async () => {
      repository.paginate.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 1,
        limit: 20,
        status: CollaboratorListStatus.Deleted,
      });

      expect(repository.paginate).toHaveBeenCalledWith(
        expect.objectContaining({ status: CollaboratorListStatus.Deleted }),
      );
    });
  });

  describe('remove', () => {
    it('resolves without error when the active collaborator is soft-deleted', async () => {
      repository.softDeleteActive.mockResolvedValue(true);

      await expect(service.remove('some-id')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when the collaborator does not exist or was already removed', async () => {
      repository.softDeleteActive.mockResolvedValue(false);

      await expect(service.remove('some-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
