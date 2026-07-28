import { Test } from '@nestjs/testing';
import { DocumentTypesController } from './document-types.controller';
import { DocumentTypesService } from './document-types.service';
import { DocumentType } from './entities/document-type.entity';

type MockedService = {
  [K in keyof DocumentTypesService]: jest.Mock;
};

describe('DocumentTypesController', () => {
  let controller: DocumentTypesController;
  let service: MockedService;

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
      controllers: [DocumentTypesController],
      providers: [
        {
          provide: DocumentTypesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(DocumentTypesController);
    service = moduleRef.get(DocumentTypesService);
  });

  it('create() delegates to the service and maps the response DTO', async () => {
    const documentType = buildDocumentType();
    service.create.mockResolvedValue(documentType);

    const result = await controller.create({
      name: documentType.name,
      description: documentType.description ?? undefined,
    });

    expect(service.create).toHaveBeenCalledWith({
      name: documentType.name,
      description: documentType.description ?? undefined,
    });
    expect(result).toEqual({
      id: documentType.id,
      name: documentType.name,
      description: documentType.description,
      createdAt: documentType.createdAt,
      updatedAt: documentType.updatedAt,
    });
  });

  it('findAll() delegates to the service and maps paginated items', async () => {
    const documentType = buildDocumentType();
    service.findAll.mockResolvedValue({
      items: [documentType],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.findAll({ page: 1, limit: 20 });

    expect(service.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      {
        id: documentType.id,
        name: documentType.name,
        description: documentType.description,
        createdAt: documentType.createdAt,
        updatedAt: documentType.updatedAt,
      },
    ]);
  });

  it('findOne() delegates to the service and maps the response DTO', async () => {
    const documentType = buildDocumentType();
    service.findOne.mockResolvedValue(documentType);

    const result = await controller.findOne(documentType.id);

    expect(service.findOne).toHaveBeenCalledWith(documentType.id);
    expect(result.id).toBe(documentType.id);
  });

  it('remove() delegates to the service', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('some-id');

    expect(service.remove).toHaveBeenCalledWith('some-id');
  });
});
