# Script Load Order

Replace the single `<script src="app.js">` in your index.html with these, in this exact order:

```html
<script src="data.js"></script>
<script src="ui.js"></script>
<script src="bc-draws.js"></script>
<script src="bc-detail.js"></script>
<script src="bc-filters.js"></script>
<script src="bc-saved-compare.js"></script>
<script src="ab-draws.js"></script>
<script src="ab-cards.js"></script>
<script src="ab-filters.js"></script>
<script src="maps.js"></script>
```

## File Summary

| File | Lines | Contents |
|---|---|---|
| `data.js` | 253 | Global state, URLs, all `load*` functions, `startApp` |
| `ui.js` | 135 | `showPage`, nav, home page, compare page, province switch |
| `bc-draws.js` | 622 | BC state, filters, chips, sort, card rendering, charts |
| `bc-detail.js` | 269 | Draw detail page, sidebar, writeup toggle |
| `bc-filters.js` | 256 | BC filter page (`fp*` functions) |
| `bc-saved-compare.js` | 200 | Saved draws, star toggle, compare mode/panel |
| `ab-draws.js` | 470 | AB priority logic, profile defaults, AB state |
| `ab-cards.js` | 580 | AB card rendering, expand content, AB filters/sidebar/sort |
| `ab-filters.js` | 355 | AB filter page (`abFp*`), AB profile page |
| `maps.js` | 874 | AB WMU map, BC WMU map, full map tab |

## When editing, upload only what's needed:

- Changing draw card layout? → `bc-draws.js` or `ab-cards.js`
- Filter page tweaks? → `bc-filters.js` or `ab-filters.js`
- Map behavior? → `maps.js`
- Sort/odds logic? → `bc-draws.js` or `ab-cards.js`
- Data URLs or loading? → `data.js`
- Navigation/home page? → `ui.js`
