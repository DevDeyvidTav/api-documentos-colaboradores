import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { DocumentVersionsRepository } from '../src/document-versions/document-versions.repository';

interface CollaboratorApiResponse {
  id: string;
}

interface DocumentTypeApiResponse {
  id: string;
}

interface DocumentRequirementApiResponse {
  id: string;
}

interface DocumentVersionApiResponse {
  id: string;
  requirementId: string;
  versionNumber: number;
  isActive: boolean;
  documentReference: string;
  submittedAt: string;
  createdAt: string;
}

describe('DocumentVersionsController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
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

  const seedRequirement = async () => {
    const collaborator = await request(server())
      .post('/collaborators')
      .send({ name: 'Deyvid Tavares', email: 'deyvid@email.com' })
      .expect(201);
    const documentType = await request(server())
      .post('/document-types')
      .send({ name: 'CPF', description: 'Cadastro de Pessoa Física' })
      .expect(201);
    const requirement = await request(server())
      .post('/document-requirements')
      .send({
        collaboratorId: (collaborator.body as CollaboratorApiResponse).id,
        documentTypeId: (documentType.body as DocumentTypeApiResponse).id,
      })
      .expect(201);

    return {
      collaboratorId: (collaborator.body as CollaboratorApiResponse).id,
      documentTypeId: (documentType.body as DocumentTypeApiResponse).id,
      requirementId: (requirement.body as DocumentRequirementApiResponse).id,
    };
  };

  const submitVersion = (requirementId: string, documentReference: string) =>
    request(server())
      .post(`/document-requirements/${requirementId}/versions`)
      .send({ documentReference });

  describe('POST /document-requirements/:requirementId/versions', () => {
    it('creates version 1 as active on first submission', async () => {
      const { requirementId } = await seedRequirement();

      const response = await submitVersion(
        requirementId,
        'documents/collaborator-123/cpf-v1.pdf',
      ).expect(201);
      const body = response.body as DocumentVersionApiResponse;

      expect(body.versionNumber).toBe(1);
      expect(body.isActive).toBe(true);
      expect(body.requirementId).toBe(requirementId);
      expect(body.documentReference).toBe(
        'documents/collaborator-123/cpf-v1.pdf',
      );
    });

    it('on resubmit creates version 2, keeps version 1 inactive, activates version 2', async () => {
      const { requirementId } = await seedRequirement();

      const first = await submitVersion(
        requirementId,
        'documents/collaborator-123/cpf-v1.pdf',
      ).expect(201);
      const second = await submitVersion(
        requirementId,
        'documents/collaborator-123/cpf-v2.pdf',
      ).expect(201);

      const firstBody = first.body as DocumentVersionApiResponse;
      const secondBody = second.body as DocumentVersionApiResponse;

      expect(secondBody.versionNumber).toBe(2);
      expect(secondBody.isActive).toBe(true);

      const history = await request(server())
        .get(`/document-requirements/${requirementId}/versions`)
        .expect(200);
      const versions = history.body as DocumentVersionApiResponse[];

      expect(versions).toHaveLength(2);
      expect(versions[0]).toMatchObject({
        id: secondBody.id,
        versionNumber: 2,
        isActive: true,
      });
      expect(versions[1]).toMatchObject({
        id: firstBody.id,
        versionNumber: 1,
        isActive: false,
      });
    });

    it('returns 404 for a non-existent requirement', async () => {
      await submitVersion(
        '00000000-0000-0000-0000-000000000000',
        'documents/x.pdf',
      ).expect(404);
    });

    it('returns 404 for a soft-deleted requirement', async () => {
      const { requirementId } = await seedRequirement();
      await request(server())
        .delete(`/document-requirements/${requirementId}`)
        .expect(204);

      await submitVersion(requirementId, 'documents/x.pdf').expect(404);
    });

    it('returns 404 when the related collaborator is soft-deleted', async () => {
      const { requirementId, collaboratorId } = await seedRequirement();
      await request(server())
        .delete(`/collaborators/${collaboratorId}`)
        .expect(204);

      await submitVersion(requirementId, 'documents/x.pdf').expect(404);
    });

    it('returns 404 when the related document type is soft-deleted', async () => {
      const { requirementId, documentTypeId } = await seedRequirement();
      await request(server())
        .delete(`/document-types/${documentTypeId}`)
        .expect(204);

      await submitVersion(requirementId, 'documents/x.pdf').expect(404);
    });

    it('rejects an invalid requirement UUID with 400', async () => {
      await submitVersion('not-a-uuid', 'documents/x.pdf').expect(400);
    });

    it('rejects an empty documentReference with 400', async () => {
      const { requirementId } = await seedRequirement();
      await submitVersion(requirementId, '').expect(400);
    });

    it('rejects extra fields with 400', async () => {
      const { requirementId } = await seedRequirement();
      await request(server())
        .post(`/document-requirements/${requirementId}/versions`)
        .send({
          documentReference: 'documents/x.pdf',
          extra: true,
        })
        .expect(400);
    });

    it('rolls back when creating the new version fails after deactivation', async () => {
      const { requirementId } = await seedRequirement();
      await submitVersion(
        requirementId,
        'documents/collaborator-123/cpf-v1.pdf',
      ).expect(201);

      const versionsRepository = moduleRef.get(DocumentVersionsRepository);
      const spy = jest
        .spyOn(versionsRepository, 'createActiveVersion')
        .mockRejectedValueOnce(new Error('forced persistence failure'));

      await submitVersion(
        requirementId,
        'documents/collaborator-123/cpf-v2.pdf',
      ).expect(500);

      spy.mockRestore();

      const history = await request(server())
        .get(`/document-requirements/${requirementId}/versions`)
        .expect(200);
      const versions = history.body as DocumentVersionApiResponse[];

      expect(versions).toHaveLength(1);
      expect(versions[0]).toMatchObject({
        versionNumber: 1,
        isActive: true,
      });
    });
  });

  describe('GET /document-requirements/:requirementId/versions', () => {
    it('returns full history ordered by versionNumber DESC with a single active version', async () => {
      const { requirementId } = await seedRequirement();
      await submitVersion(requirementId, 'documents/v1.pdf').expect(201);
      await submitVersion(requirementId, 'documents/v2.pdf').expect(201);
      await submitVersion(requirementId, 'documents/v3.pdf').expect(201);

      const response = await request(server())
        .get(`/document-requirements/${requirementId}/versions`)
        .expect(200);
      const versions = response.body as DocumentVersionApiResponse[];

      expect(versions.map((v) => v.versionNumber)).toEqual([3, 2, 1]);
      expect(versions.filter((v) => v.isActive)).toHaveLength(1);
      expect(versions[0].isActive).toBe(true);
    });

    it('returns 404 for a soft-deleted requirement', async () => {
      const { requirementId } = await seedRequirement();
      await submitVersion(requirementId, 'documents/v1.pdf').expect(201);
      await request(server())
        .delete(`/document-requirements/${requirementId}`)
        .expect(204);

      await request(server())
        .get(`/document-requirements/${requirementId}/versions`)
        .expect(404);
    });
  });

  describe('GET /document-versions/:id', () => {
    it('returns the version by id', async () => {
      const { requirementId } = await seedRequirement();
      const created = await submitVersion(
        requirementId,
        'documents/v1.pdf',
      ).expect(201);
      const { id } = created.body as DocumentVersionApiResponse;

      const response = await request(server())
        .get(`/document-versions/${id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id,
        versionNumber: 1,
        isActive: true,
      });
    });

    it('returns 404 for a non-existent version', async () => {
      await request(server())
        .get('/document-versions/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await request(server()).get('/document-versions/not-a-uuid').expect(400);
    });
  });
});
