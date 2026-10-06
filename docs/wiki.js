/* HomeLink Wiki — interactions : recherche, navigation croisée, bulles, galerie, apparition. */
(function () {
  "use strict";
  var d = document, root = d.documentElement;
  root.classList.add("js");
  var norm = function (s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); };
  var here = location.pathname.split("/").pop() || "index.html";

  // ---- i18n (selon <html lang>) ----
  var EN = (root.lang || "fr").slice(0, 2) === "en";
  var T = EN ? {
    search: "Search… ( / )", searchAria: "Search the wiki",
    item: "item", page: "page", section: "section", itemSub: "Item", pageSub: "Page",
    noResults: function (q) { return 'No results for “' + q + '”'; },
    usedIn: "Used in: ", viewRecipe: " — view recipe"
  } : {
    search: "Rechercher… ( / )", searchAria: "Rechercher dans le wiki",
    item: "objet", page: "page", section: "section", itemSub: "Objet", pageSub: "Page",
    noResults: function (q) { return 'Aucun résultat pour « ' + q + ' »'; },
    usedIn: "Utilisé dans : ", viewRecipe: " — voir la recette"
  };

  // ---- préférence de langue persistante (sticky) ----
  // Le choix fait via le bouton FR/EN est mémorisé et appliqué à toutes les pages.
  var langToggle = d.querySelector(".lang-toggle");
  try {
    if (langToggle) {
      langToggle.addEventListener("click", function () {
        try { localStorage.setItem("hl_lang", EN ? "fr" : "en"); } catch (e) {}
      });
      var pref = localStorage.getItem("hl_lang");
      var curLang = EN ? "en" : "fr";
      var dest = langToggle.getAttribute("href");
      if (pref && pref !== curLang && dest) { location.replace(dest); return; }
    }
  } catch (e) {}

  // ---- nav mobile : centre l'onglet actif ----
  try {
    var cur = d.querySelector('nav ul a[aria-current="page"]');
    if (cur) { var list = cur.closest("ul"); if (list && list.scrollWidth > list.clientWidth) cur.scrollIntoView({ block: "nearest", inline: "center" }); }
  } catch (e) {}

  // ---- bulle (tooltip) d'objet ----
  var icons = d.querySelectorAll(".slot img, .chip img");
  for (var i = 0; i < icons.length; i++) {
    var t = icons[i].getAttribute("title");
    if (t) { icons[i].setAttribute("data-tip", t); icons[i].removeAttribute("title"); }
  }
  var tip = d.createElement("div"); tip.id = "hl-tip"; tip.setAttribute("role", "tooltip"); d.body.appendChild(tip);
  function placeTip(el) {
    var r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
    var x = r.left + r.width / 2 - tr.width / 2, y = r.top - tr.height - 9;
    x = Math.max(6, Math.min(x, window.innerWidth - tr.width - 6));
    if (y < 4) y = r.bottom + 9;
    tip.style.left = x + "px"; tip.style.top = y + "px";
    tip.style.setProperty("--ax", (r.left + r.width / 2 - x) + "px");
  }
  function showTip(el) {
    var name = el.getAttribute("data-tip") || el.getAttribute("alt"); if (!name) return;
    tip.textContent = el.classList.contains("linkable") ? name + T.viewRecipe : name;
    tip.classList.add("on"); placeTip(el);
  }
  function hideTip() { tip.classList.remove("on"); }
  function tgt(e) { return e.target.closest ? e.target.closest(".slot img, .chip img") : null; }
  d.addEventListener("mouseover", function (e) { var el = tgt(e); if (el) showTip(el); });
  d.addEventListener("mouseout", function (e) { if (tgt(e)) hideTip(); });
  window.addEventListener("scroll", hideTip, { passive: true });

  // ---- lightbox galerie ----
  var lb = d.createElement("div"); lb.id = "hl-lb";
  lb.innerHTML = '<button class="close" aria-label="Fermer">✕</button><img alt=""><div class="cap"></div>';
  d.body.appendChild(lb);
  var lbImg = lb.querySelector("img"), lbCap = lb.querySelector(".cap");
  function openLb(src, cap) { lbImg.src = src; lbImg.alt = cap || ""; lbCap.textContent = cap || ""; lb.classList.add("on"); }
  function closeLb() { lb.classList.remove("on"); lbImg.src = ""; }
  d.addEventListener("click", function (e) {
    var sh = e.target.closest ? e.target.closest(".gallery button.shot") : null;
    if (sh) { openLb(sh.getAttribute("data-full"), sh.getAttribute("data-cap")); return; }
    if (e.target === lb || e.target.closest(".close")) closeLb();
  });
  d.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeLb(); closeSearch(); } });

  // ---- données (recherche + navigation croisée) ----
  var DATA = null;
  fetch("assets/wikidata.json").then(function (r) { return r.json(); }).then(function (j) { DATA = j; wireCrossNav(j); buildSearch(j); }).catch(function () {});

  // navigation croisée : ingrédients cliquables + "utilisé dans"
  function wireCrossNav(j) {
    try {
      // ingrédients -> recette productrice
      var imgs = d.querySelectorAll(".recipe-grid img, .chip img");
      imgs.forEach(function (img) {
        var p = j.producers[norm(img.getAttribute("alt"))];
        if (!p) return;
        if (p.url.split("#")[0] === here && ("#" + (img.closest(".recipe") || {}).id) === ("#" + p.url.split("#")[1])) return;
        img.classList.add("linkable");
        img.addEventListener("click", function () { location.href = p.url; });
      });
      // "utilisé dans" par recette
      d.querySelectorAll(".recipe").forEach(function (rec) {
        var nameEl = rec.querySelector(".result-name"); if (!nameEl) return;
        var name = nameEl.childNodes[0] ? nameEl.childNodes[0].textContent.trim() : "";
        var list = j.consumers[norm(name)]; if (!list || !list.length) return;
        var seen = {}, uniq = [];
        list.forEach(function (c) { var k = c.name + c.url; if (!seen[k] && c.url.split("#")[1] !== rec.id) { seen[k] = 1; uniq.push(c); } });
        if (!uniq.length) return;
        var div = d.createElement("div"); div.className = "used-in";
        div.innerHTML = T.usedIn + uniq.slice(0, 8).map(function (c) { return '<a href="' + c.url + '">' + c.name + "</a>"; }).join(", ") + (uniq.length > 8 ? "…" : "");
        (rec.querySelector(".recipe-result") || rec).appendChild(div);
      });
    } catch (e) {}
  }

  // ---- recherche ----
  var searchBox, resultsEl, rows = [], selIdx = -1;
  function closeSearch() { if (resultsEl) resultsEl.classList.remove("on"); selIdx = -1; }
  function buildSearch(j) {
    var nav = d.querySelector("header.top nav"); if (!nav) return;
    var wrap = d.createElement("div"); wrap.className = "nav-search-wrap";
    wrap.innerHTML = '<input id="hl-search" type="search" placeholder="' + T.search + '" autocomplete="off" aria-label="' + T.searchAria + '"><div id="hl-results" role="listbox"></div>';
    nav.appendChild(wrap);
    searchBox = wrap.querySelector("#hl-search"); resultsEl = wrap.querySelector("#hl-results");

    // corpus
    var corpus = [];
    j.items.forEach(function (it) { corpus.push({ label: it.name, sub: T.itemSub, url: it.url, icon: it.icon, kind: T.item, n: norm(it.name) }); });
    j.pages.forEach(function (p) { if (p.url !== "index.html") corpus.push({ label: p.title, sub: T.pageSub, url: p.url, kind: T.page, n: norm(p.title) }); });
    j.sections.forEach(function (s) { corpus.push({ label: s.text, sub: s.page, url: s.url, kind: T.section, n: norm(s.text) }); });

    function render(q) {
      var nq = norm(q);
      rows = [];
      if (nq) {
        var starts = [], has = [];
        corpus.forEach(function (c) { var idx = c.n.indexOf(nq); if (idx === 0) starts.push(c); else if (idx > 0) has.push(c); });
        rows = starts.concat(has).slice(0, 12);
      }
      selIdx = -1;
      if (!nq) { closeSearch(); return; }
      if (!rows.length) { resultsEl.innerHTML = '<div class="empty">' + T.noResults(q) + '</div>'; resultsEl.classList.add("on"); return; }
      resultsEl.innerHTML = rows.map(function (c, k) {
        var ic = c.icon ? '<img src="' + c.icon + '" alt="">' : '<span style="width:22px"></span>';
        return '<a href="' + c.url + '" data-k="' + k + '" role="option">' + ic +
          '<span class="r-name"><span>' + c.label + '</span>' + (c.kind === T.section ? '<span class="r-sub">' + c.sub + "</span>" : "") +
          '</span><span class="r-kind">' + c.kind + "</span></a>";
      }).join("");
      resultsEl.classList.add("on");
    }
    searchBox.addEventListener("input", function () { render(searchBox.value); });
    searchBox.addEventListener("focus", function () { if (searchBox.value) render(searchBox.value); });
    searchBox.addEventListener("keydown", function (e) {
      var links = resultsEl.querySelectorAll("a");
      if (e.key === "ArrowDown") { e.preventDefault(); selIdx = Math.min(selIdx + 1, links.length - 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); selIdx = Math.max(selIdx - 1, 0); }
      else if (e.key === "Enter") { if (links[selIdx]) location.href = links[selIdx].getAttribute("href"); else if (links[0]) location.href = links[0].getAttribute("href"); return; }
      else return;
      links.forEach(function (a, k) { a.classList.toggle("sel", k === selIdx); });
      if (links[selIdx]) links[selIdx].scrollIntoView({ block: "nearest" });
    });
    d.addEventListener("click", function (e) { if (!wrap.contains(e.target)) closeSearch(); });
    d.addEventListener("keydown", function (e) {
      if (e.key === "/" && d.activeElement !== searchBox && !/^(INPUT|TEXTAREA)$/.test((d.activeElement || {}).tagName)) { e.preventDefault(); searchBox.focus(); }
    });
  }

  // ---- apparition au défilement ----
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var items = [].slice.call(d.querySelectorAll("main h2, .card, .recipe, main > .toc, main table, .pager, .gallery figure"));
  items.forEach(function (el) { el.classList.add("reveal"); });
  d.querySelectorAll(".grid, .recipe-list, .gallery").forEach(function (p) {
    [].slice.call(p.children).forEach(function (c, n) { if (c.classList.contains("reveal")) c.style.setProperty("--i", n); });
  });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add("in"); }); }
})();
