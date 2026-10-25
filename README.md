# Noah's personal workbook

A full-window spreadsheet interface built with plain HTML, CSS, and JavaScript. Supabase provides administrator authentication, private drafts, and published snapshots. The interface remains a static site. Eighteen open font families and their licenses are bundled locally; the full font menu has 28 choices, including system fonts. The existing static hosting setup and custom domain are preserved.

## Open locally

From this folder, run:

```sh
npm ci
npm start
```

Open http://localhost:8000. The start command bundles the pinned Supabase client and starts a local server. Refresh the browser after changing source files; the server does not automatically reload the page. Do not open `index.html` directly, because browser JavaScript modules need HTTP.

## Checks and optional static build

Node.js 22 or later is recommended for development checks. Install the pinned dependencies with `npm ci` first.

```sh
npm run check
npm test
npm run build
```

The optional build copies the runtime files and font assets into `dist/`. You can continue serving the project root during development or deploy the contents of `dist/` to a static host. `CNAME` is retained for the existing domain. Nothing is published by running these commands.

## What works

- A virtualized grid with 1,000 rows and 52 columns per sheet, fixed row and column headings, blue cell selection, and drag or Shift+arrow range selection.
- Click to select, double-click or F2 to edit, type to replace, Enter to save and move down, Tab to move right, arrows to navigate, and Escape to cancel.
- Backspace/Delete to clear values; a cell reference box for jumping to cells and ranges; editing in the formula bar.
- Custom searchable font and size menus, bold, italic, underline, horizontal and vertical alignment, merging/unmerging, and all/outer/bottom borders. Formatting affects the entire selection.
- Shared text, fill, and tab color palettes with 80 preset colors, a grayscale row, selected-color markers, and validated custom hex colors. Cell colors survive edits and plain-text paste.
- Drag the boundaries of row and column headings to resize. A blue guide and pixel label show the size; release commits one undoable action. Double-click a boundary to reset its size. Keyboard arrows resize a focused boundary by 10 pixels (Shift changes it by 1). Sizes are independent for each sheet and persist after refresh.
- A searchable emoji picker in the toolbar (Command/Ctrl+Shift+E). With a text field focused, emojis are inserted at the cursor without replacing selected text. With a cell selected, emojis append to its value. Rename dialogs include their own emoji button.
- Undo/redo for cell edits, formatting, row/column insertion and resizing, tab colors, sheet creation and renaming, and title changes. Undo history lasts for the current page session.
- Copy/cut/paste with standard shortcuts; tabular text pasted from other apps; formatting preserved when copying within this workbook. Clipboard menu actions use browser permissions and provide keyboard alternatives when blocked.
- Drag the small blue fill handle to repeat the selected cell across a range.
- Independent Home, Experience, Projects, About, and Contact sheets. Add a sheet with +; double-click a tab or use its arrow menu to rename it. Names must be unique. Use the tab arrow or right-click menu to change its color.
- Functional menus for CSV and JSON downloads, gridline visibility, zoom, adding rows/columns, sorting a selected range by its first column, selection statistics, and shortcut help.
- Administrator workbook values, formatting, merges, dimensions, tabs, and recordings saved in private cloud drafts; local development drafts have browser recovery storage.

Visitors view the latest published snapshot from Supabase. Editing requires administrator sign-in. Browser recovery storage belongs to each browser and origin; cloud drafts work across devices. Saving can fail if browser recovery storage is disabled or full; the administrator can save a cloud draft or download a backup. Sheet limits are 5,000 rows, 100 columns, and 50 sheets. Column widths range from 40–1,000 pixels; row heights range from 20–500 pixels (before zoom).

## Phase 2

The sheets intentionally start blank. Portfolio content, formula evaluation, charts, filters, XLSX import/export, and JSON restore are future work. Expressions beginning with `=` are stored as literal text for now. Live collaborative editing remains outside this phase. Administrator authentication and publishing are included.

## Source layout

- `index.html`: application shell and accessible controls.
- `style.css`: spreadsheet chrome, grid, selection, and responsive layout.
- `app.js`: reusable rendering functions, viewport virtualization, UI interactions, clipboard, and persistence.
- `spreadsheet-model.js`: workbook state, formatting, range operations, history, and data serialization, independent of the DOM.
- `sheet-layout.js`: variable cell geometry and binary-search viewport lookup.
- `ui-popovers.js`: shared keyboard-accessible menus, font lists, palettes, and emoji picker.
- `picker-data.js`: palette presets, emoji search terms, and safe text/color helpers.
- `assets/fonts/`: locally hosted font files, stylesheet, and font licenses.
- `tests/`: behavior tests for data, formatting, resizing, layout, colors, emoji insertion, history, clipboard, and persistence.
- `animation/`: recording, scheduling, isolated playback, cloud persistence, and the timeline studio.
- `supabase/schemas/workbook.sql`: desired database schema and authorization policies.
- `scripts/build.mjs`: static packaging, including the bundled Supabase client.

The prior animation scripts and assets are no longer loaded by the page. Existing archived experiments remain in `archive/`.

## Quick browser check

Sign in as administrator, or open the local studio preview, before checking editing features. Visitors view the published spreadsheet.

1. Type a value in A1, press Enter, and confirm A2 is selected.
2. Double-click A1, change it, and press Escape; its original value should remain.
3. Enter `A1:C3` in the name box, then apply bold, a fill color, alignment, and a border.
4. Copy the range with Command/Ctrl+C and paste it at E5 with Command/Ctrl+V. Undo and redo.
5. Switch to Experience and edit a cell; switch back to Home to confirm its values remain separate.
6. Rename a tab, add a sheet, and refresh to confirm local persistence.
7. Jump to AZ990, navigate with arrows, and scroll both ways; headings should remain visible.
8. Narrow the browser window; scroll the grid, toolbar, and tabs horizontally as needed.

## Additional browser checks

- Drag row and column boundaries, undo/redo, switch sheets, and refresh. Confirm both dimensions and selection outlines stay aligned.
- Apply preset and custom fill colors to a range, edit its cells, paste text, switch tabs, and refresh. Text color, bold, and other formatting must remain.
- Search the font menu, use arrow keys and Enter to select a font/size, and close with Escape or an outside click.
- Search for an emoji with a cell, cell editor, formula field, title, or rename field focused. Confirm the existing text remains and the emoji is inserted at the intended position.
- Use a tab's right-click menu to set a preset/custom color, verify it after switching and refreshing, then reset it with “No color.”

Font assets can be regenerated with `python3 scripts/vendor-fonts.py` (requires network access). The normal build uses the existing local assets and does not fetch fonts.

## Administrator and animation studio

The configured Supabase project is `personal-website` (`jpcsctwbqzytmhhomitb`). `site-config.json` contains only its public publishable key; passwords and secret/service keys must never go in the website. The deployed schema enables row level security on every workbook table. Only UIDs in `workbook_admins` can read drafts or write published content. Creating an ordinary authentication account does not grant administrator access.

### First administrator setup

1. In the project's Supabase dashboard, open Authentication → Users → Add user → Create new user.
2. Create the owner account for `noahshmjds@gmail.com`. Choose the password privately in Supabase, and use Auto Confirm User for this dashboard-created owner account.
3. The project owner must explicitly grant that account administrator membership, using the newly created authentication UID. There is no public signup or client-side promotion route. An authorized project owner can run:

   ```sql
   insert into public.workbook_admins(user_id)
   select id from auth.users where email = 'noahshmjds@gmail.com'
   on conflict (user_id) do nothing;
   ```

4. Refresh the website and select File → Admin sign in. Sign in with that email and password. Never send the password in chat.

### Record and arrange

- The studio opens below the spreadsheet. Expand it for more timeline space.
- Name a recording, press Start recording, and use the real spreadsheet. Cursor movement, selections, incremental typing, deletes, formatting, cell sizes, and scrolling are saved as timestamped events.
- Press Stop to restore the authored sheet, then Preview recording or Save recording. Save recording adds an independent reusable asset to the library; Save draft syncs the library to Supabase.
- Add recordings to a sequence. Each block has its own track. Drag a block to change its start time (0.1-second steps; hold Shift for 0.01-second steps), or enter exact timings in Clip settings.
- Start delay shifts the entire sequence. Gap is used by Arrange sequentially. Each clip supports duration trimming, speed, repeat count (0 means forever), repeat delay, and an optional start-to-start interval. An interval shorter than the duration allows a recording to overlap its own repetitions.
- Multiple blocks can overlap. Selection-outline colors identify different tracks; simulated pointers use a standard black-and-white appearance without labels. Conflicts show the affected cell: later event timestamps win, then lower tracks, later repetitions, and event order at equal times. Formatting changes merge by property, so typing on one track does not erase another track's fill.
- Click a recording name to edit its name, duration, timestamps, cell references, text, and fill. Recording through the toolbar captures other formatting. Assets, clips, and sequences can be duplicated and removed independently.
- Each sheet has separate sequences. Check Play this sequence for visitors to select the sequence that will be published for that sheet.

### Save, preview, publish

Save draft stores the workbook, assets, sequences, assignments, and timing settings privately. Preview uses a temporary copy. Publish atomically copies the current draft workbook and only the selected sequences and referenced assets into the public snapshot. Draft changes do not affect visitors. Revision checks prevent one device from silently overwriting a draft saved on another device. If a revision conflict occurs, preserve a local backup and sign out/in to reload the newer cloud draft.

Visitors load the latest published snapshot on each page load. All assigned sheet timelines start once on one shared page clock. Clicking, selecting, scrolling, and changing sheets keep playback running. Each sheet retains its progress and completed text, colors, formatting, and merges for the lifetime of that visit. Pause and Skip are deliberate controls; Replay explicitly restarts only the visible sheet. Visitor editing controls are disabled, and no visitor spreadsheet changes are stored between visits. Reduced-motion users start paused and simulated cursors are hidden.

Administrator login lasts for the current browser tab session. Draft recovery is kept in session storage, and cloud drafts persist across devices. On localhost only, the sign-in dialog also offers a clearly labeled local studio preview. It cannot publish or access private cloud drafts.

### Validation and limits

`npm test` covers scheduler timing, overlapping edits, repeats beyond the initial playback window, pause/resume, seeking, cursor anchors, recorder patches, persistence, existing spreadsheet behavior, and real Postgres policy tests with PGlite. The public REST API must reject draft reads and unauthorized writes. Supabase Security Advisor should report no database errors or warnings.

A project supports up to 200 recordings and sequences, 100 clips per sequence, and 20,000 events per recording. Recordings are limited to 10 minutes. Draft payloads are limited to 10 MB. Safety limits reject extremely dense timelines rather than freezing the page. Long-running repeats are scheduled in expanding windows. Cloud publishing updates spreadsheet content; deploying changes to website code still uses the existing hosting process.


## Merged cells, vertical alignment, and motion accuracy

Use the Merge cells toolbar menu to merge a horizontal, vertical, or rectangular selection, or to unmerge it. When other cells contain text, a dialog explains that the upper-left cell will be displayed and the other values will be retained. Unmerging reveals those values. Copying merged ranges within the workbook preserves their merged layout. Unmerge a destination before pasting multiple cells over it, and unmerge a range before sorting it. Inserting rows/columns and resizing dimensions retain merged geometry.

The Vertical alignment toolbar menu offers Top, Middle, and Bottom. It works across selections, resized rows, and merged cells, and persists with the workbook and recordings. Filled cells use subtle gridlines derived from neighboring fills; explicit borders take priority.

New recordings capture coalesced mouse samples with their input timestamps, sub-cell positions, and scroll anchors at up to 125 samples per second. Playback interpolates the captured path on animation frames. Selection events no longer move the pointer to cell centers. Idle periods hold the last recorded position; the pointer disappears while the real mouse is outside the sheet. Older recordings remain compatible.

For an isolated browser smoke test, run `node tests/browser-fixture.mjs` and open `http://127.0.0.1:8001/`. This uses the real spreadsheet and playback code with a local sample publication; it makes no Supabase changes.


### Live visit stats on the animation timeline

In Animation studio, choose **+ Live stat**. Select a live value, a target cell, and its appearance time, then choose **Add to timeline**. Drag the block or edit its Start setting to change the reveal time. Click its library name or **Edit live stat** to change the cell, label, display, or equation. Save Draft and Publish include these elements with the rest of the selected sequence.

Available values are time on website, sheet switches, cell clicks, different cells clicked, and a live equation. The visit clock starts at browser page load, including time before a stat is revealed. Counts include earlier activity in that visit. Revealed values keep updating after a clip/timeline ends and while playback is paused. Replay hides them until the scheduled reveal again while the visit clock continues. Reload resets the visit and counters. Recorded cell edits and formatting do not stop an active live value from updating.

Equations accept SECONDS, MINUTES, TAB_SWITCHES, CELL_CLICKS, UNIQUE_CELLS, and EDITS, with arithmetic and ROUND, FLOOR, CEIL, ABS, MIN, MAX. For example, ROUND(SECONDS / 60, 1) displays minutes, and TAB_SWITCHES + CELL_CLICKS combines two counts. EDITS counts committed cell-value changes while editing is enabled. Results are evaluated with a bounded arithmetic parser.

Live counters exist in each page's temporary playback state. Drafts/publications persist the placements, equations, labels and timing. Each visitor gets their own values.
