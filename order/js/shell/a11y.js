// Moves keyboard and screen-reader focus to the new screen's heading when
// the ordering scripts in js/ordering/ switch screens (visual and behavioural logic stay there).
(function () {
  var screens = document.querySelectorAll(".screen");
  var ready = false;
  setTimeout(function () { ready = true; }, 0); // ignore the initial render

  screens.forEach(function (screen) {
    new MutationObserver(function () {
      if (!ready || !screen.classList.contains("active") || document.body.dataset.keepFocus) return;
      var target = screen.querySelector("h1, h2, .topbar-title");
      if (!target) return;
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }).observe(screen, { attributes: true, attributeFilter: ["class"] });
  });
})();
