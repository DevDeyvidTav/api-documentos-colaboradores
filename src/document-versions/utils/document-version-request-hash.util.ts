import { createHash } from 'crypto';
import { CreateDocumentVersionDto } from '../dto/create-document-version.dto';

export function buildDocumentVersionRequestHash(
  dto: CreateDocumentVersionDto,
): string {
  const payload = JSON.stringify({
    documentReference: dto.documentReference,
  });

  return createHash('sha256').update(payload).digest('hex');
}
