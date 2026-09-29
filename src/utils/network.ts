/** From the Network Information API, which Safari and iOS WebViews do not have. */
export interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

const SLOW_NETWORKS = new Set(['slow-2g', '2g']);

export function getConnection() {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

export function isDataConstrained(connection: NetworkInformation | undefined) {
  return Boolean(connection?.saveData) || SLOW_NETWORKS.has(connection?.effectiveType ?? '');
}
