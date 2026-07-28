import { MigrationInterface, QueryRunner } from 'typeorm';


export class AddDocumentRequirementDeletedAtCreatedAtIndex1785580000001 implements MigrationInterface {
  name = 'AddDocumentRequirementDeletedAtCreatedAtIndex1785580000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_document_requirement_deleted_at_created_at" ON "document_requirement" ("deleted_at", "created_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_document_requirement_deleted_at_created_at"`,
    );
  }
}
