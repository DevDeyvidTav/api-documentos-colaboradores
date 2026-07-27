import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCollaboratorTable1785178943647 implements MigrationInterface {
  name = 'CreateCollaboratorTable1785178943647';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "collaborator" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(150) NOT NULL, "email" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_aa48142926d7bdb485d21ad2696" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_collaborator_deleted_at_created_at" ON "collaborator" ("deleted_at", "created_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_collaborator_email_active" ON "collaborator" ("email") WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."uq_collaborator_email_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_collaborator_deleted_at_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "collaborator"`);
  }
}
