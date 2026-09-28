/** From the Network Information API, which Safari and iOS WebViews do not have. */
export interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/** Networks too slow to spend on video the viewer is not watching yet. */
const SLOW_NETWORKS = new Set(['slow-2g', '2g']);

export function getConnection() {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

/** The viewer asked to save data, or the network is too slow for video they did not ask for. */
export function isSavingData(connection: NetworkInformation | undefined) {
  return Boolean(connection?.saveData) || SLOW_NETWORKS.has(connection?.effectiveType ?? '');
}
