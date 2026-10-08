# Ordering pages (Mojo's + Kaif)

A static copy of the ordering sheets and their menu page, made from the main project on 2026-10-08. It has no build step
and no server: `index.html` is the menu (Kaif Ordering, Mojo's Ordering) and `order/` holds the ordering sheets.
Every push to `main` publishes it to GitHub Pages.

The item lists, prices and branches are in `order/config/data.js` and `order/config/config.js`.
