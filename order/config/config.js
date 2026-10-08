// ---- Edit this file to update branches / email addresses ----
// No coding needed elsewhere: item list/prices/pars live in config/data.js.

const CONFIG = {
  // Branches are grouped by exact `region` text. Kaif's region has a trailing space so it
  // shows as its own second "Koh Phangan" group (same heading, separate row).
  // `site` says which menu card the store belongs to: "kaif" (Kaif Ordering) or "mojos" (Mojo's Ordering). The page is
  // opened with ?site=kaif or ?site=mojos and then shows only those stores (no ?site= shows them all).
  branches: [
    { id: "lamai", site: "mojos", name: "Mojo's Lamai", email: "mojos.lamai@gmail.com", region: "Koh Samui", suppliers: ["makro-samui", "foodproject", "drinks", "winepro"], minimumOrders: { winepro: 6 } },
    { id: "nathon", site: "mojos", name: "Mojo's Nathon", email: "mojos.nathon@gmail.com", region: "Koh Samui", suppliers: ["makro-samui", "foodproject", "drinks", "winepro"], minimumOrders: { winepro: 6 } },
    { id: "chaloklum", site: "mojos", name: "Mojo's Chaloklum", email: "mojos.chaloklum@gmail.com", region: "Koh Phangan", suppliers: ["makro-phangan", "winepro", "phangangreenveg"], minimumOrders: { winepro: 12 } },
    { id: "thongsala", site: "mojos", name: "Mojo's Thongsala", email: "mojos.thongsala@gmail.com", region: "Koh Phangan", suppliers: ["makro-phangan", "phangangreenveg"] },
    { id: "kaifchaloklum", site: "kaif", name: "Kaif Chaloklum", email: "amazingphangan.kaif@gmail.com", region: "Koh Phangan ", suppliers: ["makro-kaif", "winepro", "phangangreenveg", "labottega", "fruitshop"], minimumOrders: { winepro: 12 } }
  ],
  // minimumOrders (per branch, optional): { supplierId: smallest total quantity that supplier accepts }.
  // The unit name shown ("bottles") is the supplier's moqLabel in config/data.js.
  // Each id must match a key in the DATA object in config/data.js.
  // Full list shown to a branch unless that branch has its own `suppliers` array (list of ids) above.
  // Three separate Makro lists, same chain, different item selection & pricing per branch:
  // makro-samui (Nathon/Lamai), makro-phangan (Chaloklum/Thongsala), makro-kaif (Kaif Chaloklum).
  // phangangreenveg = Koh Phangan-only produce supplier (Chaloklum/Thongsala/Kaif), not offered on Samui.
  // labottega, fruitshop = Kaif Chaloklum-only suppliers (item lists pending).
  suppliers: [
    { id: "makro-samui", name: "Order Makro" },
    { id: "makro-phangan", name: "Order Makro" },
    { id: "makro-kaif", name: "Order Makro" },
    { id: "foodproject", name: "Order Food Project" },
    { id: "drinks", name: "Order Drinks" },
    { id: "winepro", name: "Order Wine Pro" },
    { id: "phangangreenveg", name: "Order Phangan Green Vegetables" },
    { id: "labottega", name: "Order La Bottega" },
    { id: "fruitshop", name: "Order Fruit Shop" }
  ],
  // Where the "All tools" link goes: the menu of tools (the launcher, its own site). This is its Vercel address; the
  // local dev server and the GitHub Pages workflow swap in their own ("/" and "../"). Leave "" to hide the link.
  homeUrl: "../",
  // CC'd on every order email (leave "" to disable)
  ccEmail: ""
};
