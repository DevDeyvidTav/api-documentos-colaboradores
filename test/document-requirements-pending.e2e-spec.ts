import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

interface CollaboratorApiResponse {
  id: string;
  name: string;
}

interface DocumentTypeApiResponse {
  id: string;
  name: string;
}

interface DocumentRequirementApiResponse {
  id: string;
}

interface PendingItemApiResponse {
  requirementId: string;
  collaborator: { id: string; name: string; email: string };
  documentType: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

interface PendingPaginatedApiResponse {
  items: PendingItemApiResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

describe('DocumentRequirements pending (e2e)', () => {
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
      'TRUNCATE TABLE "document_version", "document_requirement", "collaborator", "document_type" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "document_version", "document_requirement", "collaborator", "document_type" RESTART IDENTITY CASCADE',
    );
    await app.close();
  });

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  const seedRequirement = async (options?: {
    collaboratorName?: string;
    collaboratorEmail?: string;
    documentTypeName?: string;
  }) => {
    const collaborator = await request(server())
      .post('/collaborators')
      .send({
        name: options?.collaboratorName ?? 'Deyvid Tavares',
        email: options?.collaboratorEmail ?? 'deyvid@email.com',
      })
      .expect(201);
    const documentType = await request(server())
      .post('/document-types')
      .send({
        name: options?.documentTypeName ?? 'CPF',
        description: 'Cadastro de Pessoa Física',
      })
      .expect(201);
    const requirement = await request(server())
      .post('/document-requirements')
      .send({
        collaboratorId: (collaborator.body as CollaboratorApiResponse).id,
        documentTypeId: (documentType.body as DocumentTypeApiResponse).id,
      })
      .expect(201);

    return {
      collaborator: collaborator.body as CollaboratorApiResponse,
      documentType: documentType.body as DocumentTypeApiResponse,
      requirementId: (requirement.body as DocumentRequirementApiResponse).id,
    };
  };

  const submitVersion = (requirementId: string, documentReference: string) =>
    request(server())
      .post(`/document-requirements/${requirementId}/versions`)
      .set('Idempotency-Key', randomUUID())
      .send({ documentReference });

  describe('GET /document-requirements/pending', () => {
    it('returns a requirement without versions as pending', async () => {
      const seeded = await seedRequirement();

      const response = await request(server())
        .get('/document-requirements/pending')
        .expect(200);
      const body = response.body as PendingPaginatedApiResponse;

      expect(body.total).toBe(1);
      expect(body.totalPages).toBe(1);
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        requirementId: seeded.requirementId,
        collaborator: {
          id: seeded.collaborator.id,
          name: 'Deyvid Tavares',
        },
        documentType: {
          id: seeded.documentType.id,
          name: 'CPF',
        },
      });
    });

    it('excludes requirements that have an active version', async () => {
      const seeded = await seedRequirement();
      await submitVersion(seeded.requirementId, 'documents/cpf-v1.pdf').expect(
        201,
      );

      const response = await request(server())
        .get('/document-requirements/pending')
        .expect(200);
      const body = response.body as PendingPaginatedApiResponse;

      expect(body.total).toBe(0);
      expect(body.items).toHaveLength(0);
      expect(body.totalPages).toBe(0);
    });

    it('excludes requirements when an inactive version exists but an active one is present', async () => {
      const seeded = await seedRequirement();
      await submitVersion(seeded.requirementId, 'documents/cpf-v1.pdf').expect(
        201,
      );
      await submitVersion(seeded.requirementId, 'documents/cpf-v2.pdf').expect(
        201,
      );

      const response = await request(server())
        .get('/document-requirements/pending')
        .expect(200);

      expect((response.body as PendingPaginatedApiResponse).total).toBe(0);
    });

    it('excludes soft-deleted requirements from the default pending list', async () => {
      const seeded = await seedRequirement();
      await request(server())
        .delete(`/document-requirements/${seeded.requirementId}`)
        .expect(204);

      const response = await request(server())
        .get('/document-requirements/pending')
        .expect(200);

      expect((response.body as PendingPaginatedApiResponse).total).toBe(0);
    });

    it('filters pending requirements by collaboratorId', async () => {
      const first = await seedRequirement({
        collaboratorEmail: 'first@email.com',
        documentTypeName: 'CPF',
      });
      await seedRequirement({
        collaboratorName: 'Ana Silva',
        collaboratorEmail: 'ana@email.com',
        documentTypeName: 'RG',
      });

      const response = await request(server())
        .get(
          `/document-requirements/pending?collaboratorId=${first.collaborator.id}`,
        )
        .expect(200);
      const body = response.body as PendingPaginatedApiResponse;

      expect(body.total).toBe(1);
      expect(body.items[0].collaborator.id).toBe(first.collaborator.id);
    });

    it('filters pending requirements by documentTypeId', async () => {
      const first = await seedRequirement({
        collaboratorEmail: 'first@email.com',
        documentTypeName: 'CPF',
      });
      await seedRequirement({
        collaboratorName: 'Ana Silva',
        collaboratorEmail: 'ana@email.com',
        documentTypeName: 'RG',
      });

      const response = await request(server())
        .get(
          `/document-requirements/pending?documentTypeId=${first.documentType.id}`,
        )
        .expect(200);
      const body = response.body as PendingPaginatedApiResponse;

      expect(body.total).toBe(1);
      expect(body.items[0].documentType.id).toBe(first.documentType.id);
    });

    it('paginates pending requirements', async () => {
      await seedRequirement({
        collaboratorEmail: 'a@email.com',
        documentTypeName: 'CPF',
      });
      await seedRequirement({
        collaboratorName: 'Ana',
        collaboratorEmail: 'b@email.com',
        documentTypeName: 'RG',
      });
      await seedRequirement({
        collaboratorName: 'Bruno',
        collaboratorEmail: 'c@email.com',
        documentTypeName: 'CNH',
      });

      const response = await request(server())
        .get('/document-requirements/pending?page=1&limit=2')
        .expect(200);
      const body = response.body as PendingPaginatedApiResponse;

      expect(body.total).toBe(3);
      expect(body.items).toHaveLength(2);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(2);
      expect(body.totalPages).toBe(2);
    });

    it('returns an empty list with 200 when there are no pending requirements', async () => {
      const response = await request(server())
        .get('/document-requirements/pending')
        .expect(200);
      const body = response.body as PendingPaginatedApiResponse;

      expect(body).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });

    it('rejects an invalid status with 400', async () => {
      await request(server())
        .get('/document-requirements/pending?status=invalid')
        .expect(400);
    });

    it('rejects an invalid collaboratorId UUID with 400', async () => {
      await request(server())
        .get('/document-requirements/pending?collaboratorId=not-a-uuid')
        .expect(400);
    });
  });
});
