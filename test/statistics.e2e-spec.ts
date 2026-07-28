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

interface StatisticsApiResponse {
  completionPercentage: number;
  totals: {
    requirements: number;
    completed: number;
    pending: number;
  };
  mostPendingDocumentTypes: Array<{
    documentTypeId: string;
    documentTypeName: string;
    pendingCount: number;
  }>;
  latestSubmissions: Array<{
    documentVersionId: string;
    versionNumber: number;
    submittedAt: string;
    collaborator: { id: string; name: string };
    documentType: { id: string; name: string };
  }>;
}

describe('StatisticsController (e2e)', () => {
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

  const createCollaborator = (name: string, email: string) =>
    request(server()).post('/collaborators').send({ name, email });

  const createDocumentType = (name: string) =>
    request(server()).post('/document-types').send({ name });

  const createRequirement = (collaboratorId: string, documentTypeId: string) =>
    request(server())
      .post('/document-requirements')
      .send({ collaboratorId, documentTypeId });

  const submitVersion = (requirementId: string, documentReference: string) =>
    request(server())
      .post(`/document-requirements/${requirementId}/versions`)
      .set('Idempotency-Key', randomUUID())
      .send({ documentReference });

  const getStatistics = () => request(server()).get('/statistics');

  it('returns zeros and empty lists for an empty system', async () => {
    const response = await getStatistics().expect(200);
    const body = response.body as StatisticsApiResponse;

    expect(body).toEqual({
      completionPercentage: 0,
      totals: { requirements: 0, completed: 0, pending: 0 },
      mostPendingDocumentTypes: [],
      latestSubmissions: [],
    });
  });

  it('returns 100% when all active requirements are completed', async () => {
    const collaborator = await createCollaborator(
      'Deyvid',
      'deyvid@email.com',
    ).expect(201);
    const type = await createDocumentType('CPF').expect(201);
    const requirement = await createRequirement(
      (collaborator.body as CollaboratorApiResponse).id,
      (type.body as DocumentTypeApiResponse).id,
    ).expect(201);

    await submitVersion(
      (requirement.body as DocumentRequirementApiResponse).id,
      'documents/cpf-v1.pdf',
    ).expect(201);

    const body = (await getStatistics().expect(200))
      .body as StatisticsApiResponse;

    expect(body.completionPercentage).toBe(100);
    expect(body.totals).toEqual({
      requirements: 1,
      completed: 1,
      pending: 0,
    });
    expect(body.mostPendingDocumentTypes).toEqual([]);
  });

  it('calculates the completion percentage for mixed pending/completed requirements', async () => {
    const collaborator = await createCollaborator(
      'Deyvid',
      'deyvid@email.com',
    ).expect(201);
    const cpf = await createDocumentType('CPF').expect(201);
    const rg = await createDocumentType('RG').expect(201);

    const completed = await createRequirement(
      (collaborator.body as CollaboratorApiResponse).id,
      (cpf.body as DocumentTypeApiResponse).id,
    ).expect(201);
    await createRequirement(
      (collaborator.body as CollaboratorApiResponse).id,
      (rg.body as DocumentTypeApiResponse).id,
    ).expect(201);

    await submitVersion(
      (completed.body as DocumentRequirementApiResponse).id,
      'documents/cpf-v1.pdf',
    ).expect(201);

    const body = (await getStatistics().expect(200))
      .body as StatisticsApiResponse;

    expect(body.totals).toEqual({
      requirements: 2,
      completed: 1,
      pending: 1,
    });
    expect(body.completionPercentage).toBe(50);
  });

  it('groups and orders most pending document types by pendingCount DESC and name ASC', async () => {
    const collaboratorA = await createCollaborator(
      'Ana',
      'ana@email.com',
    ).expect(201);
    const collaboratorB = await createCollaborator(
      'Bruno',
      'bruno@email.com',
    ).expect(201);
    const aso = await createDocumentType('ASO').expect(201);
    const cpf = await createDocumentType('CPF').expect(201);
    const rg = await createDocumentType('RG').expect(201);

    // ASO pending x2
    await createRequirement(
      (collaboratorA.body as CollaboratorApiResponse).id,
      (aso.body as DocumentTypeApiResponse).id,
    ).expect(201);
    await createRequirement(
      (collaboratorB.body as CollaboratorApiResponse).id,
      (aso.body as DocumentTypeApiResponse).id,
    ).expect(201);

    // CPF pending x1
    await createRequirement(
      (collaboratorA.body as CollaboratorApiResponse).id,
      (cpf.body as DocumentTypeApiResponse).id,
    ).expect(201);

    // RG pending x1 (tie with CPF on count → name ASC: CPF before RG)
    await createRequirement(
      (collaboratorA.body as CollaboratorApiResponse).id,
      (rg.body as DocumentTypeApiResponse).id,
    ).expect(201);

    const body = (await getStatistics().expect(200))
      .body as StatisticsApiResponse;

    expect(body.mostPendingDocumentTypes).toEqual([
      {
        documentTypeId: (aso.body as DocumentTypeApiResponse).id,
        documentTypeName: 'ASO',
        pendingCount: 2,
      },
      {
        documentTypeId: (cpf.body as DocumentTypeApiResponse).id,
        documentTypeName: 'CPF',
        pendingCount: 1,
      },
      {
        documentTypeId: (rg.body as DocumentTypeApiResponse).id,
        documentTypeName: 'RG',
        pendingCount: 1,
      },
    ]);
  });

  it('returns the latest submissions ordered by submittedAt DESC limited to 10', async () => {
    const collaborator = await createCollaborator(
      'João',
      'joao@email.com',
    ).expect(201);
    const typeNames = Array.from({ length: 12 }, (_, index) => `DOC-${index}`);
    const requirementIds: string[] = [];

    for (const name of typeNames) {
      const type = await createDocumentType(name).expect(201);
      const requirement = await createRequirement(
        (collaborator.body as CollaboratorApiResponse).id,
        (type.body as DocumentTypeApiResponse).id,
      ).expect(201);
      requirementIds.push(
        (requirement.body as DocumentRequirementApiResponse).id,
      );
    }

    for (const [index, requirementId] of requirementIds.entries()) {
      await submitVersion(requirementId, `documents/doc-${index}.pdf`).expect(
        201,
      );
    }

    const body = (await getStatistics().expect(200))
      .body as StatisticsApiResponse;

    expect(body.latestSubmissions).toHaveLength(10);
    const submittedAts = body.latestSubmissions.map((item) =>
      Date.parse(item.submittedAt),
    );
    for (let index = 1; index < submittedAts.length; index += 1) {
      expect(submittedAts[index - 1]).toBeGreaterThanOrEqual(
        submittedAts[index],
      );
    }
    expect(body.latestSubmissions[0].collaborator.name).toBe('João');
    expect(body.latestSubmissions[0].versionNumber).toBe(1);
  });

  it('excludes soft-deleted requirements and document types from statistics', async () => {
    const collaborator = await createCollaborator(
      'Deyvid',
      'deyvid@email.com',
    ).expect(201);
    const activeType = await createDocumentType('CPF').expect(201);
    const deletedType = await createDocumentType('ASO').expect(201);

    const activeRequirement = await createRequirement(
      (collaborator.body as CollaboratorApiResponse).id,
      (activeType.body as DocumentTypeApiResponse).id,
    ).expect(201);
    const pendingOnDeletedType = await createRequirement(
      (collaborator.body as CollaboratorApiResponse).id,
      (deletedType.body as DocumentTypeApiResponse).id,
    ).expect(201);

    await submitVersion(
      (activeRequirement.body as DocumentRequirementApiResponse).id,
      'documents/cpf-v1.pdf',
    ).expect(201);

    await request(server())
      .delete(
        `/document-requirements/${(pendingOnDeletedType.body as DocumentRequirementApiResponse).id}`,
      )
      .expect(204);
    await request(server())
      .delete(
        `/document-types/${(deletedType.body as DocumentTypeApiResponse).id}`,
      )
      .expect(204);

    // Extra pending requirement that remains active
    const rg = await createDocumentType('RG').expect(201);
    await createRequirement(
      (collaborator.body as CollaboratorApiResponse).id,
      (rg.body as DocumentTypeApiResponse).id,
    ).expect(201);

    const body = (await getStatistics().expect(200))
      .body as StatisticsApiResponse;

    expect(body.totals).toEqual({
      requirements: 2,
      completed: 1,
      pending: 1,
    });
    expect(body.completionPercentage).toBe(50);
    expect(body.mostPendingDocumentTypes).toEqual([
      {
        documentTypeId: (rg.body as DocumentTypeApiResponse).id,
        documentTypeName: 'RG',
        pendingCount: 1,
      },
    ]);
    expect(
      body.latestSubmissions.every(
        (item) =>
          item.documentType.id ===
          (activeType.body as DocumentTypeApiResponse).id,
      ),
    ).toBe(true);
  });

  it('excludes soft-deleted collaborators from operational statistics', async () => {
    const activeCollaborator = await createCollaborator(
      'Ana',
      'ana@email.com',
    ).expect(201);
    const deletedCollaborator = await createCollaborator(
      'Bruno',
      'bruno@email.com',
    ).expect(201);
    const documentType = await createDocumentType('CPF').expect(201);

    const activeRequirement = await createRequirement(
      (activeCollaborator.body as CollaboratorApiResponse).id,
      (documentType.body as DocumentTypeApiResponse).id,
    ).expect(201);
    const orphanRequirement = await createRequirement(
      (deletedCollaborator.body as CollaboratorApiResponse).id,
      (documentType.body as DocumentTypeApiResponse).id,
    ).expect(201);

    await submitVersion(
      (orphanRequirement.body as DocumentRequirementApiResponse).id,
      'documents/bruno-cpf.pdf',
    ).expect(201);

    await request(server())
      .delete(
        `/collaborators/${(deletedCollaborator.body as CollaboratorApiResponse).id}`,
      )
      .expect(204);

    const body = (await getStatistics().expect(200))
      .body as StatisticsApiResponse;

    expect(body.totals).toEqual({
      requirements: 1,
      completed: 0,
      pending: 1,
    });
    expect(body.completionPercentage).toBe(0);
    expect(body.mostPendingDocumentTypes).toEqual([
      {
        documentTypeId: (documentType.body as DocumentTypeApiResponse).id,
        documentTypeName: 'CPF',
        pendingCount: 1,
      },
    ]);
    expect(body.latestSubmissions).toEqual([]);
    expect(
      (activeRequirement.body as DocumentRequirementApiResponse).id,
    ).toBeDefined();
  });
});
