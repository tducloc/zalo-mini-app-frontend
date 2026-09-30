/** Long edge of the still: a tile is about 110 px wide at 3x, and the viewer shows it briefly. */
const POSTER_LONG_EDGE = 480;
const POSTER_QUALITY = 0.8;

/**
 * A still of the video's first frame, as a JPEG, for its tile and the viewer's poster. iOS
 * draws nothing for a `<video>` the page does not play, so the tile cannot show the file
 * itself. Decodes one frame with WebCodecs; null where that is not possible, and the tile
 * falls back to the `<video>`.
 */
export async function readVideoPoster(file: Blob): Promise<Blob | null> {
  const { BlobSource, CanvasSink, Input, MP4, QTFF } = await import('mediabunny');
  const input = new Input({ formats: [MP4, QTFF], source: new BlobSource(file) });

  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) {
      return null;
    }

    const [width, height, firstTimestamp] = await Promise.all([
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      track.getFirstTimestamp(),
    ]);
    const scale = Math.min(1, POSTER_LONG_EDGE / Math.max(width, height));
    const sink = new CanvasSink(track, {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
      fit: 'fill',
    });
    const frame = await sink.getCanvas(firstTimestamp);
    return frame ? await toJpeg(frame.canvas) : null;
  } finally {
    input.dispose();
  }
}

function toJpeg(canvas: HTMLCanvasElement | OffscreenCanvas) {
  if (canvas instanceof HTMLCanvasElement) {
    return new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', POSTER_QUALITY),
    );
  }
  return canvas.convertToBlob({ type: 'image/jpeg', quality: POSTER_QUALITY });
}
