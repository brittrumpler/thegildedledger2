# Attribution and third-party materials

## Sea of Thieves

Sea of Thieves, its item images, item names and related game content are owned by Microsoft / Rare. This unofficial noncommercial fan reference is not endorsed by Microsoft or Rare. Game screenshots are used as reference illustrations under [Microsoft’s Game Content Usage Rules](https://www.xbox.com/en-US/developers/rules). No affiliation or official in-game integration is claimed.

The `assets/image-packs/` scripts contain the original image bytes of item thumbnails retrieved from SoTDB, plus missing images where available from wiki infoboxes. `assets/hero-chest.png` is the Sea of Thieves Wiki’s full Chest of Fortune game render, sourced from https://seaofthieves.wiki.gg/images/Chest_of_Fortune.png. The eight world-event images are also bundled from the corresponding SoTDB source pages. Each catalog entry retains the SoTDB item URL; wiki-sourced image entries additionally retain `imageSource`. Screenshots and other game materials are excluded from the MIT code license.

## Catalog and event relationships

[SoTDB’s loot map](https://sotdb.gg/loot/), with data compiled from the Sea of Thieves Wiki and verified/extended by PhuzzyBond. Retrieved November 10, 2026. Each event preserves source links, observed quantities, shared-pool metadata, chance flags and verification labels. This project reformats those facts and overrides the Chest of Fortune relationship using official patch 3.9.0. It does not independently certify every drop.

## Sale values and wiki material

[Sea of Thieves Wiki](https://seaofthieves.wiki.gg/wiki/Treasure), wiki contributors. Source-specific URLs and review dates are carried with each price. Wiki-derived material and its adaptations are attributed under [Creative Commons Attribution–NonCommercial–ShareAlike 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), subject to the wiki’s own copyright notices and exceptions. This source-derived data is separate from the MIT application code.

Changes: prices normalized into JSON; payouts derived mathematically; images resized by the source; relationships reorganized into searchable cards and event lists. Descriptive interface prose and nautical decorative artwork are original to this project.

## Event information

- [Official Events Hub](https://www.seaofthieves.com/event-hub): recurring Gold Rush windows and Twitch Drops.
- [November 2026 announcement](https://www.seaofthieves.com/news/this-month-november2026): dated November events and Emissaries of Fortune.
- [Official release notes 3.9.0](https://www.seaofthieves.com/release-notes/3.9.0): Season 21 bonus Chest of Fortune rules.

Dates and factual schedule information were paraphrased into `data/calendar.json`. Official announcement prose is not reproduced.

## Fonts

- Cinzel by Natanael Gama, sourced from Google Fonts, SIL Open Font License 1.1.
- IM Fell English by Igino Marini, sourced from Google Fonts, SIL Open Font License 1.1.

The bundled fonts are unmodified Google Fonts font files. Full license notices accompany them in `assets/fonts/`. Decorative compass artwork in `assets/mark.svg` is original application artwork.

## Cosmetic and commendation journal

Cosmetic thumbnails, canonical item URLs, acquisition relationships, commendation requirements, grades and reward relationships are sourced from [SoTDB categories](https://sotdb.gg/categories/), its public typed listings, item pages and sitemap. Retrieved November 10, 2026. Each record retains its source URL. Cosmetic images are loaded on demand from the source, or through the bounded Cloudflare image cache; they are not part of the MIT application code. Records are normalized and reorganized for search and progress matching. The counts reflect that source's listing and may include title records alongside commendations.

## Official profile compatibility

The optional exporter reads the user's already signed-in [official Sea of Thieves profile](https://www.seaofthieves.com/profile/overview) on that official origin and downloads sanitized JSON locally. Public endpoint shapes were researched using [Geekya's profile viewer bookmarklet](https://geekya.com/games/sot/profile-viewer/script) and public profile models. The Ledger exporter and parser are independent implementations; no guarantee of a supported Rare API is implied. Matching rules preserve unknown progress and distinguish inventory ownership from unlock entitlements.

Microsoft/Xbox authentication follows Microsoft's published website sign-in flow. Users supply their own app registration and Cloudflare secret configuration; no third-party credentials are distributed.
