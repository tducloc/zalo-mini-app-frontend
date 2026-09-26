# Media

Photos and videos for a listing, from the seller's pick to the server's READY. Two features
share the work:

- `features/media/` — tools for **one file**; they know nothing about listings.
- `features/listings/` — the **listing draft's files**: `services/` puts the tools together
  for every file the seller picks; each file's state is in the draft store
  (`src/stores/listing-draft.ts`).

## Where to start reading

`listings/services/add-media.ts` (`addDraftFiles`) → `listings/services/upload-media.ts`,
with `listings/types/draft-media.ts` open for the states a file goes through.

## The flow

```
pick ─► MediaDetector ─► photo: image-queue ─► image-worker ─► ready ─► FileUpload ─► poll status
        (utils/)         video: utils/video ─► convert-video ─┘         (services/)   (upload-media)
```

1. **Detect** (`utils/media-detector.ts`): photo, video, or refused, from the first bytes.
2. **Check and optimize** (`listings/services/add-media.ts`): a photo is shrunk to 1280 px in
   a worker (`services/image-*`); a video is checked (`utils/video.ts`) and, when worth it,
   converted to 720p (`services/convert-video.ts`).
3. **Upload** (`listings/services/upload-media.ts`): two files at a time, each through
   `services/file-upload.ts` (presigned PUT or parts, retries, network waits).
4. **Processing**: the server makes thumbnails and checks the file; the app asks every 3 s
   until it says READY or FAILED.

## `features/media/`

- `api/media-uploads.ts`: the media endpoints and the PUT to storage.
- `constants/`: `limits.ts` (sizes, counts, lengths), `formats.ts` (the pickers' accept),
  `upload.ts` (retries, URL lifetime).
- `types/`: `media.ts` (kinds, refusal reasons), `image.ts`, `video.ts`, `upload.ts`.
- `utils/`: `media-detector.ts`, `media.ts`, `image.ts`, `video.ts`, `retry-policy.ts`.
- `services/`:
  - `image-queue.ts` → `image-worker.ts` → `image-worker-thread.ts`: one photo at a time in a
    worker;
  - `convert-video.ts`: conversion to 720p (mediabunny + WebCodecs);
  - `file-upload.ts` + `browser-transport.ts`: one file's upload.

`video/video-utils.ts` only re-exports `readVideoMetadata` for the uncommitted media lab
page; it goes once that page imports `utils/video`.

## `features/listings/` (the media part)

| File                       | What it holds                                             |
| -------------------------- | --------------------------------------------------------- |
| `types/draft-media.ts`     | A draft file and its states                               |
| `utils/draft-media.ts`     | `newDraftMedia`, `isFailed`                               |
| `utils/listing-draft.ts`   | What Post needs from the whole draft                      |
| `utils/tile-view.ts`       | What a tile and the viewer show for a file                |
| `services/add-media.ts`    | Detect, check, optimize each picked file; end a draft     |
| `services/upload-media.ts` | Upload queue and processing status                        |
| `constants/messages.ts`    | What the seller reads: refusals, upload and server errors |

Photos are reordered by holding one and dragging it (`@dnd-kit/sortable`); the first photo
is the cover.

Device experiments live in `features/lab/media/` (the media lab page), not here.
