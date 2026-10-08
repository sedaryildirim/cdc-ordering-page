// Pointer-reactive hero field (visual only; the launcher script is not involved).
// Moves two CSS variables so the dot grid lights up under a finger or cursor.
(function () {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.querySelectorAll(".hero").forEach(function (hero) {
    var field = hero.querySelector(".hero-field");
    if (!field) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, live = false;

    function frame() {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      field.style.setProperty("--fx", cx + "px");
      field.style.setProperty("--fy", cy + "px");
      raf = (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) ? requestAnimationFrame(frame) : 0;
    }

    function move(e) {
      var r = hero.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      if (!live) {
        live = true;
        cx = tx;
        cy = ty;
        hero.classList.add("is-live");
      }
      if (!raf) raf = requestAnimationFrame(frame);
    }

    function leave() {
      live = false;
      hero.classList.remove("is-live");
      field.style.removeProperty("--fx");
      field.style.removeProperty("--fy");
    }

    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerdown", move);
    hero.addEventListener("pointerleave", leave);
    hero.addEventListener("pointercancel", leave);
  });
})();
