# Home feed

The home page ("Chợ Zalo") lists published listings newest first in a two-column grid. A buyer can narrow the list by category, search text and filters, sees a short muted video preview play on a card near the middle of the screen, and comes back from a listing to the same list.

## Sub-features

- `feed-list` shows "Tin đăng mới" with listing cards and loads more at the end ("Bạn đã xem hết tin đăng." when done).
- `feed-category` toggles one category from the strip.
- `feed-search` searches listings as the buyer types, with an empty state that clears everything.
- `feed-filters` applies area, category, condition, "Có video", price range and sort from the filter sheet, shown as removable chips.
- `feed-autoplay` plays a video card's preview near the middle of the screen, twice, then shows the cover again.
- `feed-restore` keeps search, filters and scroll position after opening a listing and going back.

## How to get to it (user POV)

- Open the app. Home is the first page.
- Choose "Trang chủ" in the tab bar from any other tab.
- Go back ("Quay lại") from a listing opened from the feed.

## Driving it with Playwright (verify drive)

Preconditions:

- Baseline from the [README](./README.md). The whole recipe is `scripts/verify drive home-feed`. It is read-only and safe on a borrowed API.
- For `feed-autoplay`, Vite runs with `VITE_FEED_AUTOPLAY=true` (launch sets it) and the API serves media from `http://localhost:4566` (`doctor` prints `S3_PUBLIC_ENDPOINT`).

- **Open.** Run `page.goto('/')`. The heading "Chợ Zalo" (level 1) shows, `tab(page, 'Trang chủ')` has `aria-current="page"`, `getByRole('group', { name: 'Lọc theo danh mục' })` holds the buttons "Điện tử", "Nhà cửa", "Thời trang", "Xe cộ" and "Khác", and the "Tin đăng mới" heading sits above buttons named `Xem chi tiết <title>`.
- **Category.** Choose "Điện tử" in that group. It gets `aria-pressed="true"`, the list heading turns to "Kết quả", the chip `button` "Bỏ lọc Điện tử" shows, and `api-calls.txt` has `GET /products?categoryId=cat_electronics…`. Choosing it again clears it.
- **Search match.** Fill `getByRole('searchbox', { name: 'Tìm kiếm tin đăng' })` with a word from a visible card's title. After the debounce, `GET /products?q=<word>` runs and a card with that title stays.
- **Search empty.** Fill it with `khongcotinnaokhop`. The text "Không tìm thấy tin phù hợp" shows. Choose "Xoá tìm kiếm và bộ lọc". The searchbox is empty and "Tin đăng mới" is back.
- **Filters.** Choose `getByRole('button', { name: 'Mở bộ lọc', exact: true })`. The sheet "Lọc tin đăng" opens with "Khu vực" (select), pills under "Danh mục", "Tình trạng" ("Mới", "Như mới", "Đã dùng"), "Loại tin" ("Có video"), the inputs "Giá từ" and "Giá đến", and "Sắp xếp" ("Mới nhất", "Cũ nhất", "Giá thấp đến cao", "Giá cao đến thấp"). Choose "Có video", then "Áp dụng". `GET /products?hasVideo=true…` runs, the filter button is renamed "Mở bộ lọc, đang áp dụng 1 bộ lọc", the chip "Bỏ lọc Có video" shows, and every card shows the "Video" badge. "Xoá lọc" resets the sheet. With two or more chips, "Xoá tất cả" clears them.
- **Autoplay.** With a video card near the middle of the screen, poll the feed for a `video` element that is playing with `currentTime > 0`. The screenshot alone cannot show playback, so the poll is the proof.
- **Restore.** Open the first card. Its title is the level 1 heading. Choose `getByRole('button', { name: 'Quay lại' }).last()`. "Trang chủ" is current again and the chip "Bỏ lọc Có video" is still there.
- **Proof.** The drive saves `01-feed` through `09-filter-removed` (`.png` and `.aria.yml`) and `api-calls.txt` in its evidence folder.

## Gotchas

- Seeded titles repeat. A name locator can match several cards, so take `.first()`.
- Search waits 300 ms after typing. Wait for the `GET /products?q=` request or the heading, not a fixed sleep.
- No preview plays while the filter sheet is open, and a preview stops after two plays. Assert playback before opening another sheet.
- The Reels API on 3002 may run with `S3_PUBLIC_ENDPOINT` pointing at a phone-test tunnel. With that API, covers and previews may not load in a desktop browser.
- The home page stays in the DOM behind other pages. Scope to the `main` that holds the "Danh mục" heading.
