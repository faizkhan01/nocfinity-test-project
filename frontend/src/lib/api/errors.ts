import type { ApiErrorBody } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.message || "Request failed.");
  }

  get code(): string | undefined {
    return this.body.code;
  }

  fieldErrors(): Record<string, string> {
    return Object.fromEntries(Object.entries(this.body.errors ?? {}).map(([field, messages]) => [field, messages[0]]));
  }
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof ApiError ? error.message : fallback;
}
