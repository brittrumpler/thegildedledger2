# The Gilded Ledger — GitHub Pages ready

A Sea of Thieves treasure ledger, world-event loot guide, Gold Rush calendar, and local haul tracker. This repaired package uses **six validated image packs** instead of hundreds of separately uploaded image files. It supports repository Pages URLs such as `https://YOUR-NAME.github.io/YOUR-REPOSITORY/`.

## Publish using the GitHub website

1. Extract the ZIP on your computer.
2. Open your GitHub repository and select **Add file → Upload files**.
3. Drag in the **contents** of the extracted folder. Preserve the `assets`, `data`, `scripts` and `tests` folders. Upload the actual files, not the ZIP. `index.html` must appear at the repository root.
4. Commit the upload to `main`.
5. Go to **Settings → Pages → Build and deployment → Source → Deploy from a branch**.
6. Select **main** and **/(root)**, then **Save**.
7. Wait for the Pages deployment and open the URL shown in Settings → Pages.

There is no install or build step for this method. You may open `index.html` directly in your browser to preview the bundled release locally. GitHub's browser upload limit is 100 files at once and 25 MiB per file; the release is below both limits.

If replacing the old site, keep the new folder structure and replace `index.html`, `styles.css`, and the JavaScript files. Old `assets/items` image files can be removed once the new version works. Refresh the published page with Cmd+Shift+R if a browser is still showing the old version.

## Enable automated refresh and deployment

The optional `github-pages-workflow.yml` can publish directly and attempt daily data refreshes. It is supplied as a visible file so the initial upload does not depend on finding a hidden folder. On GitHub, choose **Add file → Create new file**, use the filename `.github/workflows/pages.yml`, paste the contents of `github-pages-workflow.yml`, and commit it.

Then set **Settings → Pages → Source → GitHub Actions**. In **Actions → Refresh data and publish Pages**, choose **Run workflow**. Initial/manual publication uses the bundled data and never requires the upstream wiki to be available. Scheduled runs try to refresh SoTDB and the wiki bulk tables; a failed upstream request leaves the bundled version available for deployment. The workflow needs contents write, Pages write, and ID-token write permissions; repository policies may restrict automatic data commits.

Individual wiki item sources are refreshed only on Sundays when repository variable `REFRESH_ITEM_DETAILS=true` is enabled. Requests run sequentially and stop on rate limiting. Prices preserve their own source review dates. GitHub's scheduled runs can be delayed or disabled on inactive repositories.

## What is included

- 403 catalog entries, 365 sourced price entries and 379 item photos, plus eight bundled world-event images.
- Search, category/company filters, bookmarks, and minimum–maximum Grade I–V payout estimates.
- Eight source-reported world-event loot pools, including shared groups and possible bonus Chest of Fortune drops.
- Local-time Gold Rush countdown, time zone conversion, DST handling, and seven-day calendar export.
- Dated official announcements, with expired entries hidden and stale-review warnings.
- A local haul with separate currencies and quantity controls.

Snapshot review: November 10, 2026. Missing prices and the 24 missing item photos are explicitly marked. The source catalog includes quest objects, historical items and cosmetics; fish, meat, animal variants and every sale exception are not exhaustive. Group ranges and commodity sale conditions are identified in item details. This is a dated community reference, not an official game API or connection to your game session.

Standard company payout estimates use 1×, 1.33×, 1.67×, 2× and 2.5× for eligible sales. Guild rates differ. Temporary event bonuses are excluded. Item condition, buyer, charge and special turn-ins may change the payout.

## Maintain the source

Requires Python 3.9+ and Node 20+ for tests. No npm package installation is required.

```sh
npm test
npm run build
```

`npm run build` regenerates image packs, data scripts, and `app.bundle.js`, then writes a minimal deployment to `dist/`. The repository root already contains the generated publishable files.

```sh
python3 scripts/sync_data.py --images
python3 scripts/enrich_data.py --images
npm run build
```

Commit `data/`, `assets/image-packs/`, `app.bundle.js`, and `index.html` after refreshes. Individual downloaded `assets/items/` files are ignored; their bytes are consolidated into the packs. The preparer keeps old pack images if a source image is temporarily unavailable.

- Edit `app.js` and `core.js`, then rebuild; do not edit generated `app.bundle.js` directly.
- `data/catalog.json` and `data/prices.json` retain item evidence and review dates.
- `data/catalog.js` and `data/calendar.js` make the static/local release work without fetching JSON.
- `assets/image-packs/pack-*.js` contain base64 image bytes with verified MIME types; these are required website assets.
- `data/calendar.json` needs manual updates from official event announcements. Update `reviewedAt`, then rebuild. Recurring Gold Rush is a published schedule; server-side suspension during multiplier events cannot be detected.
- Season 21 Chest of Fortune rules are reviewed against official release notes 3.9.0 and require review when the rules change.

## Privacy and credits

Bookmarks, haul and time zone stay in browser local storage. There are no sign-ins or analytics. All release images and fonts are bundled; no image hotlinks are required.

Application code: MIT. Game screenshots and wiki-derived data have separate terms. See [THIRD_PARTY.md](THIRD_PARTY.md). This is an unofficial, noncommercial fan project, not endorsed by Microsoft or Rare.

Reference: [GitHub upload limits](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository) and [Pages publishing settings](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Release verification

All 387 bundled images were fully decoded. The extracted ZIP was tested under a repository-style HTTP path, with treasure photos, emissary tables, world-event navigation and the Gold Rush calendar. Direct `file://` browser testing was blocked by the browser automation security policy; the local-preview bundle uses classic scripts and bundled data to avoid the former module/JSON startup restrictions. The archive passes its CRC check, and every release file is below GitHub’s browser upload size limit.
