import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
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

  const submitVersion = (
    requirementId: string,
    documentReference: string,
    idempotencyKey: string = randomUUID(),
  ) =>
    request(server())
      .post(`/document-requirements/${requirementId}/versions`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ documentReference });

  const submitVersionWithoutKey = (
    requirementId: string,
    documentReference: string,
  ) =>
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

  describe('concurrency', () => {
    it('serializes two simultaneous resubmits into versions 2 and 3', async () => {
      const { requirementId } = await seedRequirement();
      await submitVersion(requirementId, 'documents/v1.pdf').expect(201);

      const [first, second] = await Promise.all([
        submitVersion(requirementId, 'documents/concurrent-a.pdf'),
        submitVersion(requirementId, 'documents/concurrent-b.pdf'),
      ]);

      expect([first.status, second.status].sort((a, b) => a - b)).toEqual([
        201, 201,
      ]);

      const versionNumbers = [
        (first.body as DocumentVersionApiResponse).versionNumber,
        (second.body as DocumentVersionApiResponse).versionNumber,
      ].sort((a, b) => a - b);
      expect(versionNumbers).toEqual([2, 3]);

      const history = await request(server())
        .get(`/document-requirements/${requirementId}/versions`)
        .expect(200);
      const versions = history.body as DocumentVersionApiResponse[];

      expect(versions).toHaveLength(3);
      expect(
        versions.map((v) => v.versionNumber).sort((a, b) => a - b),
      ).toEqual([1, 2, 3]);
      expect(versions.filter((v) => v.isActive)).toHaveLength(1);
      expect(versions.find((v) => v.versionNumber === 3)?.isActive).toBe(true);
      expect(versions.find((v) => v.versionNumber === 1)?.isActive).toBe(false);
    });

    it('serializes three simultaneous resubmits into versions 2, 3 and 4', async () => {
      const { requirementId } = await seedRequirement();
      await submitVersion(requirementId, 'documents/v1.pdf').expect(201);

      const responses = await Promise.all([
        submitVersion(requirementId, 'documents/c1.pdf'),
        submitVersion(requirementId, 'documents/c2.pdf'),
        submitVersion(requirementId, 'documents/c3.pdf'),
      ]);

      expect(responses.every((response) => response.status === 201)).toBe(true);

      const numbers = responses
        .map(
          (response) =>
            (response.body as DocumentVersionApiResponse).versionNumber,
        )
        .sort((a, b) => a - b);
      expect(numbers).toEqual([2, 3, 4]);

      const history = await request(server())
        .get(`/document-requirements/${requirementId}/versions`)
        .expect(200);
      const versions = history.body as DocumentVersionApiResponse[];

      expect(versions).toHaveLength(4);
      expect(new Set(versions.map((v) => v.versionNumber)).size).toBe(4);
      expect(versions.filter((v) => v.isActive)).toHaveLength(1);
      expect(versions.find((v) => v.versionNumber === 4)?.isActive).toBe(true);
    });

    it('allows simultaneous submits on different requirements without cross-blocking failures', async () => {
      const first = await seedRequirement();
      const secondCollaborator = await request(server())
        .post('/collaborators')
        .send({ name: 'Ana Silva', email: 'ana@email.com' })
        .expect(201);
      const secondType = await request(server())
        .post('/document-types')
        .send({ name: 'RG' })
        .expect(201);
      const secondRequirement = await request(server())
        .post('/document-requirements')
        .send({
          collaboratorId: (secondCollaborator.body as CollaboratorApiResponse)
            .id,
          documentTypeId: (secondType.body as DocumentTypeApiResponse).id,
        })
        .expect(201);
      const secondRequirementId = (
        secondRequirement.body as DocumentRequirementApiResponse
      ).id;

      await Promise.all([
        submitVersion(first.requirementId, 'documents/first-v1.pdf').expect(
          201,
        ),
        submitVersion(secondRequirementId, 'documents/second-v1.pdf').expect(
          201,
        ),
      ]);

      const [firstResubmit, secondResubmit] = await Promise.all([
        submitVersion(first.requirementId, 'documents/first-v2.pdf'),
        submitVersion(secondRequirementId, 'documents/second-v2.pdf'),
      ]);

      expect(firstResubmit.status).toBe(201);
      expect(secondResubmit.status).toBe(201);
      expect(
        (firstResubmit.body as DocumentVersionApiResponse).versionNumber,
      ).toBe(2);
      expect(
        (secondResubmit.body as DocumentVersionApiResponse).versionNumber,
      ).toBe(2);

      const firstHistory = await request(server())
        .get(`/document-requirements/${first.requirementId}/versions`)
        .expect(200);
      const secondHistory = await request(server())
        .get(`/document-requirements/${secondRequirementId}/versions`)
        .expect(200);

      expect(
        (firstHistory.body as DocumentVersionApiResponse[]).filter(
          (v) => v.isActive,
        ),
      ).toHaveLength(1);
      expect(
        (secondHistory.body as DocumentVersionApiResponse[]).filter(
          (v) => v.isActive,
        ),
      ).toHaveLength(1);
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

    it('handles concurrent submit and soft-delete without partial or double-active state', async () => {
      const { requirementId } = await seedRequirement();
      await submitVersion(requirementId, 'documents/v1.pdf').expect(201);

      const [submitResult, deleteResult] = await Promise.all([
        submitVersion(requirementId, 'documents/v2-race.pdf'),
        request(server()).delete(`/document-requirements/${requirementId}`),
      ]);

      expect([201, 404]).toContain(submitResult.status);
      expect([204, 404]).toContain(deleteResult.status);

      const activeCountRaw: unknown = await dataSource.query(
        `SELECT COUNT(*)::int AS count
         FROM document_version
         WHERE requirement_id = $1 AND is_active = true`,
        [requirementId],
      );
      const activeCount = activeCountRaw as Array<{ count: number }>;
      expect(Number(activeCount[0].count)).toBeLessThanOrEqual(1);

      const orphanRaw: unknown = await dataSource.query(
        `SELECT COUNT(*)::int AS count
         FROM document_version v
         INNER JOIN document_requirement r ON r.id = v.requirement_id
         WHERE v.requirement_id = $1
           AND v.is_active = true
           AND r.deleted_at IS NOT NULL
           AND v.created_at > r.deleted_at`,
        [requirementId],
      );
      const orphanActiveOnDeletedRequirement = orphanRaw as Array<{
        count: number;
      }>;
      expect(Number(orphanActiveOnDeletedRequirement[0].count)).toBe(0);

      const duplicateRaw: unknown = await dataSource.query(
        `SELECT version_number, COUNT(*)::int AS count
         FROM document_version
         WHERE requirement_id = $1
         GROUP BY version_number
         HAVING COUNT(*) > 1`,
        [requirementId],
      );
      const duplicateNumbers = duplicateRaw as Array<{
        version_number: number;
        count: number;
      }>;
      expect(duplicateNumbers).toHaveLength(0);
    });
  });

  describe('idempotency', () => {
    it('returns 201 on the first call with a given Idempotency-Key', async () => {
      const { requirementId } = await seedRequirement();
      const key = randomUUID();

      const response = await submitVersion(
        requirementId,
        'documents/cpf-v4.pdf',
        key,
      ).expect(201);
      const body = response.body as DocumentVersionApiResponse;

      expect(body.versionNumber).toBe(1);
      expect(body.documentReference).toBe('documents/cpf-v4.pdf');
    });

    it('returns 200 with the same version on retry with same key and payload', async () => {
      const { requirementId } = await seedRequirement();
      const key = randomUUID();

      const first = await submitVersion(
        requirementId,
        'documents/cpf-v4.pdf',
        key,
      ).expect(201);
      const firstBody = first.body as DocumentVersionApiResponse;

      const second = await submitVersion(
        requirementId,
        'documents/cpf-v4.pdf',
        key,
      ).expect(200);
      const secondBody = second.body as DocumentVersionApiResponse;

      expect(secondBody.id).toBe(firstBody.id);
      expect(secondBody.versionNumber).toBe(firstBody.versionNumber);

      const history = await request(server())
        .get(`/document-requirements/${requirementId}/versions`)
        .expect(200);
      expect(history.body).toHaveLength(1);
    });

    it('returns 409 when the same key is reused with a different payload', async () => {
      const { requirementId } = await seedRequirement();
      const key = randomUUID();

      await submitVersion(requirementId, 'documents/cpf-v1.pdf', key).expect(
        201,
      );

      await submitVersion(
        requirementId,
        'documents/cpf-v2-different.pdf',
        key,
      ).expect(409);

      const history = await request(server())
        .get(`/document-requirements/${requirementId}/versions`)
        .expect(200);
      expect(history.body).toHaveLength(1);
      expect(
        (history.body as DocumentVersionApiResponse[])[0].documentReference,
      ).toBe('documents/cpf-v1.pdf');
    });

    it('deduplicates three simultaneous retries with the same key and payload', async () => {
      const { requirementId } = await seedRequirement();
      const key = randomUUID();

      const responses = await Promise.all([
        submitVersion(requirementId, 'documents/retry.pdf', key),
        submitVersion(requirementId, 'documents/retry.pdf', key),
        submitVersion(requirementId, 'documents/retry.pdf', key),
      ]);

      const statuses = responses.map((r) => r.status).sort((a, b) => a - b);
      expect(statuses).toEqual([200, 200, 201]);

      const ids = new Set(
        responses.map((r) => (r.body as DocumentVersionApiResponse).id),
      );
      expect(ids.size).toBe(1);

      const history = await request(server())
        .get(`/document-requirements/${requirementId}/versions`)
        .expect(200);
      expect(history.body).toHaveLength(1);
      expect(
        (history.body as DocumentVersionApiResponse[])[0].versionNumber,
      ).toBe(1);
    });

    it('treats different Idempotency-Keys as distinct operations', async () => {
      const { requirementId } = await seedRequirement();

      const first = await submitVersion(
        requirementId,
        'documents/v1.pdf',
        randomUUID(),
      ).expect(201);
      const second = await submitVersion(
        requirementId,
        'documents/v2.pdf',
        randomUUID(),
      ).expect(201);
      const third = await submitVersion(
        requirementId,
        'documents/v3.pdf',
        randomUUID(),
      ).expect(201);

      expect((first.body as DocumentVersionApiResponse).versionNumber).toBe(1);
      expect((second.body as DocumentVersionApiResponse).versionNumber).toBe(2);
      expect((third.body as DocumentVersionApiResponse).versionNumber).toBe(3);

      const history = await request(server())
        .get(`/document-requirements/${requirementId}/versions`)
        .expect(200);
      expect(history.body).toHaveLength(3);
    });

    it('rejects a missing Idempotency-Key with 400', async () => {
      const { requirementId } = await seedRequirement();
      await submitVersionWithoutKey(requirementId, 'documents/x.pdf').expect(
        400,
      );
    });

    it('rejects an invalid Idempotency-Key with 400', async () => {
      const { requirementId } = await seedRequirement();
      await submitVersion(
        requirementId,
        'documents/x.pdf',
        'not-a-uuid',
      ).expect(400);
    });
  });
});
