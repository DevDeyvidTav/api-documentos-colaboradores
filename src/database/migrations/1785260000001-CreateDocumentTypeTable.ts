import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentTypeTable1785260000001 implements MigrationInterface {
  name = 'CreateDocumentTypeTable1785260000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "document_type" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(120) NOT NULL, "description" character varying(500), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_document_type_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_document_type_deleted_at_created_at" ON "document_type" ("deleted_at", "created_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_document_type_name_active" ON "document_type" ("name") WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."uq_document_type_name_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_document_type_deleted_at_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "document_type"`);
  }
}
