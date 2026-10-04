// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readSentryConfig, routeName } from '@/lib/crash-reporting/config';

const { initSentry } = vi.hoisted(() => ({ initSentry: vi.fn() }));
vi.mock('@/lib/crash-reporting/sentry', () => ({ initSentry }));

const DSN = 'https://public@o1.ingest.sentry.test/2';
const API = 'https://marketplace-api.loctd-ztolabs.uk/api/v1';

describe('readSentryConfig', () => {
  it('turns Sentry off without a DSN', () => {
    expect(readSentryConfig({})).toBeNull();
    expect(readSentryConfig({ VITE_SENTRY_DSN: '  ' })).toBeNull();
  });

  it('names the environment from the env var, then the Zalo shell, then the build', () => {
    expect(readSentryConfig({ VITE_SENTRY_DSN: DSN })?.environment).toBe('production');
    expect(readSentryConfig({ VITE_SENTRY_DSN: DSN, DEV: true })?.environment).toBe('local');
    expect(readSentryConfig({ VITE_SENTRY_DSN: DSN }, 'TESTING')?.environment).toBe('testing');
    expect(
      readSentryConfig({ VITE_SENTRY_DSN: DSN, VITE_SENTRY_ENVIRONMENT: 'staging' }, 'TESTING')
        ?.environment,
    ).toBe('staging');
  });

  it('samples 10% of traces unless the env var holds a rate from 0 to 1', () => {
    const rate = (value?: string) =>
      readSentryConfig({ VITE_SENTRY_DSN: DSN, VITE_SENTRY_TRACES_SAMPLE_RATE: value })
        ?.tracesSampleRate;

    expect(rate()).toBe(0.1);
    expect(rate('')).toBe(0.1);
    expect(rate('abc')).toBe(0.1);
    expect(rate('1.5')).toBe(0.1);
    expect(rate('0')).toBe(0);
    expect(rate('0.5')).toBe(0.5);
  });

  it('sends trace headers to nothing by default, and only to the API when asked', () => {
    expect(
      readSentryConfig({ VITE_SENTRY_DSN: DSN, VITE_API_BASE_URL: API })?.tracePropagationTargets,
    ).toEqual([]);

    const [target] = readSentryConfig({
      VITE_SENTRY_DSN: DSN,
      VITE_API_BASE_URL: API,
      VITE_SENTRY_TRACE_PROPAGATION: 'true',
    })!.tracePropagationTargets;

    expect(target.test(`${API}/products?limit=20`)).toBe(true);
    expect(target.test('https://d3mzpzcvf5p9vr.cloudfront.net/media/a.mp4')).toBe(false);
    expect(target.test('https://marketplace-api.loctd-ztolabs.uk.evil.test/api/v1')).toBe(false);
  });
});

describe('routeName', () => {
  it('groups listing pages by route, not by listing id', () => {
    expect(routeName('/')).toBe('/');
    expect(routeName('/reels')).toBe('/reels');
    expect(routeName('/products/cmg1abc')).toBe('/products/:productId');
    expect(routeName('/products/cmg1abc/edit')).toBe('/products/:productId/edit');
  });
});

describe('start', () => {
  const reporter = { capture: vi.fn(), navigate: vi.fn() };

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    initSentry.mockReset().mockReturnValue(reporter);
    reporter.capture.mockReset();
    reporter.navigate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('loads nothing and keeps no errors without a DSN', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');
    const addListener = vi.spyOn(window, 'addEventListener');

    await import('@/lib/crash-reporting/start');
    const { reportCrash } = await import('@/lib/crash-reporting');
    reportCrash({ error: new Error('boom'), source: 'react' });
    await vi.runAllTimersAsync();

    expect(initSentry).not.toHaveBeenCalled();
    expect(addListener).not.toHaveBeenCalledWith('error', expect.anything());
    addListener.mockRestore();
  });

  it('loads Sentry after the page is idle and sends the errors caught before', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', DSN);
    const removeListener = vi.spyOn(window, 'removeEventListener');

    await import('@/lib/crash-reporting/start');
    const { reportCrash, reportRoute } = await import('@/lib/crash-reporting');
    reportRoute('/');
    const early = new Error('before Sentry');
    window.dispatchEvent(new ErrorEvent('error', { error: early }));
    reportCrash({ error: new Error('render'), source: 'react', componentStack: '\n at Reels' });

    expect(initSentry).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(initSentry).toHaveBeenCalledWith(expect.objectContaining({ dsn: DSN }), '/');
    expect(reporter.capture.mock.calls.map(([report]) => report)).toEqual([
      { error: early, source: 'onerror' },
      {
        error: expect.objectContaining({ message: 'render' }),
        source: 'react',
        componentStack: '\n at Reels',
      },
    ]);

    // Sentry's own handlers take over: the early listeners are gone.
    expect(removeListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

    reportRoute('/products/cmg1abc');
    expect(reporter.navigate).toHaveBeenCalledWith('/products/:productId');
    removeListener.mockRestore();
  });
});
