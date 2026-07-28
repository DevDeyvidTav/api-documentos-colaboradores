import { DocumentVersion } from '../entities/document-version.entity';

export interface SubmitDocumentVersionResult {
  version: DocumentVersion;
  replay: boolean;
}
