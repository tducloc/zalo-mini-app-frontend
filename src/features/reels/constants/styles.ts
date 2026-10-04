// The visible viewport above the tab bar (74px). iOS sizes 100vh to its largest viewport,
// which pushed each reel's bottom (title, price, progress bar) under the tab bar; dvh
// (iOS 15.4+) follows what is on screen, and vh stays for iOS 15.1 to 15.3.
export const reelHeightClass =
  'h-[calc(100vh_-_74px)] supports-[height:100dvh]:h-[calc(100dvh_-_74px)]';

export const spinnerClass =
  'size-10 animate-spin rounded-full border-[3px] border-solid border-white/30 border-t-white motion-reduce:animate-none';
