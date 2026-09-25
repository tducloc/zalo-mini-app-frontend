# Media

Photos and videos for a listing, from the seller's pick to the server's READY. Two folders
share the work:

- `features/media/` — tools for **one file**; they know nothing about listings.
- `features/listings/draft/` — the **listing draft**: puts the tools together for every file the
  seller picks, and keeps each file's state in the draft store (`src/stores/listing-draft.ts`).

## Where to start reading

`listings/draft/media-intake.ts` (`addDraftFiles`) → `listings/draft/media-upload.ts`, with
`listings/draft/media-reducer.ts` open for the states a file goes through.

## The flow

```
pick ─► MediaDetector ─► photo: image-queue ─► image-worker ─► ready ─► FileUpload ─► poll status
        (media-detector)  video: video-utils ─► convert-video ─┘        (upload/)     (media-upload)
```

1. **Detect** (`media-detector.ts`): photo, video, or refused, from the first bytes.
2. **Check and optimize** (`listings/draft/media-intake.ts`): a photo is shrunk to 1280 px in a
   worker (`image/`); a video is checked and, when worth it, converted to 720p (`video/`).
3. **Upload** (`listings/draft/media-upload.ts`): two files at a time, each through
   `upload/file-upload.ts` (presigned PUT or parts, retries, network waits).
4. **Processing**: the server makes thumbnails and checks the file; the app asks every 3 s
   until it says READY or FAILED.

## Files

| File                           | What it holds                                                            |
| ------------------------------ | ------------------------------------------------------------------------ |
| `media-utils.ts`               | What photos and videos share: kinds, refusal reasons, per-listing limits |
| `media-detector.ts`            | What a picked file is, from its first bytes                              |
| `image/image-utils.ts`         | Photo formats, size limits, reading format and size (image-size)         |
| `image/image-queue.ts`         | One photo at a time to the worker; originals when it fails               |
| `image/image-worker.ts`        | The page's side of the worker thread                                     |
| `image/image-worker-thread.ts` | Runs inside the worker: decode, scale, encode JPEG                       |
| `video/video-utils.ts`         | Video metadata (mediabunny) and whether the server would take it         |
| `video/convert-video.ts`       | Conversion to 720p H.264 (mediabunny + WebCodecs)                        |
| `upload/upload-types.ts`       | Shapes of the upload endpoints                                           |
| `upload/upload-api.ts`         | HTTP calls: media endpoints and the PUT to storage                       |
| `upload/browser-transport.ts`  | Those calls plus the browser's online/offline signals                    |
| `upload/retry-policy.ts`       | Which failures to retry, how many times, how long between                |
| `upload/file-upload.ts`        | Uploads one file; remembers what reached storage                         |

| `listings/draft/`   | What it holds                                           |
| ------------------- | ------------------------------------------------------- |
| `media-reducer.ts`  | Each file's state and the actions that move it, by flow |
| `media-intake.ts`   | Detect, check, optimize each picked file                |
| `media-upload.ts`   | Upload queue and processing status                      |
| `media-messages.ts` | What the seller reads under a file                      |

Device experiments live in `features/lab/media/` (the media lab page), not here.
