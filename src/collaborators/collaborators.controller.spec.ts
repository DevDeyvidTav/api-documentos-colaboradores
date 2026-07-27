import { Test } from '@nestjs/testing';
import { CollaboratorsController } from './collaborators.controller';
import { CollaboratorsService } from './collaborators.service';
import { Collaborator } from './entities/collaborator.entity';

type MockedService = {
  [K in keyof CollaboratorsService]: jest.Mock;
};

describe('CollaboratorsController', () => {
  let controller: CollaboratorsController;
  let service: MockedService;

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
      controllers: [CollaboratorsController],
      providers: [
        {
          provide: CollaboratorsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(CollaboratorsController);
    service = moduleRef.get(CollaboratorsService);
  });

  it('create() delegates to the service and maps the response DTO', async () => {
    const collaborator = buildCollaborator();
    service.create.mockResolvedValue(collaborator);

    const result = await controller.create({
      name: collaborator.name,
      email: collaborator.email,
    });

    expect(service.create).toHaveBeenCalledWith({
      name: collaborator.name,
      email: collaborator.email,
    });
    expect(result).toEqual({
      id: collaborator.id,
      name: collaborator.name,
      email: collaborator.email,
      createdAt: collaborator.createdAt,
      updatedAt: collaborator.updatedAt,
    });
  });

  it('findAll() delegates to the service and maps paginated items', async () => {
    const collaborator = buildCollaborator();
    service.findAll.mockResolvedValue({
      items: [collaborator],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.findAll({ page: 1, limit: 20 });

    expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      {
        id: collaborator.id,
        name: collaborator.name,
        email: collaborator.email,
        createdAt: collaborator.createdAt,
        updatedAt: collaborator.updatedAt,
      },
    ]);
  });

  it('findOne() delegates to the service and maps the response DTO', async () => {
    const collaborator = buildCollaborator();
    service.findOne.mockResolvedValue(collaborator);

    const result = await controller.findOne(collaborator.id);

    expect(service.findOne).toHaveBeenCalledWith(collaborator.id);
    expect(result.id).toBe(collaborator.id);
  });

  it('remove() delegates to the service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('some-id');

    expect(service.remove).toHaveBeenCalledWith('some-id');
  });
});
