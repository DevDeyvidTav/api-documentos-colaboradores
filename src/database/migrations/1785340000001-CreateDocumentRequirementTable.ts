import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentRequirementTable1785340000001 implements MigrationInterface {
  name = 'CreateDocumentRequirementTable1785340000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "document_requirement" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "collaborator_id" uuid NOT NULL, "document_type_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_document_requirement_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_document_requirement_collaborator_id" ON "document_requirement" ("collaborator_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_document_requirement_document_type_id" ON "document_requirement" ("document_type_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_document_requirement_deleted_at" ON "document_requirement" ("deleted_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_document_requirement_collaborator_document_type_active" ON "document_requirement" ("collaborator_id", "document_type_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_requirement" ADD CONSTRAINT "FK_document_requirement_collaborator_id" FOREIGN KEY ("collaborator_id") REFERENCES "collaborator"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_requirement" ADD CONSTRAINT "FK_document_requirement_document_type_id" FOREIGN KEY ("document_type_id") REFERENCES "document_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_requirement" DROP CONSTRAINT "FK_document_requirement_document_type_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_requirement" DROP CONSTRAINT "FK_document_requirement_collaborator_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_document_requirement_collaborator_document_type_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_document_requirement_deleted_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_document_requirement_document_type_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_document_requirement_collaborator_id"`,
    );
    await queryRunner.query(`DROP TABLE "document_requirement"`);
  }
}
