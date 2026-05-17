/**
 * Minimal type stub for @sentry/electron/main.
 *
 * The OSS build does not include the @sentry/electron package.
 * This stub provides just enough types so that sentry.ts and sentry-scrub.ts
 * compile without errors. At runtime, getBuildConfig().sentryDsn returns ''
 * (empty string), so initSentry() is a no-op.
 */

declare module '@sentry/electron/main' {
  export interface Breadcrumb {
    message?: string;
    category?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }

  export interface ErrorEvent {
    message?: string;
    level?: string;
    tags?: Record<string, string>;
    exception?: {
      values?: Array<{
        value?: string;
        type?: string;
      }>;
    };
    breadcrumbs?: Breadcrumb[];
  }

  export function init(options: {
    dsn: string;
    release?: string;
    dist?: string;
    environment?: string;
    beforeSend?: (event: ErrorEvent) => ErrorEvent | null;
    beforeBreadcrumb?: (breadcrumb: Breadcrumb) => Breadcrumb | null;
  }): void;

  export function setTag(key: string, value: string): void;
  export function setUser(user: { id: string }): void;
}
