import { AxiosError } from 'axios';

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isAxiosError(error: unknown): error is AxiosError {
  return error instanceof AxiosError || (error instanceof Error && 'isAxiosError' in error);
}
