import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentVersionIdempotency1785500000001 implements MigrationInterface {
  name = 'AddDocumentVersionIdempotency1785500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_version" ADD "idempotency_key" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_version" ADD "request_hash" character varying(64)`,
    );
    await queryRunner.query(
      `UPDATE "document_version" SET "idempotency_key" = 'legacy-' || "id"::text, "request_hash" = 'legacy' WHERE "idempotency_key" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_version" ALTER COLUMN "idempotency_key" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_version" ALTER COLUMN "request_hash" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_document_version_requirement_idempotency_key" ON "document_version" ("requirement_id", "idempotency_key") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."uq_document_version_requirement_idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_version" DROP COLUMN "request_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_version" DROP COLUMN "idempotency_key"`,
    );
  }
}
