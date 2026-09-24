/** Profile subtitle for the three sign-in states. */
export function getAuthStatusLabel({
  isSignedIn,
  isBootstrapping,
}: {
  isSignedIn: boolean;
  isBootstrapping: boolean;
}) {
  if (isSignedIn) {
    return 'Đã xác thực với Zalo';
  }

  if (isBootstrapping) {
    return 'Đang xác thực với Zalo…';
  }

  return 'Chưa thể xác thực trong trình duyệt';
}
