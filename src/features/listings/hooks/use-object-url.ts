import { useEffect, useState } from 'react';

/** An object URL for `blob` while it is shown, revoked after. */
export function useObjectUrl(blob: Blob | null) {
  const [created, setCreated] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    if (!blob) {
      return;
    }

    const url = URL.createObjectURL(blob);
    setCreated({ blob, url });
    return () => {
      URL.revokeObjectURL(url);
      // Forgotten with it: the same blob asked for again later gets a new URL, never this one.
      setCreated((current) => (current?.url === url ? null : current));
    };
  }, [blob]);

  // Never the URL of a blob no longer asked for: it is revoked, or about to be.
  return created?.blob === blob ? created.url : null;
}
