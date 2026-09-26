/**
 * How much a listing, a photo and a video may be, and the sizes the phone shrinks them to.
 * The numbers mirror the server
 * (backend/src/media/media-limits.ts), which checks everything again; checking here only
 * tells the seller early, before a long upload.
 */

export const MIB = 1024 * 1024;

// ---- Per listing ----

export const MAX_IMAGES_PER_LISTING = 10;
export const MAX_VIDEOS_PER_LISTING = 1;

// ---- Photos ----

/**
 * The heaviest photo the app takes, as the server does. Refused at pick time, before the
 * worker decodes it; phone cameras write 2–8 MB, a 48 MP JPEG up to ~15 MB. Equal to the
 * server's limit, so an original the phone cannot shrink still passes.
 */
export const MAX_IMAGE_BYTES = 15 * MIB;

/**
 * The most pixels the app takes, as the server does (MAX_INPUT_PIXELS): the 48 MP and
 * 50 MP camera modes pass. A 108 MP photo fits in 15 MB but would take ~430 MB to decode,
 * which the worker does not survive, and the server would refuse the original.
 */
export const MAX_IMAGE_PIXELS = 50_000_000;

/** Enough for a JPEG's size to follow a full 64 KB EXIF segment plus ICC and MPF. */
export const IMAGE_HEAD_BYTES = 256 * 1024;

/** Long edge of the uploaded photo. The server scales anything larger to the same size. */
export const PHOTO_MAX_EDGE = 1280;

// ---- Videos ----

export const MAX_VIDEO_BYTES = 150 * MIB;
export const MAX_VIDEO_DURATION_MS = 60_000;
export const MAX_VIDEO_SECONDS = MAX_VIDEO_DURATION_MS / 1000;
/** The server allows the same slack: phones round a 60 s recording up. */
export const VIDEO_DURATION_TOLERANCE_MS = 500;
export const MAX_VIDEO_LONG_EDGE = 1920;
export const MAX_VIDEO_SHORT_EDGE = 1080;

/** Conversion target (plans/create-listing.md, "Video on the client"): 720p. */
export const CONVERTED_SHORT_EDGE = 720;
