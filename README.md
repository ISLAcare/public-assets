# public-assets

Public image hosting for outbound Isla comms — email graphics, external links, and other public-facing imagery. This repo is intentionally simple and completely separate from the app codebase.

## Uploading an image

1. Open this repo in the browser: <https://github.com/ISLAcare/public-assets>
2. Click **Add file → Upload files**
3. Drag your image in (PNG, JPG, GIF, WebP, SVG all fine)
4. Add a short commit message and **Commit changes**

Feel free to organise into folders, for example `campaigns/2026-08-launch/hero.png`.

## Getting the URL to paste into an email

Two formats work. Either is fine as an `<img src="...">` in an email; use whichever your email client is happier with.

- **GitHub Pages URL** (recommended — CDN-backed, slightly cleaner):
  `https://islacare.github.io/public-assets/<path>/<filename>`

- **Raw content URL**:
  `https://raw.githubusercontent.com/ISLAcare/public-assets/main/<path>/<filename>`

Example: `https://islacare.github.io/public-assets/hero.png`

## Notes

- Anything committed here is **public forever**. Treat it like a public website: no patient data, no NHS numbers, no internal-only material, no draft strategy content.
- File size limit is 100 MB per file. GitHub warns above 50 MB. Optimise large images before uploading.
- The Pages URL takes a minute or so to update after a new commit while the site rebuilds. The raw content URL updates instantly.
- To replace an image without changing the URL, upload a new file with the same name. The URL stays stable and old versions remain in git history.
- To remove an image, delete it via **Add file → Delete file** (or from the file view). URLs 404 immediately.