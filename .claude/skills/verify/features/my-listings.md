# My listings

"Quản lý tin" lists the seller's own listings under five status tabs, with counts where the seller needs them. From a card's menu the seller marks a listing sold, hides it and shows it again, or edits it in the sell form, including replacing its photos and video.

## Sub-features

- `mine-tabs` switches between "Đang hiển thị", "Đang xử lý", "Bị lỗi", "Đã bán" and "Đã ẩn", with "N tin" above the list and a count badge on "Đang xử lý" and "Bị lỗi".
- `mine-card` shows a card's title, price and status line ("Đã đăng · …", "Đang xử lý ảnh, video", "Ảnh bị lỗi", "Đã bán · …", "Đã ẩn · …") and opens the listing.
- `mine-sold` marks a published listing sold after confirming. Sold is final.
- `mine-hide` hides a published listing ("Ẩn tin") and brings it back ("Hiện lại").
- `mine-edit` opens "Sửa tin" for a processing, failed or published listing, saves only what changed, asks before leaving with unsaved changes, and replaces media.
- `mine-repair` fixes a failed listing by replacing the file the worker refused.

## How to get to it (user POV)

- Choose "Quản lý tin" in the tab bar.
- After a successful post, the app opens it on "Đang hiển thị" (201) or "Đang xử lý" (202).
- From the owner's listing page, "Tuỳ chọn tin đăng" offers the same actions.

## Driving it with Playwright (verify drive)

Preconditions:

- Baseline from the [README](./README.md), with an API this run owns. Every action here writes.
- The dev user owns listings in the states you drive. Post fresh ones first (see [Create listing](./create-listing.md)) and title them `E2E verify …`. A published listing needs a running worker.
- A failed listing: post `blank.jpg` through the API as `postBlankListing` does in `e2e/edit-listing.spec.ts`. The worker then fails it.

- **Open.** Run `page.goto('/')`, then `tab(page, 'Quản lý tin').click()`. `getByRole('tablist', { name: 'Trạng thái tin' })` shows. `getByRole('tab', { name: /^Đang hiển thị/ })` has `aria-selected="true"`. `api-calls.txt` has `GET /me/products?status=PUBLISHED…`.
- **Switch tab.** Choose `getByRole('tab', { name: /^Đã bán/ })`. It is selected, the `tabpanel` shows that tab's cards (`getByRole('article')`) or its empty state, and "N tin" matches the count.
- **Card.** `getByRole('tabpanel').getByRole('article').filter({ hasText: title })` is the card. Its `Xem chi tiết <title>` opens the listing. Its `Tuỳ chọn cho <title>` opens the sheet "Tuỳ chọn".
- **Mark sold.** From the sheet, choose "Đánh dấu đã bán". The dialog "Đánh dấu đã bán?" offers "Chưa bán" (nothing changes) and "Đã bán". Confirming shows "Đã đánh dấu đã bán", and the card leaves "Đang hiển thị". On "Đã bán" it reads "Đã bán · …" with no "Tuỳ chọn cho" button, and the tab total grows by one.
- **Hide and show again.** Choose "Ẩn tin". "Đã ẩn tin" shows and the card moves to "Đã ẩn" as "Đã ẩn · …". There, choose "Hiện lại". "Đã hiện lại tin" shows and the card is back on "Đang hiển thị".
- **Edit.** Choose "Sửa tin" in the sheet (scope to `.zaui-sheet`, because a failed card has its own "Sửa tin"). `getByRole('form', { name: 'Sửa tin đăng' })` opens under the header "Sửa tin", filled with the listing. Change "Tiêu đề" and "Giá bán (VNĐ)", choose "Xoá Ảnh 2", `addPhotos(page, ['photo-b.jpg'])`, wait for "Lưu" to enable, and choose it. `PATCH /products/<id> -> 200` carries only the changed fields and the full `mediaIds`. "Đã lưu thay đổi." shows (or "Đã lưu. Tin sẽ hiện lại khi ảnh và video xử lý xong." when new media is processing) and "Quản lý tin" opens. Reopen the listing: the new title is the heading and the new price shows.
- **Leave with changes.** Edit a field, then choose "Quay lại". The dialog "Bỏ các thay đổi?" offers "Tiếp tục sửa" (the edit stays) and "Bỏ thay đổi" (back to "Quản lý tin"). A sell draft in progress survives this.
- **Repair.** On "Bị lỗi", the card reads "Ảnh bị lỗi" with the hint "Vui lòng chọn ảnh khác: ảnh bị trống.". Choose its "Sửa tin", open `Ảnh 1, có lỗi. Chạm để xem`, and remove it from the viewer (`dialog` "Ảnh 1"). Add a good photo and save. The listing moves to "Đang xử lý", then "Đang hiển thị".
- **Proof.** Screenshot and ARIA snapshot of the card before and after each action, on both the tab it left and the tab it reached. Keep `api-calls.txt` with `POST /products/<id>/sold`, `/archive` or `/unarchive`, or `PATCH /products/<id>`.

## Gotchas

- Other drives and specs post as the same dev user. "Đang hiển thị" can grow under you, so count "Đã bán" and "Đã ẩn" instead.
- Sold is final. Mark sold only listings this run created.
- The mark-sold dialog locks page scrolling while open. After it closes, `.zaui-page.disable-scrolling` must be gone.
- A status change that raced another one answers 409: "Tin đã đổi trạng thái. Danh sách đã được cập nhật, vui lòng xem lại.".
- Only processing, failed and published listings can be edited. Others show "Không thể sửa tin này".
- Edits that add media need the worker, just like posting.
