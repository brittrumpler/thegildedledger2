# The Gilded Ledger — Pirate Journal

An unofficial Sea of Thieves companion styled as a pirate's ledger, prepared for GitHub and a Cloudflare Worker at **https://gilded-ledger.us**.

## Publish

1. Extract the ZIP and upload its **contents** to your GitHub repository. Keep the folders intact, with `index.html`, `package.json` and `wrangler.jsonc` at the root. Do not upload the ZIP itself.
2. Connect that repository to your Cloudflare Worker. Use production branch `main`, root directory blank, build command **`npm run build`**, deploy command **`npx wrangler deploy`**.
3. Check the Worker name in `wrangler.jsonc` matches your existing Worker, then keep your custom domain attached to it.

The Node build has no application dependencies to install. It generates `dist/` and validates GitHub browser upload limits: fewer than 100 source files, each below 25 MiB. Upload the supplied source files; do not add generated `dist/`, caches or `node_modules` to that upload.

For Microsoft/Xbox identity, optional account storage, and official-profile imports, follow **[ACCOUNT-SETUP.md](ACCOUNT-SETUP.md)**. The catalog works before authentication is configured. No secrets are included. The server routes require Cloudflare Workers; GitHub Pages can serve the root static catalog but cannot provide account sign-in or cloud storage.

## Included

- 403 treasure/source objects, 365 sourced prices, Grade I–V emissary estimates and acquisition details.
- 379 treasure photos and eight world-event photos in six bundled image packs.
- Eight world-event loot pools, Gold Rush countdown, time zone conversion and calendar export.
- 9,117 cosmetic records across clothing, equipment, weapons, ship parts and other categories, with photos loaded on demand, acquisition details, reward links, ownership filters and wish lists.
- 1,340 source-listed commendation/title records with available requirements, grades and rewards.
- My Pirate journal: imported official profile snapshots, manual progress overrides, goals, backups, Microsoft/Xbox identity and optional private account saves.

Snapshot reviewed November 10, 2026. Coverage follows SoTDB's source listings; it is not a certification of every in-game item or commendation. Missing photos, requirements, prices and uncertain progress remain explicit. Some catalog labels are generic; canonical source URL aliases improve matching. The treasure catalog also contains quest, historical and other source objects; fish, meat and animal variants are not exhaustive.

Account sign-in identifies your Xbox account. Actual game progress is imported manually from the official website using the included bookmarklet. It is a dated snapshot, not live game-session access. Unknown or ambiguous names stay unknown, and unlocking a purchase does not imply ownership. Photos and on-demand guides need internet access; source outages may temporarily prevent them loading.

Standard eligible company sales use 1×, 1.33×, 1.67×, 2× and 2.5× emissary multipliers. Guild rates and special turn-ins differ. Temporary bonuses are excluded from base estimates. Gold Rush and dated events depend on official schedules; unexpected suspension cannot be detected automatically.

## Development and refresh

Requires Node 20+; optional data refresh scripts use Python 3.9+.

```sh
npm run build
npm test
npm run dev
```

Open `http://127.0.0.1:4176`. The dev server exercises the Worker routes with static assets but does not configure real Microsoft credentials or persistent account storage.

Edit `app.js`, `core.js`, `journal-core.js`, `styles.css` and `server/worker.mjs`, then rebuild. Generated `app.bundle.js`, `data/*.js` and image packs are committed for static use. Do not edit the bundle directly.

```sh
python3 scripts/sync_data.py --images
python3 scripts/enrich_data.py --images
python3 scripts/sync_journal.py
python3 scripts/sync_acquisition.py
npm run build
npm test
```

Full journal refreshes make many public source requests; run them deliberately. Review source changes before committing. Downloaded `assets/items/` files are consolidated into image packs; leave individual downloads and `.cache/` out of uploads. The optional `refresh-data-workflow.yml` can be copied to `.github/workflows/refresh-data.yml` for weekly treasure refreshes. It does not automatically crawl the entire cosmetics catalog. Review and update `data/calendar.json` from official announcements when schedules change.

## Privacy, sources and checks

Browser journals are local until you explicitly save to your connected account. The official-profile exporter downloads sanitized progress locally; it does not transfer credentials. See [privacy.html](privacy.html), [ACCOUNT-SETUP.md](ACCOUNT-SETUP.md) and [THIRD_PARTY.md](THIRD_PARTY.md).

Automated checks cover payout/calendar logic, import matching and uncertainty, partial snapshot merges, encrypted OAuth state/session handling, mocked Microsoft/Xbox exchanges, CSRF and account isolation. Mocked sign-in is not proof of a working live Microsoft application: verify that after configuring your registration and Cloudflare secrets.

Application code is MIT licensed. Game assets and source-derived material have separate terms. This fan project is not endorsed by Microsoft or Rare.
