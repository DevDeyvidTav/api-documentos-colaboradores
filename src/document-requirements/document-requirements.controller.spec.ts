import { Test } from '@nestjs/testing';
import { Collaborator } from '../collaborators/entities/collaborator.entity';
import { DocumentType } from '../document-types/entities/document-type.entity';
import { DocumentRequirementsController } from './document-requirements.controller';
import { DocumentRequirementsService } from './document-requirements.service';
import { DocumentRequirement } from './entities/document-requirement.entity';

type MockedService = {
  [K in keyof DocumentRequirementsService]: jest.Mock;
};

describe('DocumentRequirementsController', () => {
  let controller: DocumentRequirementsController;
  let service: MockedService;

  const buildRequirement = (
    overrides: Partial<DocumentRequirement> = {},
  ): DocumentRequirement => {
    const collaborator: Collaborator = {
      id: 'a5f2d9d0-1c1a-4b8a-9d3b-000000000001',
      name: 'Deyvid Tavares',
      email: 'deyvid@email.com',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
    };
    const documentType: DocumentType = {
      id: 'b5f2d9d0-1c1a-4b8a-9d3b-000000000001',
      name: 'CPF',
      description: 'Cadastro de Pessoa Física',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
    };
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
      controllers: [DocumentRequirementsController],
      providers: [
        {
          provide: DocumentRequirementsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findPending: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(DocumentRequirementsController);
    service = moduleRef.get(DocumentRequirementsService);
  });

  it('create() delegates to the service and maps the nested response DTO', async () => {
    const requirement = buildRequirement();
    service.create.mockResolvedValue(requirement);

    const result = await controller.create({
      collaboratorId: requirement.collaboratorId,
      documentTypeId: requirement.documentTypeId,
    });

    expect(service.create).toHaveBeenCalledWith({
      collaboratorId: requirement.collaboratorId,
      documentTypeId: requirement.documentTypeId,
    });
    expect(result).toEqual({
      id: requirement.id,
      collaborator: {
        id: requirement.collaborator.id,
        name: requirement.collaborator.name,
        email: requirement.collaborator.email,
      },
      documentType: {
        id: requirement.documentType.id,
        name: requirement.documentType.name,
        description: requirement.documentType.description,
      },
      createdAt: requirement.createdAt,
      updatedAt: requirement.updatedAt,
    });
  });

  it('findAll() delegates to the service and maps paginated items', async () => {
    const requirement = buildRequirement();
    service.findAll.mockResolvedValue({
      items: [requirement],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.findAll({ page: 1, limit: 20 });

    expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result.total).toBe(1);
    expect(result.items[0].collaborator.name).toBe('Deyvid Tavares');
    expect(result.items[0].documentType.name).toBe('CPF');
  });

  it('findPending() maps pending DTOs with totalPages', async () => {
    const requirement = buildRequirement();
    service.findPending.mockResolvedValue({
      items: [requirement],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const result = await controller.findPending({ page: 1, limit: 20 });

    expect(service.findPending).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result).toEqual({
      items: [
        {
          requirementId: requirement.id,
          collaborator: {
            id: requirement.collaborator.id,
            name: requirement.collaborator.name,
            email: requirement.collaborator.email,
          },
          documentType: {
            id: requirement.documentType.id,
            name: requirement.documentType.name,
          },
          createdAt: requirement.createdAt,
          updatedAt: requirement.updatedAt,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it('findOne() delegates to the service and maps the response DTO', async () => {
    const requirement = buildRequirement();
    service.findOne.mockResolvedValue(requirement);

    const result = await controller.findOne(requirement.id);

    expect(service.findOne).toHaveBeenCalledWith(requirement.id);
    expect(result.id).toBe(requirement.id);
  });

  it('remove() delegates to the service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('some-id');

    expect(service.remove).toHaveBeenCalledWith('some-id');
  });
});
