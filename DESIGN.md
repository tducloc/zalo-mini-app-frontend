# Chợ Zalo — UI contract

Canonical reference: the existing HomePage, AppShell curved footer and fixed blue home header. Screens in showcase.html render these same components. Do not regenerate UI as bitmap designs.

- Primary and all product prices: #0068FF. Text: #111B3D; secondary: #68769B; background: #F5F8FF.
- System font. Body 14–16px, titles 20–22px, card titles 14px; 16px page gutters, 8/12/16/24px spacing. Controls at least 44px tall.
- Cards radius 16px, controls 10px; subtle #E7ECF5 borders. No large shadows. Loading keeps the same content geometry.
- Home title reserves space for Zalo controls; search + notification in second row. Entire header stays fixed. Preserve the existing five-item curved footer, aligned labels, disabled messaging.
- Product prices use one shared Price component in new screens. Existing Home .listing-price uses the same token.
- Form fields: category, title (3–120), description (10–5000), positive integer VND price, condition NEW/LIKE_NEW/USED, location. Explicit associated labels and inline errors.
- One main image, required; a separate optional gallery. Current API allows 10 media total; prototype uses 1 cover + up to 9 gallery images pending confirmation. No 8-image rule is approved.
- Image selection in prototype stays local. Each image owns its loading/error overlay and retry affordance. Demo publish never calls backend.
- Four enabled categories: electronics, home, fashion, vehicles; Other disabled.
- Category icons use the blue theme (blue icon on a pale-blue circle), rather than unrelated accent colors.
- Home loading, empty search, and connection error preserve the same fixed title, Zalo controls, and search header. Loading belongs in content, never in the header.
- Showcase includes Home/filter, detail, posting/editing, management, profile, authentication, loading, empty, error, image selection/upload, validation, and publish success.
- Screenshot at 390×844 and check overflow at 375px before handoff. Showcase is a separate development entry; no auth or backend required.
- Pending implementation: upload API main/gallery role mapping, listing APIs, persisted filter/search, seller contact integration. Do not present simulated actions as implemented business features.
