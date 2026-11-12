# Deploy the Gilded Ledger

In Cloudflare, connect the `the-guilded-ledger` Worker to this repository with these production build settings.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `deploy` |
| Build command | Leave blank |
| Deploy command | `npx wrangler deploy` |

The site is already built in `public/`. Keep the Microsoft sign-in settings in the Worker's runtime variables and secrets. Wrangler reads `wrangler.jsonc` from this directory.
