# Module 1 (Sign in): clickable mock-up

A clickable HTML mock-up of the new admin app's sign-in, for review before any real app code is written. It is separate from the app code and uses sample data only.

## Open it
Serve this folder and open `index.html`:

```
cd Nadam-Handloom-production/docs/design/ui-mockup/module-1-sign-in
python3 -m http.server 8791
# then open http://localhost:8791/
```

## Pages
| Page | What it is |
|---|---|
| `index.html` | Start page: every screen grouped by journey, sample accounts, decisions, open questions |
| `app.html` | The app itself, in a phone frame, with the screen list on the left and review notes on the right |
| `kit.html` | Design kit: colours, type, buttons, fields, PIN and code inputs, badges, alerts, cards, tables, progress, loading, dialogs, icons |
| `preview.html` | Any screen in a phone frame, a tablet frame (portrait or landscape), or both side by side |

The floating **Design options** panel on every page switches theme, palette, font, corners, sign-in layout, PIN entry and menu style, and has screen states, sample accounts and demo events. **Copy my choices** copies the picks as text.

## Files
- `assets/mock.css`: colour tokens (3 palettes, light and dark), base components, page shell, options panel
- `assets/app.css`: app screens, device frames, screen viewer layout
- `assets/options.js`: icons, saved choices, the Design options panel
- `assets/screens.js`: the list of screens with their rules, edge cases and fixes
- `assets/app.js`: the app screens and a pretend backend that applies the Module 1 rules
- `assets/logo.png`: the Nandam Handlooms logo

The plan these screens follow is in [`docs/modules/module-01-sign-in.md`](../../../modules/module-01-sign-in.md).
