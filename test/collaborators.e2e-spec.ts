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
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

interface PaginatedCollaboratorsApiResponse {
  items: CollaboratorApiResponse[];
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

describe('CollaboratorsController (e2e)', () => {
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
      'TRUNCATE TABLE "collaborator" RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "collaborator" RESTART IDENTITY CASCADE',
    );
    await app.close();
  });

  const server = () => app.getHttpServer() as Parameters<typeof request>[0];

  const createCollaborator = (body: { name: string; email: string }) =>
    request(server()).post('/collaborators').send(body);

  describe('POST /collaborators', () => {
    it('creates a collaborator and returns 201 with the created resource', async () => {
      const response = await createCollaborator({
        name: 'Ana Silva',
        email: 'ana@example.com',
      }).expect(201);
      const body = response.body as CollaboratorApiResponse;

      expect(body).toMatchObject({
        name: 'Ana Silva',
        email: 'ana@example.com',
      });
      expect(body.id).toEqual(expect.any(String));
      expect(body.deletedAt).toBeUndefined();
    });

    it('rejects an invalid e-mail with 400', async () => {
      await createCollaborator({
        name: 'Ana Silva',
        email: 'not-an-email',
      }).expect(400);
    });

    it('rejects an empty name with 400', async () => {
      await createCollaborator({ name: '', email: 'ana@example.com' }).expect(
        400,
      );
    });

    it('rejects a duplicate e-mail among active collaborators with 409', async () => {
      await createCollaborator({
        name: 'Ana Silva',
        email: 'duplicada@example.com',
      }).expect(201);

      await createCollaborator({
        name: 'Outra Pessoa',
        email: 'duplicada@example.com',
      }).expect(409);
    });

    it('allows reusing the e-mail of a soft-deleted collaborator', async () => {
      const created = await createCollaborator({
        name: 'Original',
        email: 'reaproveitado@example.com',
      }).expect(201);
      const { id } = created.body as CollaboratorApiResponse;

      await request(server()).delete(`/collaborators/${id}`).expect(204);

      await createCollaborator({
        name: 'Nova Pessoa',
        email: 'reaproveitado@example.com',
      }).expect(201);
    });
  });

  describe('GET /collaborators', () => {
    it('lists only active collaborators, paginated', async () => {
      await createCollaborator({ name: 'Ana', email: 'ana2@example.com' });
      const toDelete = await createCollaborator({
        name: 'Bruno',
        email: 'bruno@example.com',
      });
      const { id } = toDelete.body as CollaboratorApiResponse;
      await request(server()).delete(`/collaborators/${id}`);

      const response = await request(server())
        .get('/collaborators?page=1&limit=10')
        .expect(200);
      const body = response.body as PaginatedCollaboratorsApiResponse;

      expect(body.total).toBe(1);
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({ name: 'Ana' });
    });

    it('lists only deleted collaborators when status=deleted', async () => {
      await createCollaborator({ name: 'Ativo', email: 'ativo@example.com' });
      const toDelete = await createCollaborator({
        name: 'Removido',
        email: 'removido@example.com',
      });
      const { id } = toDelete.body as CollaboratorApiResponse;
      await request(server()).delete(`/collaborators/${id}`).expect(204);

      const response = await request(server())
        .get('/collaborators?status=deleted')
        .expect(200);
      const body = response.body as PaginatedCollaboratorsApiResponse;

      expect(body.total).toBe(1);
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({
        name: 'Removido',
        email: 'removido@example.com',
      });
      expect(body.items[0].deletedAt).toEqual(expect.any(String));
    });

    it('lists active and deleted collaborators when status=all', async () => {
      await createCollaborator({
        name: 'Ativo',
        email: 'all-ativo@example.com',
      });
      const toDelete = await createCollaborator({
        name: 'Removido',
        email: 'all-removido@example.com',
      });
      const { id } = toDelete.body as CollaboratorApiResponse;
      await request(server()).delete(`/collaborators/${id}`).expect(204);

      const response = await request(server())
        .get('/collaborators?status=all')
        .expect(200);
      const body = response.body as PaginatedCollaboratorsApiResponse;

      expect(body.total).toBe(2);
      expect(body.items).toHaveLength(2);
    });

    it('rejects an invalid status with 400', async () => {
      await request(server()).get('/collaborators?status=invalido').expect(400);
    });

    it('filters by name (partial match)', async () => {
      await createCollaborator({
        name: 'Carla Souza',
        email: 'carla@example.com',
      });
      await createCollaborator({
        name: 'Daniel Lima',
        email: 'daniel@example.com',
      });

      const response = await request(server())
        .get('/collaborators?name=carla')
        .expect(200);
      const body = response.body as PaginatedCollaboratorsApiResponse;

      expect(body.total).toBe(1);
      expect(body.items[0]).toMatchObject({ name: 'Carla Souza' });
    });

    it('rejects a limit above the maximum allowed with 400', async () => {
      await request(server()).get('/collaborators?limit=1000').expect(400);
    });
  });

  describe('GET /collaborators/:id', () => {
    it('returns the collaborator when it exists and is active', async () => {
      const created = await createCollaborator({
        name: 'Eva Santos',
        email: 'eva@example.com',
      });
      const { id } = created.body as CollaboratorApiResponse;

      const response = await request(server())
        .get(`/collaborators/${id}`)
        .expect(200);

      expect(response.body).toMatchObject({ name: 'Eva Santos' });
    });

    it('returns 404 for an id that does not exist', async () => {
      await request(server())
        .get('/collaborators/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await request(server()).get('/collaborators/not-a-uuid').expect(400);
    });
  });

  describe('DELETE /collaborators/:id', () => {
    it('soft deletes the collaborator and excludes it from future reads', async () => {
      const created = await createCollaborator({
        name: 'Delete Me',
        email: 'delete@example.com',
      });
      const { id } = created.body as CollaboratorApiResponse;

      await request(server()).delete(`/collaborators/${id}`).expect(204);
      await request(server()).get(`/collaborators/${id}`).expect(404);
    });

    it('returns 404 when deleting an already-deleted collaborator (idempotent guard)', async () => {
      const created = await createCollaborator({
        name: 'Delete Twice',
        email: 'delete-twice@example.com',
      });
      const { id } = created.body as CollaboratorApiResponse;

      await request(server()).delete(`/collaborators/${id}`).expect(204);
      await request(server()).delete(`/collaborators/${id}`).expect(404);
    });

    it('returns 404 when deleting an id that does not exist', async () => {
      await request(server())
        .delete('/collaborators/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  it('returns the standardized error body shape for a 404 response', async () => {
    const response = await request(server())
      .get('/collaborators/00000000-0000-0000-0000-000000000000')
      .expect(404);
    const body = response.body as ErrorApiResponse;

    // `expect.any(...)` is typed as `any` by @types/jest; safe in test assertions.
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(body).toMatchObject({
      statusCode: 404,
      error: expect.any(String),
      message: expect.any(String),
      timestamp: expect.any(String),
      path: '/collaborators/00000000-0000-0000-0000-000000000000',
    });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  });
});
