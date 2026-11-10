# Connect Microsoft / Xbox accounts on gilded-ledger.us

The code is ready, but Microsoft will not issue real account tokens until you register your own application. No client secret is included in this repository. Catalog browsing, local journals, manual completion, profile-file imports and backups work before sign-in is enabled.

## 1. Deploy the Cloudflare Worker

Upload the contents of this release to your GitHub repository. In your connected Cloudflare Worker build settings use:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Root directory | Leave blank when the files are at the repository root |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

`wrangler.jsonc` points to `server/worker.mjs` and the generated `dist` assets. It is configured for `https://gilded-ledger.us`. The Worker name is `the-gilded-ledger`; change that name in the config if your existing Cloudflare Worker uses a different name. Keep your domain connected to that Worker.

This update includes server routes. The older `wrangler deploy --assets .` command alone does not install those account and guide routes. Use the new config and commands above.

## 2. Register a personal Microsoft application

Follow [Microsoft’s Xbox website sign-in documentation](https://learn.microsoft.com/en-us/gaming/gdk/docs/services/fundamentals/s2s-auth-calls/service-authentication/live-website-authentication).

1. In the Microsoft Entra admin center / Azure portal, open **App registrations → New registration**.
2. Name the app **The Gilded Ledger**.
3. Choose **Personal Microsoft accounts only**.
4. Add the **Web** redirect URI exactly:

```text
https://gilded-ledger.us/api/auth/callback
```

5. Register the app and copy its public **Application (client) ID**.
6. Under **Certificates & secrets**, create a client secret. Copy the **secret value**, not its identifier.

If requested when configuring branding, use your site URL and the included privacy page at `https://gilded-ledger.us/privacy.html`. Xbox access remains subject to Microsoft’s application/account requirements and the user's privacy settings. If Microsoft or Xbox rejects access, the journal shows an error and preserves local progress. Sign-in cannot be verified end to end without your registered application.

## 3. Add Cloudflare variables and secrets

In the deployed Worker’s **Settings → Variables and Secrets**, add:

| Name | Type | Value |
|---|---|---|
| `MICROSOFT_CLIENT_ID` | Text variable | Your public Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | Secret | The client secret **value** |
| `AUTH_SECRET` | Secret | A random value of at least 32 characters |
| `SITE_URL` | Text variable | `https://gilded-ledger.us` |

On macOS, you can generate an AUTH_SECRET in your own Terminal with:

```sh
openssl rand -hex 32
```

Paste that output directly into Cloudflare as a secret. Do not commit either secret, paste it into chat, or add it to client-side JavaScript. The Worker config uses `keep_vars` so dashboard variables are preserved on deployment. Rotate the Microsoft secret before its expiration; rotating AUTH_SECRET signs out existing Ledger sessions.

Save/deploy the settings. Visit **My Pirate → Connect Microsoft / Xbox**. Microsoft handles the login screen; after successful authorization you return to the journal with your Xbox identity.

## 4. Enable optional account journal storage

If you want progress available across devices:

1. Create a **Workers KV** namespace, for example `gilded-ledger-profiles`.
2. In your Worker’s **Bindings**, add a KV namespace binding named exactly **`LEDGER_PROFILES`**, selecting that namespace.
3. Keep the binding when updating the Worker. If using Wrangler-managed bindings, add the namespace ID returned by Cloudflare to a `kv_namespaces` entry in `wrangler.jsonc`:

```json
"kv_namespaces": [
  { "binding": "LEDGER_PROFILES", "id": "YOUR_REAL_NAMESPACE_ID" }
]
```

Do not use the example placeholder as an actual ID. Sign in again or reload My Pirate. **Save journal to my account**, **Load my account journal**, and **Delete saved cloud journal** appear when storage is bound. Saves are explicit, not automatic. Cloudflare KV can take time to propagate changes between locations.

Without that binding, Microsoft identity can still connect and progress remains on the current browser. Importing a pirate with a different gamertag does not silently merge its progress into the connected Xbox identity.

## 5. Import actual Sea of Thieves progress

Sign-in identifies the account; it does not grant the Ledger automatic access to Rare’s separate profile endpoints.

1. In **My Pirate**, drag **Export my Gilded Ledger profile** to your browser’s bookmarks bar.
2. Open `https://www.seaofthieves.com/profile/overview` and sign in on that official site. Use English profile text for name matching.
3. Click the bookmark. It reads the current official profile sections and downloads a JSON file locally. No cookie, password or access token is exported or posted elsewhere.
4. Return to the Ledger and choose **Import profile JSON**.
5. Review matched/unmatched totals. If account storage is enabled, choose **Save journal to my account**.

The importer reads the known `reputation` Emblems/Campaigns fields and actual owned `chestData` entries. It supports the Ledger exporter and compatible raw/Geekya-style v2 profile exports. Exact normalized names and canonical cosmetic slug aliases are used; ambiguous or missing matches stay unknown. Failed sections preserve their last known snapshot and show separate section dates. Unlocking a cosmetic for purchase does not mark it owned.

Re-import after playing. This is a manual snapshot, not live ship inventory, location, treasure detection or server-event tracking. The official website’s profile endpoints are not a guaranteed public integration contract; changes there may require updating `profile-exporter.js` and the parser.

## Verification performed

- OAuth state, PKCE, encrypted HttpOnly sessions, CSRF checks and per-account storage isolation are covered by automated tests.
- Microsoft/Xbox token exchanges were tested with synthetic responses; no real user credentials were used.
- Profile parsing and UI import were tested with expressly synthetic profile data, not a captured player account.
- Real sign-in must be checked after your app ID, secret and redirect URI are configured.
