/**
 * A classified analytics failure.
 *
 * Every provider and route talks in these codes so the UI can distinguish
 * "not configured", "your key is wrong", "the provider is rate limiting us"
 * and "we timed out" — four states that need four different sentences.
 *
 * Messages are safe to render and to log: they never carry a credential, a
 * request header or a raw upstream body.
 */
import type { AnalyticsErrorCode, AnalyticsFailure } from "./types";

export class AnalyticsError extends Error {
  readonly code: AnalyticsErrorCode;
  readonly status: number | null;

  constructor(code: AnalyticsErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = "AnalyticsError";
    this.code = code;
    this.status = status;
  }

  toFailure(): AnalyticsFailure {
    return { code: this.code, message: this.message };
  }
}

export function isAnalyticsError(err: unknown): err is AnalyticsError {
  return err instanceof AnalyticsError;
}

/** Normalise any thrown value into a classified, renderable failure. */
export function toAnalyticsError(err: unknown): AnalyticsError {
  if (isAnalyticsError(err)) return err;
  return new AnalyticsError(
    "unreachable",
    "The analytics provider could not be reached. Analytics is optional, so your site is unaffected."
  );
}
