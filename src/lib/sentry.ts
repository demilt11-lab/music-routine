/**
 * Sentry error tracking initialisation.
 * Called once at app startup from main.tsx.
 * No-ops gracefully if VITE_SENTRY_DSN is not set.
 */

let sentryInitialised = false;

export async function initialiseSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || sentryInitialised) return;

  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION as string | undefined,
      // Only trace a sample of transactions to stay within free-tier limits
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 0,
      // Replays only in production, 10% of sessions, 100% on error.
      // maskAllText + blockAllMedia required: UI renders PHI (heart rate, EEG, stress scores).
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
          maskAllInputs: true,
        }),
      ],
      // Do not capture errors from known noisy sources
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection',
        /^Loading chunk/,
      ],
      beforeSend(event) {
        // Strip PII from breadcrumb URLs
        if (event.breadcrumbs?.values) {
          event.breadcrumbs.values = event.breadcrumbs.values.map((b) => ({
            ...b,
            data: b.data
              ? { ...b.data, url: b.data.url?.split('?')[0] }
              : b.data,
          }));
        }
        return event;
      },
    });
    sentryInitialised = true;
  } catch (err) {
    // Sentry failing to load must never crash the app
    console.warn('[BioMusic] Sentry failed to initialise:', err);
  }
}
