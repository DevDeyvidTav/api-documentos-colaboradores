import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION_CODE = '23505';
const DEADLOCK_DETECTED_CODE = '40P01';
const SERIALIZATION_FAILURE_CODE = '40001';

function getDriverErrorCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) {
    return undefined;
  }

  const driverError = error.driverError as { code?: string } | undefined;
  return driverError?.code;
}

export function isUniqueViolation(error: unknown): boolean {
  return getDriverErrorCode(error) === UNIQUE_VIOLATION_CODE;
}

export function isTransactionConflict(error: unknown): boolean {
  const code = getDriverErrorCode(error);
  return code === DEADLOCK_DETECTED_CODE || code === SERIALIZATION_FAILURE_CODE;
}
