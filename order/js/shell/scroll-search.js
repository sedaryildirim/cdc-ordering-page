// Order screen layout helpers (visual only):
//  1. the search bar slides away while scrolling down and returns on scroll up, so the list keeps the screen;
//  2. --topbar-h tracks the real top bar height, so sticky category headers sit right under it.
(function () {
  var search = document.querySelector("#orderScreen .search-wrap");
  var topbar = document.querySelector("#orderScreen .topbar");
  if (!search || !topbar) return;

  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      var h = topbar.offsetHeight;
      if (h) document.documentElement.style.setProperty("--topbar-h", h + "px");
    }).observe(topbar);
  }

  var lastY = window.scrollY;
  window.addEventListener("scroll", function () {
    var y = window.scrollY;
    var delta = y - lastY;
    lastY = y;
    if (!document.getElementById("orderScreen").classList.contains("active")) return;
    if (search.contains(document.activeElement)) { search.classList.remove("is-away"); return; }
    if (y < 120 || delta < -6) search.classList.remove("is-away");
    else if (delta > 6) search.classList.add("is-away");
  }, { passive: true });

  search.addEventListener("focusin", function () { search.classList.remove("is-away"); });
})();
