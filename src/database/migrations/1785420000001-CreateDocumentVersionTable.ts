import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentVersionTable1785420000001 implements MigrationInterface {
  name = 'CreateDocumentVersionTable1785420000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "document_version" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "requirement_id" uuid NOT NULL, "version_number" integer NOT NULL, "is_active" boolean NOT NULL, "document_reference" character varying(500) NOT NULL, "submitted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_document_version_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_document_version_requirement_id" ON "document_version" ("requirement_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_document_version_submitted_at" ON "document_version" ("submitted_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_document_version_requirement_version_number" ON "document_version" ("requirement_id", "version_number") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_document_version_requirement_active" ON "document_version" ("requirement_id") WHERE is_active = true`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_version" ADD CONSTRAINT "FK_document_version_requirement_id" FOREIGN KEY ("requirement_id") REFERENCES "document_requirement"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_version" DROP CONSTRAINT "FK_document_version_requirement_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_document_version_requirement_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_document_version_requirement_version_number"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_document_version_submitted_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_document_version_requirement_id"`,
    );
    await queryRunner.query(`DROP TABLE "document_version"`);
  }
}
