# Ordering pages (Mojo's + Kaif) — read this first

## What this is
Static copy (no build, no server) of the Mojo's and Kaif supplier ordering sheets, published to GitHub Pages on every push to `main`.
`index.html` = menu page; `order/` = the ordering sheets. Open with `?site=kaif` or `?site=mojos` to show one group's stores.
Branches/suppliers: `order/config/config.js`. Items and prices: `order/config/data.js` (generated file, see below).

## How we use it
The user sends supplier invoice screenshots (Makro, Food Project, ...). We compare each invoice line to `data.js`, list the
differences, WAIT for approval, then apply, commit and push. Always list changes first.

## Rules / gotchas
- `data.js` header says it is generated from `../data/` by `scripts/build-order-data.mjs` in the MAIN project. Neither exists here,
  so we edit `data.js` directly. **The main project's `data/` files must get the same edits or the next refresh overwrites them.**
- Item match is by supplier item code (id), e.g. Makro `makro-samui` ids are Makro codes. Kilogram items are priced per kg.
- After editing, check the file still loads: `node -e 'eval(require("fs").readFileSync("order/config/data.js","utf8")+";globalThis.D=DATA")'`.
- Commit and push only when asked.

## Where we left off (update this each session)
- 2026-10-14: Makro Samui updated from 12-13 Oct invoices (Nathon/Ang Thong + Lamai): 19 prices changed, Lime Jumbo 10 pcs (847804, 95) added. Pushed.
- Food Project invoices (09/10, 12/10): brisket 280, chuck roll 370 already matched, no change.
- **TODO:** copy the Makro changes into the main project's `data/` source (not done, not in this repo).
- Suppliers not yet checked against recent invoices: drinks, winepro, phangangreenveg, makro-phangan.
