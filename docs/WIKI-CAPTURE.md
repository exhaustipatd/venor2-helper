# Export the wiki from your normal browser

Collection runs inside your existing Chrome tab and profile. After you start it, the extension reads all pet cards and NPC shop recipes sequentially without further clicks. The local sync command only imports the downloaded file; it cannot launch a browser or contact the wiki.

## One-time setup

1. Open `chrome://extensions` in your normal Chrome profile.
2. Enable **Developer mode**, click **Load unpacked**, and select this repository's `tools/wiki-browser-extension` folder.
3. Pin **Venor Wiki Export** from the extensions menu.

These are Chrome's [official installation steps](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked). The extension uses [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) and scripting permission after a toolbar click. Storage permissions keep checkpoints and PNGs locally, including exports exceeding the normal extension storage quota. It has no persistent website permissions, external service, account or API key.

## Collect and import

1. Once the wiki works normally, open its [pet category](https://wiki.venor2.hu/items?type=ITEM_COSTUME&subtype=COSTUME_PET) in your usual browser.
2. Click the extension, then **Start / resume**. Leave the tab open, keep the computer awake and avoid navigating or moving the pointer over recipes during collection. Background tabs may run more slowly.
3. It reads all pets, follows the NPC shops link, and opens every recipe tooltip. It downloads `venor-wiki-complete-YYYY-MM-DD.json` when finished. If the browser asks where to save it, choose a location; **Export JSON** can download it again.
4. Import the downloaded file locally:

```powershell
npm run sync-data -- --capture "C:\Users\xeth9\Downloads\venor-wiki-complete-2026-09-10.json" --dry-run
npm run sync-data -- --offline
npm run check
```

Replace the example filename with the actual download. The first command validates and caches it without changing public data. The second publishes the validated cache. Omit `--dry-run` to import and publish together. All import commands are offline. Running `npm run sync-data` without a capture prints instructions.

## Collection and failure behavior

- The extension uses existing links, rendered cards and tooltip DOM. It does not call fetch/XHR, API endpoints, read network responses or hidden framework state, create tabs, or launch another browser. The wiki frontend still makes its normal requests, potentially including API calls.
- Collection proceeds sequentially as soon as the page, tooltip and images are ready. There are no fixed pauses between recipes or shops and no local cooldown lockout, including for older checkpoints.
- Images are copied from displayed image elements using canvas. Scrolling allows ordinary lazy loading; the collector does not force all images to load at once. Missing images or canvas failures stop collection. Exports include icons, so import needs no image downloads.
- Progress is saved in local extension storage after each recipe. Images are stored once instead of being rewritten with every checkpoint. **Stop** retains progress. Reopen the extension and use **Start / resume** after interruption; completed pets and shops are skipped, and the last recipe of a partial shop is checked again. The directory and grid must still match. Reloading ends the injected script; reopen the toolbar to resume.
- Missing pages, images or tooltips time out after 30 seconds. Errors stop collection without automatic retry. You can immediately use **Start / resume** or **New capture**; no timer blocks either action.
- Captures older than 24 hours require **New capture**, which downloads the previous checkpoint before clearing it. Collection observes changes over time rather than taking an atomic server snapshot. Partial JSON exports are diagnostic only and cannot be published.
- Every NPC's offer count and the pet category count must match. Same-name alternative recipes stay separate; the previous tooltip must close before reading the next. Unknown currencies/bonus units, missing references/icons or incomplete captures block publication. More than 10% shrink in NPC, recipe or pet counts blocks publication unless deliberately accepted with `--allow-shrink`.
- `npm run sync-data -- --status` shows the **local import cache**, not extension progress. The browser panel shows current collection progress. `.cache/wiki-sync/capture.json` contains the last successfully validated extension export, reusable with `--offline`.

## How data changes

- The rendered UI combines internal shop tabs. The importer publishes **one local shop per NPC**, reusing an existing shop ID where available. A new NPC gets local ID `1000000 + npc_vnum`, with collision checks. Recipe order follows the captured grid; these IDs/orders are local conventions, not claims about the wiki's internal identifiers.
- NPC settings remain keyed by NPC VNUM; item prices and owned pets remain keyed by item VNUM. The sync does not touch user saves.
- Existing item fields and manual metadata are merged into the base, then observed names and pet bonuses are refreshed. Pet classification is removed from records absent from the full pet list while their item identity is retained. Name/icon records are also created for newly referenced shop items and ingredients. This does not refresh the entire non-pet item catalog; its previous timestamp is retained.
- Overrides for refreshed records are absorbed into the base before the observed fields are replaced. They are removed from the override files so old recipes/bonuses cannot shadow new ones. Overrides outside the captured scope remain. The pre-publication overrides are saved to `.cache/wiki-sync/previous-overrides.json`.
- `.cache/wiki-sync/report.json` records counts, new items, removed pet classifications and absorbed override counts. Git diffs provide the full record-level comparison.
- A publication lock covers offline import through commit. Catalog JSON, metadata, icon maps and PNGs are staged together and promoted using recoverable directory renames. If Windows locks the directory, publication replaces individual files with a backup and recovery journal; failures restore the old files, and the next import recovers interrupted work. Readers may see a missing directory during directory promotion or mixed versions during file promotion. This is not a distributed or hardware-failure-proof transaction; deploy only the completed build.

## Verification and live status

```bash
npm run check
npm run setup-test-browser  # only if the offline test engine is missing
npm run test:wiki-extension
```

The extension test executes the actual collector against local fixtures with an offline browser context and all requests mocked. It checks pet/shop extraction, animated same-name alternatives, canvas export, compact checkpoints, offline import, incomplete-capture rejection and immediate resume after a timeout. Playwright and its test engine are not used by collection or import.

On 2026-09-10 a complete export from the user's normal browser was validated and imported: **70 pets, 37 NPC shops and 870 offers**, including 17 newly referenced item records. The import refreshed the local catalog and icons, absorbed 21 item overrides and three shop overrides, and retained every previously listed pet. Collection and import used no direct scripted wiki/API requests. This extension export and offline import are the only supported sync workflow.
