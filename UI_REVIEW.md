# UI review

Run `npm run dev:showcase` and open http://127.0.0.1:4174/showcase.html.
If ZMP dev server is running, http://[::1]:2999/showcase.html also works.

Choose a screen in the sidebar, or select “Xem toàn bộ màn”. Each iframe is 390×844 (iPhone 13); 375px is also available. Scroll inside the phone to see the complete form. “Mở màn riêng” opens each screen separately.

Use `npm run build:showcase` to produce ui-review/. Serve that folder over HTTP and open /showcase.html. The standalone showcase does not call the auth backend. Sample product photos and ZaUI assets can require network access.

## Review scope

Home reuses HomePage and its original header. All phones reuse AppShell's curved footer. Prices use #0068FF. Posting and editing share ListingForm, also rendered by the app's SellPage.

18 selectable screens/states: home, filter, detail, post, selected images, validation, upload progress, upload failure, success, edit, management, profile, skeleton loading, no results, connection error, auth error, sold listing, missing listing.

Image picking and input validation work locally. Upload progress/retry, publishing, contact and management actions are simulations. The production SellPage submit remains disabled until its API is integrated. Search/filter UI reflects the current app and is not a completed filtering implementation. The success UI does not claim that a post was merely previewed or unsent.

One mandatory main image is separated from optional gallery images. The current API contract limits the total to 10 media items; 9 gallery slots are a temporary interpretation, not a new approved product rule. API role mapping and location taxonomy still need alignment.

Design constraints: DESIGN.md. No generated bitmap board is the source of truth.
