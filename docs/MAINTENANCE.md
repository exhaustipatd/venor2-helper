# Maintenance guide

## Boundaries

- `src/domain/catalog.mjs`: shared runtime validation used by the application and Node maintenance scripts; `catalog.d.mts` provides its TypeScript contract.
- `src/domain/userData.ts`: strict backup migration, game-price parsing, size limits, freshness policy.
- `src/utils/cost.ts`: pure acquisition estimates, immutable cycle-free provenance, and batch planning. Keep all money as `bigint` in memory and decimal strings in user saves.
- `src/stores/data.ts`: fetch a complete candidate snapshot, validate it, then publish together. Failed refreshes retain the previous snapshot. Icon failures are nonfatal and have a visible warning.
- `src/stores/user.ts`: persistence, exports, explicit restore/reset, collection ownership, targets and per-NPC availability. Read v4 first, then v3, then v2 only when newer keys do not exist. Never silently fall back to an older save when the current one is corrupt. Unspecified NPCs are active except wind NPC 60033.
- `src/stores/market.ts`: one shared computed acquisition index, offer summaries, downstream usages, and missing-price priorities, all derived from active shops only. Inactive NPC recipes remain browsable but must never enter provenance trees or planner routes. Views must not implement their own profit/cost arithmetic.
- `src/composables/useQueryState.ts`: URL-backed filters. Update multiple query fields in one router call, preserving unrelated fields.
- `src/components/`: common currency, price status, input, import preview, recipe rows/tree, offer cards, quantity planner, modal detail panel and navigation.
- `src/styles/colors.css`: dark/light semantic color tokens. `common.css`: typography, focus, responsive layout and shared primitives. Page-specific CSS stays beside its view.
- `scripts/lib/dataset-transaction.mjs`: staging, backup, promotion, rollback and interrupted-publication recovery. Do not return to unlink-before-rename writes.

## Calculation contract

Unit calculations are conservative rounded estimates. Complete Yang costs require all ingredient prices, a positive output count, and no positive unpriced currency amounts. Zero amounts do not require a conversion rate.

The resolver performs deterministic relaxation using previous-pass snapshots. Each route retains its exact ingredient provenance; later updates must not mutate that tree. Routes containing their own output as an ancestor are not used to simulate arbitrage. If an alternative recipe cannot be represented with the selected cycle-free ingredient routes, display that limitation instead of ranking a partial value.

The planner executes a chosen provenance tree, rounds every NPC operation to whole batches, carries leftovers across sibling ingredient requirements, and lists purchases and NPC operations in execution order. It compares root alternatives, not all possible combinations of intermediate recipes. Profit only values the requested output count, not leftovers. Do not label this as guaranteed profit or a global bulk optimum.

## Data updates

The browser extension export and offline importer are the only sync workflow. The complete 2026-09-10 import contains 37 NPC shops, 870 recipes and 70 pets. Icon maps and images are updated by the importer together with the catalog.

The preserved summer NPC 60319 uses local shop ID 1000618: its former manually assigned ID 618 now belongs to the wiki lightning shop. Do not reuse this local ID for wiki shops. Override NPC identity must match the base shop; a collision blocks validation instead of mixing unrelated offers.

1. Work on a branch with existing user/data changes understood.
2. Export using `tools/wiki-browser-extension` in your normal browser, then run `npm run sync-data -- --capture <file.json>` to import offline. No direct API calls are made. See [WIKI-CAPTURE.md](WIKI-CAPTURE.md) for checkpoints, offline validation and resuming interrupted captures.
3. Review the resulting JSON diffs and `.cache/wiki-sync/report.json`. The importer uses one local shop per NPC because the rendered UI aggregates tabs. It absorbs overrides for refreshed records so stale overrides cannot mask the new data; overrides outside the captured scope remain.
4. Run `npm run validate-data`. Missing references or icons block publication. Icons come from displayed images exported through canvas.
5. Run `npm run check` before opening a PR.

The sync lock prevents concurrent publishers. Data, icon maps and images are staged through `public.next` and `public.backup`. If Windows prevents directory renaming, a file replacement fallback uses `public.publication.json` to recover interrupted writes from the backup. File promotion can briefly expose mixed versions to local readers. This is not an fsync-based guarantee against hardware failure; do not publish or discard recovery files manually. Public hosting deployments should use the completed GitHub Pages artifact.

## Manual UI checklist

- Start with an empty browser profile. The dashboard explains how to add prices without inventing opportunities.
- Open profiles containing existing v2 and v3 saves. Prices, owned pets and available targets survive; editing creates v4 without removing the older keys. NPC settings survive reload and backup restore. A corrupt v4 must not fall back to v3.
- Disable an NPC used as an intermediate recipe ingredient: costs, profit and quantity plans update, and its offers remain browsable with an inactive label. Re-enable it and verify all its tabs return to calculations. Check the default-inactive wind NPC.
- Edit a price using `500kk`, `1,5mrd`, zero, a blank value, a negative value and malformed text. Invalid input must preserve the prior saved price. Escape cancels an edit.
- Import game prices: inspect new/replaced/skipped counts, cancel without changes, then confirm. Existing unrelated prices and collection entries remain.
- Restore a backup: the replace warning and unchecked confirmation must appear before mutation. Export the current state first. Repeat with malformed JSON.
- Mark a pet owned, pin a target, filter the gallery and reload. Ownership and targets persist independently.
- Open and close detail panels with keyboard only. Escape closes; Tab stays inside; focus returns to the opener. On mobile, repeat for navigation.
- Compare a chain with a multi-item output. Unit estimates and whole-batch spending must remain distinctly labelled. Inspect leftover quantities and missing currency messages.
- Search NPCs by item name. Switch NPCs and tabs. On mobile, use the back-to-list control.
- Check missing/stale price filters, inline saving, usage expansions, and pagination.
- Switch both themes and check desktop/tablet/320px layouts, long Hungarian names and large Yang values. Honor reduced-motion preference.
- Block a dataset request: initial load has Retry; a failed refresh keeps old data. Block only icons: calculations remain available with a warning.
- Deny localStorage writes: the save error must remain visible, with export available.

Only offline extension tests require Playwright and Chromium; `npm run setup-test-browser` installs the test engine. `npm run test:wiki-extension` tests the actual collector and offline import with all requests mocked. It never contacts the wiki.
