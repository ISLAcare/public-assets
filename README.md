# public-assets

Public image hosting for outbound Isla comms: email graphics, external links, and other public-facing imagery. Kept entirely separate from the app codebase so it can't affect production.

## For most people: the web app

Open <https://islacare.github.io/public-assets/> in a browser.

- Drag and drop images into the drop zone to upload
- Scroll down to see the gallery, grouped by upload month
- Each card has three buttons:
  - **Copy URL** copies the Pages URL of the image
  - **Copy HTML** copies an `<img>` snippet ready to paste into an email
  - **Delete** removes the image after a confirmation

To upload or delete you need a GitHub token. The first time you try, the app asks you to add one; it's stored only in your browser's localStorage on this device.

### Generating a GitHub token

1. Visit <https://github.com/settings/personal-access-tokens/new>
2. Resource owner: `ISLAcare`
3. Repository access: Only select repositories -> `public-assets`
4. Permissions -> Repository permissions -> **Contents: Read and write**
5. Generate the token, copy it, paste it into the app's Settings panel
6. Approve the token in the ISLAcare org if prompted (an org owner may need to approve it once)

If a classic token is easier, generate one at <https://github.com/settings/tokens/new> with the `repo` scope. Fine-grained tokens are preferred.

## URL formats

Two work; the app defaults to the Pages URL when you press Copy URL.

- Pages URL (recommended, CDN-backed):
  `https://islacare.github.io/public-assets/images/<filename>`
- Raw content URL:
  `https://raw.githubusercontent.com/ISLAcare/public-assets/main/images/<filename>`

## Notes

- Everything in `/images/` is **public forever**. No patient data, NHS numbers, or internal-only material.
- File size limit is 5 MB per file. The app rejects anything larger. Email images rarely need to be bigger; run large files through an optimiser first.
- The Pages URL updates within a minute of upload once Pages rebuilds. The raw URL is instant.
- To replace an image and keep the URL stable, upload a file with the same name. Old versions remain in git history.
- Filenames are auto-slugified (lowercased, spaces to hyphens). If a name collides with an existing file, `-2`, `-3` and so on is appended.

## Uploading without the web app

You can still drag files into `images/` via the GitHub web UI: <https://github.com/ISLAcare/public-assets/tree/main/images>. The web app is just a nicer wrapper around the same repo.

## Structure

```
/
+-- index.html      web app markup
+-- app.js          web app logic (vanilla JS, no build)
+-- images/         uploaded images
+-- README.md       this file
```

No build step, no dependencies to install. Edit `index.html` or `app.js` directly on GitHub and commit; changes go live within a minute.
