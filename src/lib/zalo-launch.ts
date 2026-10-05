/**
 * Zalo opens a Development or Testing build with `?env=…&version=…`, and only a link that
 * carries them opens that same build; without them a link opens the live one. Read once at
 * launch: the router's first navigation drops the query.
 */
const launch = new URLSearchParams(window.location.search);
const buildParams = new URLSearchParams();
for (const key of ['env', 'version']) {
  const value = launch.get(key);
  if (value) buildParams.set(key, value);
}

/** `env=TESTING&version=8` in a Testing build, empty in the live one. */
export const zaloBuildQuery = buildParams.toString();
