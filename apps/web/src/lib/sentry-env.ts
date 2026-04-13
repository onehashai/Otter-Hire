/**
 * Sentry DSN from env — everything else uses the same defaults as the prior hardcoded init.
 */

export function getSentryDsn(): string | undefined {
  const d = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim();
  return d || undefined;
}

export function getSentryEnvironment(): string | undefined {
  return process.env.NODE_ENV || undefined;
}

/** Set by CI at build/runtime if you need release tracking (not required in .env.example). */
export function getSentryRelease(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim() ||
    process.env.SENTRY_RELEASE?.trim() ||
    undefined
  );
}
