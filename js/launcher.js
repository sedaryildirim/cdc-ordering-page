// The menu of tools: turns each greyed-out card into a link once its address is set in config/config.js, and runs
// the theme switch in the hero.
(function () {
  // A localhost address only works on the machine that runs it, so it stays greyed out when viewed anywhere else.
  var viewedOnThisComputer = ["", "localhost", "127.0.0.1", "[::1]"].indexOf(location.hostname) !== -1;

  function linkCard(cardId, url, kicker, title, desc, badge, primary) {
    var card = document.getElementById(cardId);
    var pointsAtThisComputer = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(url || "");
    if (!url || !card || (pointsAtThisComputer && !viewedOnThisComputer)) return;
    var link = document.createElement("a");
    link.className = "launch-card " + (primary ? "is-primary" : "is-secondary");
    link.id = cardId;
    link.href = url;
    link.innerHTML =
      '<span class="launch-kicker">' + kicker + '</span>' +
      '<span class="launch-title">' + title + '</span>' +
      '<span class="launch-desc">' + desc + '</span>' +
      (badge ? '<span class="launch-badge" data-live>' + badge + '</span>' : "");
    card.replaceWith(link);
  }
  var tools = CONFIG.tools || {};
  // One ordering site serves both businesses; ?site= makes it show only that business's stores.
  var orderingUrl = tools.ordering && tools.ordering.url;
  var forSite = function (site) { return orderingUrl ? orderingUrl + (orderingUrl.indexOf("?") === -1 ? "?" : "&") + "site=" + site : ""; };
  linkCard("openKaifOrdering", forSite("kaif"), "Suppliers", "Kaif Ordering", "Order from your suppliers", "Beta: Being Tested", true);
  linkCard("openMojosOrdering", forSite("mojos"), "Suppliers", "Mojo&#39;s Ordering", "Order from your suppliers", "Beta: Being Tested", true);

  // Theme switch (the choice is remembered on this device and applied before the page paints, see index.html)
  var THEME_KEY = "mojos_theme";
  var btn = document.getElementById("launcherThemeToggle");
  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* private browsing: the choice just is not remembered */ }
    var next = theme === "light" ? "dark" : "light";
    btn.textContent = theme === "light" ? "\u263D" : "\u2600";
    btn.title = "Switch to " + next + " mode";
    btn.setAttribute("aria-label", "Switch to " + next + " mode");
  }
  apply(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  btn.addEventListener("click", function () {
    apply(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
  });

  // Beta notice: frosted glass over the menu. Once you tap "I understand" it stays away for 30 days on this device (and
  // never reappears when you come back to the menu from a tool). The menu behind it is inert while it is up; the
  // button, Enter or Escape closes it.
  var NOTICE_KEY = "mojos_beta_notice_until";
  var NOTICE_DAYS = 30;
  var notice = document.getElementById("betaNotice");
  var seen = false;
  try { seen = Number(localStorage.getItem(NOTICE_KEY)) > Date.now(); } catch (e) { /* private browsing: it just shows each time */ }
  if (notice && !seen) {
    var main = document.querySelector("main");
    var ok = document.getElementById("betaOk");
    var previous = document.activeElement;
    notice.hidden = false;
    if (main) main.setAttribute("inert", "");
    ok.focus();
    var close = function () {
      notice.hidden = true;
      if (main) main.removeAttribute("inert");
      try { localStorage.setItem(NOTICE_KEY, String(Date.now() + NOTICE_DAYS * 86400000)); } catch (e) { /* ignore */ }
      document.removeEventListener("keydown", onKey);
      if (previous && previous.focus) previous.focus();
    };
    var onKey = function (ev) {
      if (ev.key === "Escape") close();
      if (ev.key === "Tab") { ev.preventDefault(); ok.focus(); } // one control: keep focus on it
    };
    ok.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
  }
})();
