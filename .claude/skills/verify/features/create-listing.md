# Create listing

A seller posts a listing from the "Đăng tin" page. They pick up to 10 photos and one video, which are checked, optimized and uploaded while they fill in the fields. The first photo is the cover. The draft stays while they visit other pages, and Post sends it once every file is uploaded, answering each server outcome in words.

## Sub-features

- `sell-media-pick` adds photos ("Thêm ảnh") and one video ("Thêm video"), and refuses unusable files in one toast without a tile.
- `sell-tile-states` shows each tile's state ("Đang kiểm tra", "Đang tối ưu", "Đang chuyển 720p", "Chờ tải lên", "Đang tải lên", "Chờ mạng", "Đang thử lại", ready, error) and opens a viewer with "Thử lại", "Đặt làm ảnh bìa" and "Xoá".
- `sell-reorder` moves a photo by long-press drag or "Đặt làm ảnh bìa". The first photo carries "Ảnh bìa".
- `sell-fields` covers "Danh mục", "Tiêu đề", "Mô tả", "Giá bán (VNĐ)", the "Tình trạng" radios and "Địa điểm", each with one message when wrong.
- `sell-draft` keeps files and fields while the seller is elsewhere, shows the banner "Bạn có tin đăng chưa hoàn tất" on other pages, and "Huỷ tin" ends it.
- `sell-post` keeps Post disabled while files upload, then answers 201 or 202 (opens "Quản lý tin"), 400 (marks fields), 409 (marks files), 422 (opens the listing already posted), and network or 5xx failures (keeps the draft and its key).

## How to get to it (user POV)

- Choose the raised "Đăng tin" in the tab bar.
- Choose "Tiếp tục" in the "Tin đang đăng dở" banner on any other page, including a listing's page.
- Choose "Đăng tin ngay" on the empty "Đang hiển thị" tab of "Quản lý tin".

## Driving it with Playwright (verify drive)

Preconditions:

- Baseline from the [README](./README.md), with an API this run owns (`--api-port`). Posting writes listings and media.
- A media worker is running for the listing to leave processing, and `doctor` lists it. Without one, a post answers 202 and stays in "Đang xử lý".
- Fixtures come from `fixture('photo-a.jpg')`, `'photo-b.jpg'`, `'clip.mp4'` and `'blank.jpg'` in `e2e/fixtures`. The worker fails the blank photo.

- **Open.** Run `openSellPage(page)`. The heading "Hình ảnh sản phẩm" is visible and resting, and `sellForm(page)` is the form "Tin đăng mới".
- **Pick photos and video.** Run `addPhotos(page, ['photo-a.jpg', 'photo-b.jpg'])` and `page.getByLabel('Thêm video', { exact: true }).setInputFiles(fixture('clip.mp4'))`. Tiles `getByRole('listitem', { name: /^Ảnh \d+$|^Video$/ })` appear, and the first contains "Ảnh bìa". Each tile's button reads `<Ảnh N|Video>, <state>. Chạm để xem` and reaches `đã sẵn sàng`.
- **Refused file.** Set the "Thêm ảnh" input to a PDF. The toast reads "Vui lòng chọn ảnh JPG, PNG hoặc WebP (doc.pdf)." and no tile is added.
- **Viewer and cover.** Tap `getByRole('button', { name: /^Ảnh 2/ })`. `getByRole('dialog', { name: 'Ảnh 2' })` opens. Choose "Đặt làm ảnh bìa". The tile that was second is now first. `dragPhoto(page, from, to)` does the same by touch.
- **Remove.** Choose `getByRole('button', { name: 'Xoá Ảnh 2' })`. One tile fewer.
- **Field checks.** On an empty form, choose `postButton(page)`. Exactly one message shows per field ("Vui lòng chọn danh mục.", "Vui lòng nhập tiêu đề từ 3 đến 120 ký tự.", and so on), plus "Vui lòng thêm ít nhất 1 ảnh…", and Post turns disabled until they are fixed. `fillFields(page, title)` fills a valid set, and the price shows as `6.990.000`.
- **Uploading.** While files upload, Post is disabled and `getByRole('status')` reads "Đang tải ảnh và video lên. Nút Đăng tin sẽ mở khi xong.". `expectReadyToPost(page)` waits for the end.
- **Draft survives.** Fill "Tiêu đề", choose `tab(page, 'Trang chủ')`. `getByRole('complementary', { name: 'Tin đang đăng dở' })` shows "Bạn có tin đăng chưa hoàn tất". Choose its "Tiếp tục". The title and tiles are still there.
- **Discard.** Choose "Huỷ tin" in the form. The dialog "Huỷ tin đang đăng?" offers "Tiếp tục đăng" and "Huỷ tin". Confirming shows "Đã huỷ tin." and an empty form.
- **Post.** With everything ready, choose `postButton(page)`. It reads "Đang đăng…" and the draft is locked. On 201, "Đã đăng tin." shows and "Quản lý tin" opens on "Đang hiển thị". On 202, "Đã đăng tin. Tin sẽ hiện với người mua khi ảnh và video xử lý xong." shows and "Đang xử lý" opens. `api-calls.txt` has `POST /products -> 201` or `-> 202`. Confirm from a second view: the card on its tab, then the listing's page.
- **400, 409, 422.** Mock one answer with `answerPost(page, status, error, { times: 1 })` as in `e2e/post-listing.spec.ts`. For 400, the refused fields are marked and Post stays disabled until each changes. For 409, "Vui lòng xoá rồi chọn lại các tệp được đánh dấu." shows, the refused tile reads `Ảnh N, có lỗi.`, and removing it re-enables Post. For 422, "Tin này đã được đăng trước đó." shows and the existing listing opens. Name the mock in the report.
- **Proof.** Screenshot and ARIA snapshot after picking, after the uploads are ready, after Post, and on the second view. Keep `api-calls.txt` with the upload calls (`/media/…`) and `POST /products`.

## Gotchas

- The draft lives in memory only. A reload or a new `page.goto('/')` loses it, so navigate with the tab bar.
- The page slides in. Touch points taken mid-slide miss their tile, so `openSellPage` waits for the heading to rest.
- The home page stays in the DOM behind the form with its own filter controls. Scope field locators to `sellForm(page)`.
- The dragging code listens to touch only, and a tap within 50 ms of a drag is swallowed. Use `dragPhoto` from `e2e/support.ts`.
- Processing errors (a blank photo, an unplayable video) show only when Post is pressed, as a 409. An upload counts as done once `complete` answers.
- Without a worker, a posted listing stays in "Đang xử lý". That is not a frontend bug.
- Each draft has one idempotency key, reused on retries. A retried post must not create a second listing.
