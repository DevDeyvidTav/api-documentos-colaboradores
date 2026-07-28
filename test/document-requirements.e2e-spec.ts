import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

interface CollaboratorApiResponse {
  id: string;
  name: string;
  email: string;
}

interface DocumentTypeApiResponse {
  id: string;
  name: string;
  description?: string | null;
}

interface DocumentRequirementApiResponse {
  id: string;
  collaborator: CollaboratorApiResponse;
  documentType: DocumentTypeApiResponse;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

interface PaginatedDocumentRequirementsApiResponse {
  items: DocumentRequirementApiResponse[];
  total: number;
  page: number;
  limit: number;
}

describe('DocumentRequirementsController (e2e)', () => {
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

  const createCollaborator = (body: { name: string; email: string }) =>
    request(server()).post('/collaborators').send(body);

  const createDocumentType = (body: { name: string; description?: string }) =>
    request(server()).post('/document-types').send(body);

  const createRequirement = (body: {
    collaboratorId: string;
    documentTypeId: string;
  }) => request(server()).post('/document-requirements').send(body);

  const seedActivePair = async () => {
    const collaboratorResponse = await createCollaborator({
      name: 'Deyvid Tavares',
      email: 'deyvid@email.com',
    }).expect(201);
    const documentTypeResponse = await createDocumentType({
      name: 'CPF',
      description: 'Cadastro de Pessoa Física',
    }).expect(201);

    return {
      collaborator: collaboratorResponse.body as CollaboratorApiResponse,
      documentType: documentTypeResponse.body as DocumentTypeApiResponse,
    };
  };

  describe('POST /document-requirements', () => {
    it('creates a requirement and returns 201 with nested relations', async () => {
      const { collaborator, documentType } = await seedActivePair();

      const response = await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);
      const body = response.body as DocumentRequirementApiResponse;

      expect(body.id).toEqual(expect.any(String));
      expect(body.collaborator).toMatchObject({
        id: collaborator.id,
        name: 'Deyvid Tavares',
        email: 'deyvid@email.com',
      });
      expect(body.documentType).toMatchObject({
        id: documentType.id,
        name: 'CPF',
        description: 'Cadastro de Pessoa Física',
      });
      expect(body.deletedAt).toBeUndefined();
    });

    it('returns 404 for a non-existent collaborator', async () => {
      const documentTypeResponse = await createDocumentType({
        name: 'RG',
      }).expect(201);
      const documentType = documentTypeResponse.body as DocumentTypeApiResponse;

      await createRequirement({
        collaboratorId: '00000000-0000-0000-0000-000000000000',
        documentTypeId: documentType.id,
      }).expect(404);
    });

    it('returns 404 for a soft-deleted collaborator', async () => {
      const { collaborator, documentType } = await seedActivePair();
      await request(server())
        .delete(`/collaborators/${collaborator.id}`)
        .expect(204);

      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(404);
    });

    it('returns 404 for a non-existent document type', async () => {
      const collaboratorResponse = await createCollaborator({
        name: 'Ana',
        email: 'ana@email.com',
      }).expect(201);
      const collaborator = collaboratorResponse.body as CollaboratorApiResponse;

      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: '00000000-0000-0000-0000-000000000000',
      }).expect(404);
    });

    it('returns 404 for a soft-deleted document type', async () => {
      const { collaborator, documentType } = await seedActivePair();
      await request(server())
        .delete(`/document-types/${documentType.id}`)
        .expect(204);

      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(404);
    });

    it('returns 409 for a duplicate active requirement', async () => {
      const { collaborator, documentType } = await seedActivePair();
      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);

      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(409);
    });

    it('allows recreating the same link after soft delete', async () => {
      const { collaborator, documentType } = await seedActivePair();
      const created = await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);
      const { id } = created.body as DocumentRequirementApiResponse;

      await request(server())
        .delete(`/document-requirements/${id}`)
        .expect(204);

      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);
    });

    it('rejects an invalid UUID with 400', async () => {
      await createRequirement({
        collaboratorId: 'not-a-uuid',
        documentTypeId: 'also-not-a-uuid',
      }).expect(400);
    });

    it('rejects extra fields with 400', async () => {
      const { collaborator, documentType } = await seedActivePair();

      await request(server())
        .post('/document-requirements')
        .send({
          collaboratorId: collaborator.id,
          documentTypeId: documentType.id,
          extra: true,
        })
        .expect(400);
    });

    it('handles concurrent create attempts with partial unique constraint', async () => {
      const { collaborator, documentType } = await seedActivePair();
      const payload = {
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      };

      const [first, second] = await Promise.all([
        createRequirement(payload),
        createRequirement(payload),
      ]);

      const statuses = [first.status, second.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);

      const list = await request(server())
        .get('/document-requirements')
        .expect(200);
      const body = list.body as PaginatedDocumentRequirementsApiResponse;
      expect(body.total).toBe(1);
      expect(body.items).toHaveLength(1);
    });
  });

  describe('GET /document-requirements', () => {
    it('lists only active requirements by default', async () => {
      const { collaborator, documentType } = await seedActivePair();
      const secondType = await createDocumentType({ name: 'RG' }).expect(201);
      const secondTypeBody = secondType.body as DocumentTypeApiResponse;

      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);
      const toDelete = await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: secondTypeBody.id,
      }).expect(201);
      const { id } = toDelete.body as DocumentRequirementApiResponse;
      await request(server())
        .delete(`/document-requirements/${id}`)
        .expect(204);

      const response = await request(server())
        .get('/document-requirements')
        .expect(200);
      const body = response.body as PaginatedDocumentRequirementsApiResponse;

      expect(body.total).toBe(1);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].documentType.name).toBe('CPF');
    });

    it('paginates correctly', async () => {
      const { collaborator } = await seedActivePair();
      const typeA = await createDocumentType({ name: 'ASO' }).expect(201);
      const typeB = await createDocumentType({ name: 'CNH' }).expect(201);
      const typeABody = typeA.body as DocumentTypeApiResponse;
      const typeBBody = typeB.body as DocumentTypeApiResponse;

      // seedActivePair already created CPF; create two more requirements
      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: typeABody.id,
      }).expect(201);
      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: typeBBody.id,
      }).expect(201);

      // Also link the CPF from seed
      const cpf = await request(server()).get('/document-types?name=CPF');
      const cpfId = (cpf.body as { items: DocumentTypeApiResponse[] }).items[0]
        .id;
      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: cpfId,
      }).expect(201);

      const response = await request(server())
        .get('/document-requirements?page=1&limit=2')
        .expect(200);
      const body = response.body as PaginatedDocumentRequirementsApiResponse;

      expect(body.total).toBe(3);
      expect(body.items).toHaveLength(2);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(2);
    });

    it('filters by collaboratorId', async () => {
      const first = await seedActivePair();
      const secondCollaborator = await createCollaborator({
        name: 'Ana',
        email: 'ana@email.com',
      }).expect(201);
      const secondCollaboratorBody =
        secondCollaborator.body as CollaboratorApiResponse;

      await createRequirement({
        collaboratorId: first.collaborator.id,
        documentTypeId: first.documentType.id,
      }).expect(201);
      await createRequirement({
        collaboratorId: secondCollaboratorBody.id,
        documentTypeId: first.documentType.id,
      }).expect(201);

      const response = await request(server())
        .get(`/document-requirements?collaboratorId=${first.collaborator.id}`)
        .expect(200);
      const body = response.body as PaginatedDocumentRequirementsApiResponse;

      expect(body.total).toBe(1);
      expect(body.items[0].collaborator.id).toBe(first.collaborator.id);
    });

    it('filters by documentTypeId', async () => {
      const { collaborator, documentType } = await seedActivePair();
      const otherType = await createDocumentType({ name: 'RG' }).expect(201);
      const otherTypeBody = otherType.body as DocumentTypeApiResponse;

      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);
      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: otherTypeBody.id,
      }).expect(201);

      const response = await request(server())
        .get(`/document-requirements?documentTypeId=${documentType.id}`)
        .expect(200);
      const body = response.body as PaginatedDocumentRequirementsApiResponse;

      expect(body.total).toBe(1);
      expect(body.items[0].documentType.id).toBe(documentType.id);
    });

    it('lists only deleted requirements when status=deleted', async () => {
      const { collaborator, documentType } = await seedActivePair();
      const otherType = await createDocumentType({ name: 'RG' }).expect(201);
      const otherTypeBody = otherType.body as DocumentTypeApiResponse;

      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);
      const toDelete = await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: otherTypeBody.id,
      }).expect(201);
      const { id } = toDelete.body as DocumentRequirementApiResponse;
      await request(server())
        .delete(`/document-requirements/${id}`)
        .expect(204);

      const response = await request(server())
        .get('/document-requirements?status=deleted')
        .expect(200);
      const body = response.body as PaginatedDocumentRequirementsApiResponse;

      expect(body.total).toBe(1);
      expect(body.items[0].documentType.name).toBe('RG');
      expect(body.items[0].deletedAt).toEqual(expect.any(String));
    });

    it('lists active and deleted requirements when status=all', async () => {
      const { collaborator, documentType } = await seedActivePair();
      const otherType = await createDocumentType({ name: 'RG' }).expect(201);
      const otherTypeBody = otherType.body as DocumentTypeApiResponse;

      await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);
      const toDelete = await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: otherTypeBody.id,
      }).expect(201);
      const { id } = toDelete.body as DocumentRequirementApiResponse;
      await request(server())
        .delete(`/document-requirements/${id}`)
        .expect(204);

      const response = await request(server())
        .get('/document-requirements?status=all')
        .expect(200);
      const body = response.body as PaginatedDocumentRequirementsApiResponse;

      expect(body.total).toBe(2);
      expect(body.items).toHaveLength(2);
    });

    it('does not return deleted requirements in the default mode', async () => {
      const { collaborator, documentType } = await seedActivePair();
      const created = await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);
      const { id } = created.body as DocumentRequirementApiResponse;
      await request(server())
        .delete(`/document-requirements/${id}`)
        .expect(204);

      const response = await request(server())
        .get('/document-requirements')
        .expect(200);
      const body = response.body as PaginatedDocumentRequirementsApiResponse;

      expect(body.total).toBe(0);
      expect(body.items).toHaveLength(0);
    });
  });

  describe('GET /document-requirements/:id', () => {
    it('returns an active requirement', async () => {
      const { collaborator, documentType } = await seedActivePair();
      const created = await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);
      const { id } = created.body as DocumentRequirementApiResponse;

      const response = await request(server())
        .get(`/document-requirements/${id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id,
        collaborator: { id: collaborator.id },
        documentType: { id: documentType.id },
      });
    });

    it('returns 404 for a non-existent id', async () => {
      await request(server())
        .get('/document-requirements/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('returns 404 for a soft-deleted requirement', async () => {
      const { collaborator, documentType } = await seedActivePair();
      const created = await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);
      const { id } = created.body as DocumentRequirementApiResponse;
      await request(server())
        .delete(`/document-requirements/${id}`)
        .expect(204);

      await request(server()).get(`/document-requirements/${id}`).expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await request(server())
        .get('/document-requirements/not-a-uuid')
        .expect(400);
    });
  });

  describe('DELETE /document-requirements/:id', () => {
    it('soft deletes the requirement and excludes it from active reads', async () => {
      const { collaborator, documentType } = await seedActivePair();
      const created = await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);
      const { id } = created.body as DocumentRequirementApiResponse;

      await request(server())
        .delete(`/document-requirements/${id}`)
        .expect(204);
      await request(server()).get(`/document-requirements/${id}`).expect(404);

      const list = await request(server())
        .get('/document-requirements')
        .expect(200);
      expect(
        (list.body as PaginatedDocumentRequirementsApiResponse).total,
      ).toBe(0);
    });

    it('returns 404 when deleting an already-deleted requirement', async () => {
      const { collaborator, documentType } = await seedActivePair();
      const created = await createRequirement({
        collaboratorId: collaborator.id,
        documentTypeId: documentType.id,
      }).expect(201);
      const { id } = created.body as DocumentRequirementApiResponse;

      await request(server())
        .delete(`/document-requirements/${id}`)
        .expect(204);
      await request(server())
        .delete(`/document-requirements/${id}`)
        .expect(404);
    });

    it('returns 404 when deleting a non-existent requirement', async () => {
      await request(server())
        .delete('/document-requirements/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
