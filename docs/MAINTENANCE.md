# Maintenance guide

## Boundaries

- `src/domain/catalog.mjs`: shared runtime validation used by the application and Node maintenance scripts; `catalog.d.mts` provides its TypeScript contract. The wiki's synthetic Gaya shop uses ID `-1`.
- `src/domain/userData.ts`: strict backup migration, game-price parsing, size limits, freshness policy.
- `src/utils/cost.ts`: pure acquisition estimates, immutable cycle-free provenance, and batch planning. Keep all money as `bigint` in memory and decimal strings in user saves.
- `src/stores/data.ts`: fetch a complete candidate snapshot, validate it, then publish together. Failed refreshes retain the previous snapshot. Icon failures are nonfatal and have a visible warning.
- `src/stores/user.ts`: persistence, exports, explicit restore/reset, collection ownership and targets. Read v3 first; read v2 only when v3 does not exist. Never silently fall back to an older save when the current one is corrupt.
- `src/stores/market.ts`: one shared computed acquisition index, offer summaries, downstream usages, and missing-price priorities. Views must not implement their own profit/cost arithmetic.
- `src/composables/useQueryState.ts`: URL-backed filters. Update multiple query fields in one router call, preserving unrelated fields.
- `src/components/`: common currency, price status, input, import preview, recipe rows/tree, offer cards, quantity planner, modal detail panel and navigation.
- `src/styles/colors.css`: dark/light semantic color tokens. `common.css`: typography, focus, responsive layout and shared primitives. Page-specific CSS stays beside its view.
- `scripts/lib/dataset-transaction.mjs`: staging, backup, promotion, rollback and interrupted-publication recovery. Do not return to unlink-before-rename writes.

## Calculation contract

Unit calculations are conservative rounded estimates. Complete Yang costs require all ingredient prices, a positive output count, and no positive unpriced currency amounts. Zero amounts do not require a conversion rate.

The resolver performs deterministic relaxation using previous-pass snapshots. Each route retains its exact ingredient provenance; later updates must not mutate that tree. Routes containing their own output as an ancestor are not used to simulate arbitrage. If an alternative recipe cannot be represented with the selected cycle-free ingredient routes, display that limitation instead of ranking a partial value.

The planner executes a chosen provenance tree, rounds every NPC operation to whole batches, carries leftovers across sibling ingredient requirements, and lists purchases and NPC operations in execution order. It compares root alternatives, not all possible combinations of intermediate recipes. Profit only values the requested output count, not leftovers. Do not label this as guaranteed profit or a global bulk optimum.

## Data updates

1. Work on a branch with existing user/data changes understood.
2. Run a dry-run sync and review count changes.
3. Run the real sync. Review JSON diffs, especially removed offers and override interactions.
4. Run `npm run validate-data`. Missing references or icons block release; obtain missing icons manually and rebuild the map as necessary.
5. Run `npm run check` before opening a PR.

The sync lock prevents concurrent publishers. Directory promotion is recoverable but is not a distributed transaction or an fsync-based guarantee against hardware failure. Do not publish `data.next` or `data.backup`; a normal successful run removes them. Public hosting deployments should use the completed GitHub Pages artifact.

## Manual UI checklist

- Start with an empty browser profile. The dashboard explains how to add prices without inventing opportunities.
- Open a profile containing an existing v2 save. Prices and owned pets survive; editing creates v3 without removing v2.
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

No browser automation dependency is required.
