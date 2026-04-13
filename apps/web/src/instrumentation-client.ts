// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { getSentryDsn, getSentryEnvironment, getSentryRelease } from "@/lib/sentry-env";

const dsn = getSentryDsn();

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: getSentryEnvironment(),
  release: getSentryRelease(),
  tracesSampleRate: 1,
  enableLogs: true,
  sendDefaultPii: true,
  integrations: dsn ? [Sentry.replayIntegration()] : [],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
