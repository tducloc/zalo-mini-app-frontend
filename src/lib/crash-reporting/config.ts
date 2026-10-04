export type SentryEnv = {
  DEV?: boolean;
  VITE_SENTRY_DSN?: string;
  VITE_SENTRY_ENVIRONMENT?: string;
  VITE_SENTRY_RELEASE?: string;
  VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
  VITE_SENTRY_TRACE_PROPAGATION?: string;
  VITE_API_BASE_URL?: string;
};

export type SentryConfig = {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  tracePropagationTargets: RegExp[];
};

const DEFAULT_TRACES_SAMPLE_RATE = 0.1;

/**
 * Sentry settings from the build env, or null without a DSN: then nothing of Sentry loads.
 * `zaloEnv` is `window.APP_ENV`, which the Zalo shell sets to the deploy target.
 */
export function readSentryConfig(env: SentryEnv, zaloEnv?: string): SentryConfig | null {
  const dsn = env.VITE_SENTRY_DSN?.trim();
  if (!dsn) {
    return null;
  }

  return {
    dsn,
    environment:
      env.VITE_SENTRY_ENVIRONMENT || zaloEnv?.toLowerCase() || (env.DEV ? 'local' : 'production'),
    release: env.VITE_SENTRY_RELEASE || undefined,
    tracesSampleRate: sampleRate(env.VITE_SENTRY_TRACES_SAMPLE_RATE),
    // Off unless asked: the API's CORS must first allow the `sentry-trace` and `baggage`
    // headers, or every API call fails its preflight. Never sent to CloudFront or S3.
    tracePropagationTargets:
      env.VITE_SENTRY_TRACE_PROPAGATION === 'true' ? originOf(env.VITE_API_BASE_URL) : [],
  };
}

function sampleRate(value: string | undefined) {
  const rate = Number(value);
  return value?.trim() && rate >= 0 && rate <= 1 ? rate : DEFAULT_TRACES_SAMPLE_RATE;
}

function originOf(apiBaseUrl: string | undefined) {
  if (!apiBaseUrl) {
    return [];
  }

  const { origin } = new URL(apiBaseUrl);
  return [new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`)];
}

/** The router pattern for a path, so traces group by page and not by listing id. */
export function routeName(pathname: string) {
  return pathname.replace(/^\/products\/[^/]+/, '/products/:productId');
}
