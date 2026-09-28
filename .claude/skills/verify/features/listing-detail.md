# Listing detail

A listing's page shows its photos and video in a swipeable gallery that opens a full-screen viewer, then the title, price, category, condition, place, description and seller. A buyer can contact the seller, share or report the listing. The owner gets their own actions instead.

## Sub-features

- `detail-info` shows the title (level 1 heading), price, "category · condition · place", "Đăng <date>" and the description.
- `detail-gallery` swipes through every photo and the video, with the counter "N / M".
- `detail-viewer` opens photos full screen, swipes through all media, zooms a photo with a pinch or double tap, and plays the video.
- `detail-contact` opens the seller's Zalo profile, falling back to a phone call.
- `detail-share-report` lets a buyer share the listing and report it once.
- `detail-owner` gives the owner "Sửa tin", "Đánh dấu đã bán" and "Ẩn tin" from the same menu.
- `detail-gone` shows "Tin không còn tồn tại" for a removed or unknown listing.

## How to get to it (user POV)

- Choose a card (`Xem chi tiết <title>`) in the home feed.
- Choose a listing card in "Quản lý tin".
- After a post answered 422 (key reused), the app opens the listing that was already posted.
- A shared Zalo link opens `/products/<id>` directly. There is no browser URL route for it, so open it by one of the paths above.

## Driving it with Playwright (verify drive)

Preconditions:

- Baseline from the [README](./README.md). Everything except reporting and owner actions is read-only.
- A published listing with at least two photos and a video: in the home feed, open a card that has the "Video" badge.

- **Open.** Choose `getByRole('button', { name: 'Xem chi tiết <title>' }).first()` on home. The level 1 heading is the title, the tab bar is gone, and `api-calls.txt` has `GET /products/<id> -> 200`. Call `settled()` on the heading before the proof.
- **Gallery.** The counter has the accessible name `Nội dung 1 trên M`. Swipe the gallery left (touch drag over the square image). The counter reads `Nội dung 2 trên M`. A video slide is `getByLabel('Video: <title>')` with native controls and the cover as poster.
- **Viewer.** Choose a photo slide, `getByRole('button', { name: 'Phóng to ảnh' })`. `getByRole('dialog', { name: 'Ảnh và video: <title>' })` opens, with focus on "Đóng" and the counter "N / M" in the header. Scroll its track sideways to reach the video, which then loads and plays with controls.
- **Pinch zoom.** In the viewer, send a two-finger `Input.dispatchTouchEvent` through a CDP session (see `dragPhoto` in `e2e/support.ts` for the one-finger version), moving the fingers apart over the photo. The photo's `transform` includes `scale(>1)`, and sideways swipes stop moving the track until it zooms back. A double tap zooms in and back.
- **Close.** Choose "Đóng". The dialog closes and the gallery shows the slide the viewer was on.
- **Contact.** The bottom button reads "Liên hệ người bán", "Người bán chưa bật liên hệ" (disabled) or "Sản phẩm đã bán" (disabled). Outside Zalo, opening the profile fails, so the app shows "Gọi số điện thoại người bán" when the seller has a number, or the toast "Không thể mở liên hệ trên thiết bị này.".
- **Buyer menu.** Choose `getByRole('button', { name: 'Tuỳ chọn tin đăng' })`. The sheet "Tuỳ chọn" offers "Chia sẻ tin đăng" and "Báo cáo tin đăng". Choose "Báo cáo tin đăng". The sheet "Báo cáo tin đăng" shows `getByRole('radiogroup', { name: 'Lý do báo cáo' })`. Pick "Spam hoặc trùng lặp", then "Gửi báo cáo". The toast "Cảm ơn bạn. Báo cáo đã được gửi để kiểm tra." shows, and the menu now reads "Bạn đã báo cáo tin này" (disabled). This writes a report, so it needs an owned API.
- **Owner menu.** Open a listing the dev user posted. "Tuỳ chọn tin đăng" lists the actions for its status (see [My listings](./my-listings.md)) and "Chia sẻ tin đăng" while published. Report is absent.
- **Gone.** Open a listing, then have it removed or hidden from a second view. Reopening it shows "Tin không còn tồn tại" and "Về trang chủ".
- **Proof.** Screenshot and ARIA snapshot after opening, after a swipe, in the viewer (zoomed), and after a report. Keep `api-calls.txt` for `GET /products/<id>` and `POST /products/<id>/reports`.

## Gotchas

- Sharing calls the Zalo SDK. Outside Zalo it shows "Không thể mở bảng chia sẻ trên thiết bị này.", which is the expected browser result, not a bug.
- The gallery loops. With more than one item, the first and last slides are cloned, so `video` and `img` elements appear twice in the DOM.
- A video loads only while its slide is shown. Assert on the active slide.
- The detail page is not in the tab bar and the page slides in over home. Screenshots taken before `settled()` show both pages.
- The owner's unpublished listing is 404 to anonymous requests until sign-in finishes. Wait for the heading, not for the first response.
- Reporting your own listing answers 403 ("Bạn không thể báo cáo tin đăng của chính mình."). Report a seed listing instead.
