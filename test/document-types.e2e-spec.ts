import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

interface DocumentTypeApiResponse {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

interface PaginatedDocumentTypesApiResponse {
  items: DocumentTypeApiResponse[];
  total: number;
  page: number;
  limit: number;
}

interface ErrorApiResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

describe('DocumentTypesController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    dataSource = moduleRef.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "document_requirement", "collaborator", "document_type" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "document_requirement", "collaborator", "document_type" RESTART IDENTITY CASCADE',
    );
    await app.close();
  });

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  const createDocumentType = (body: { name: string; description?: string }) =>
    request(server()).post('/document-types').send(body);

  describe('POST /document-types', () => {
    it('creates a document type and returns 201 with the created resource', async () => {
      const response = await createDocumentType({
        name: 'CPF',
        description: 'Cadastro de Pessoa Física',
      }).expect(201);
      const body = response.body as DocumentTypeApiResponse;

      expect(body).toMatchObject({
        name: 'CPF',
        description: 'Cadastro de Pessoa Física',
      });
      expect(body.id).toEqual(expect.any(String));
      expect(body.deletedAt).toBeUndefined();
    });

    it('creates a document type without description', async () => {
      const response = await createDocumentType({ name: 'RG' }).expect(201);
      const body = response.body as DocumentTypeApiResponse;

      expect(body.name).toBe('RG');
      expect(body.description).toBeNull();
    });

    it('rejects an empty name with 400', async () => {
      await createDocumentType({ name: '' }).expect(400);
    });

    it('rejects an invalid payload (extra fields) with 400', async () => {
      await request(server())
        .post('/document-types')
        .send({ name: 'ASO', extra: true })
        .expect(400);
    });

    it('rejects a duplicate name among active document types with 409', async () => {
      await createDocumentType({ name: 'CNH' }).expect(201);

      await createDocumentType({
        name: 'CNH',
        description: 'Outra descrição',
      }).expect(409);
    });

    it('allows reusing the name of a soft-deleted document type', async () => {
      const created = await createDocumentType({ name: 'ASO' }).expect(201);
      const { id } = created.body as DocumentTypeApiResponse;

      await request(server()).delete(`/document-types/${id}`).expect(204);

      await createDocumentType({ name: 'ASO' }).expect(201);
    });
  });

  describe('GET /document-types', () => {
    it('lists only active document types, paginated', async () => {
      await createDocumentType({ name: 'CPF' });
      const toDelete = await createDocumentType({ name: 'RG' });
      const { id } = toDelete.body as DocumentTypeApiResponse;
      await request(server()).delete(`/document-types/${id}`);

      const response = await request(server())
        .get('/document-types?page=1&limit=10')
        .expect(200);
      const body = response.body as PaginatedDocumentTypesApiResponse;

      expect(body.total).toBe(1);
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({ name: 'CPF' });
    });

    it('lists only deleted document types when status=deleted', async () => {
      await createDocumentType({ name: 'Ativo' });
      const toDelete = await createDocumentType({ name: 'Removido' });
      const { id } = toDelete.body as DocumentTypeApiResponse;
      await request(server()).delete(`/document-types/${id}`).expect(204);

      const response = await request(server())
        .get('/document-types?status=deleted')
        .expect(200);
      const body = response.body as PaginatedDocumentTypesApiResponse;

      expect(body.total).toBe(1);
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({ name: 'Removido' });
      expect(body.items[0].deletedAt).toEqual(expect.any(String));
    });

    it('lists active and deleted document types when status=all', async () => {
      await createDocumentType({ name: 'Ativo' });
      const toDelete = await createDocumentType({ name: 'Removido' });
      const { id } = toDelete.body as DocumentTypeApiResponse;
      await request(server()).delete(`/document-types/${id}`).expect(204);

      const response = await request(server())
        .get('/document-types?status=all')
        .expect(200);
      const body = response.body as PaginatedDocumentTypesApiResponse;

      expect(body.total).toBe(2);
      expect(body.items).toHaveLength(2);
    });

    it('rejects an invalid status with 400', async () => {
      await request(server())
        .get('/document-types?status=invalido')
        .expect(400);
    });

    it('filters by name (partial match)', async () => {
      await createDocumentType({ name: 'Certidão de Nascimento' });
      await createDocumentType({ name: 'Certidão de Casamento' });
      await createDocumentType({ name: 'CNH' });

      const response = await request(server())
        .get('/document-types?name=certid')
        .expect(200);
      const body = response.body as PaginatedDocumentTypesApiResponse;

      expect(body.total).toBe(2);
      expect(body.items.every((item) => item.name.includes('Certidão'))).toBe(
        true,
      );
    });

    it('rejects a limit above the maximum allowed with 400', async () => {
      await request(server()).get('/document-types?limit=1000').expect(400);
    });
  });

  describe('GET /document-types/:id', () => {
    it('returns the document type when it exists and is active', async () => {
      const created = await createDocumentType({
        name: 'Comprovante de Residência',
      });
      const { id } = created.body as DocumentTypeApiResponse;

      const response = await request(server())
        .get(`/document-types/${id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Comprovante de Residência',
      });
    });

    it('returns 404 for an id that does not exist', async () => {
      await request(server())
        .get('/document-types/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await request(server()).get('/document-types/not-a-uuid').expect(400);
    });
  });

  describe('DELETE /document-types/:id', () => {
    it('soft deletes the document type and excludes it from future reads', async () => {
      const created = await createDocumentType({ name: 'Delete Me' });
      const { id } = created.body as DocumentTypeApiResponse;

      await request(server()).delete(`/document-types/${id}`).expect(204);
      await request(server()).get(`/document-types/${id}`).expect(404);
    });

    it('returns 404 when deleting an already-deleted document type', async () => {
      const created = await createDocumentType({ name: 'Delete Twice' });
      const { id } = created.body as DocumentTypeApiResponse;

      await request(server()).delete(`/document-types/${id}`).expect(204);
      await request(server()).delete(`/document-types/${id}`).expect(404);
    });

    it('returns 404 when deleting an id that does not exist', async () => {
      await request(server())
        .delete('/document-types/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  it('returns the standardized error body shape for a 404 response', async () => {
    const response = await request(server())
      .get('/document-types/00000000-0000-0000-0000-000000000000')
      .expect(404);
    const body = response.body as ErrorApiResponse;

    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(body).toMatchObject({
      statusCode: 404,
      error: expect.any(String),
      message: expect.any(String),
      timestamp: expect.any(String),
      path: '/document-types/00000000-0000-0000-0000-000000000000',
    });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  });
});
