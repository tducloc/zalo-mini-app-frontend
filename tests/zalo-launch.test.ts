// @vitest-environment jsdom
async function launchAt(url: string) {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  return (await import('@/lib/zalo-launch')).zaloBuildQuery;
}

it("keeps only Zalo's build params from the launch URL", async () => {
  expect(await launchAt('/?env=TESTING&version=8&utm_source=qr')).toBe('env=TESTING&version=8');
});

it('is empty in the live build, which Zalo opens without them', async () => {
  expect(await launchAt('/')).toBe('');
});
