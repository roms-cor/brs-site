/* ==========================================================================
   BRS Connect — Interactions
   Vanilla JS, sans dépendance. Chaque module est indépendant et sort
   silencieusement si son point d'ancrage est absent de la page.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Lit un token CSS pour éviter qu'une valeur vive à deux endroits.
     css/tokens.css reste la source unique ; le JS s'y aligne au chargement. */
  function token(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      var n = parseFloat(v);
      return isNaN(n) ? fallback : n;
    } catch (e) {
      return fallback;
    }
  }

  /* --- Menu mobile ------------------------------------------------------ */
  function initNav() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var panel = document.querySelector('[data-nav-panel]');
    if (!toggle || !panel) return;

    function setOpen(open) {
      panel.dataset.open = String(open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    }

    toggle.addEventListener('click', function () {
      setOpen(panel.dataset.open !== 'true');
    });

    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    /* Panneau ouvert : Échap ferme, Tab reste dans le cycle
       toggle → liens du panneau → toggle (pas de fuite de focus
       vers la page masquée derrière). */
    document.addEventListener('keydown', function (e) {
      if (panel.dataset.open !== 'true') return;
      if (e.key === 'Escape') {
        setOpen(false);
        toggle.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      var items = panel.querySelectorAll('a[href]');
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      var active = document.activeElement;
      if (e.shiftKey) {
        if (active === first) { e.preventDefault(); toggle.focus(); }
        else if (active === toggle) { e.preventDefault(); last.focus(); }
      } else {
        if (active === last) { e.preventDefault(); toggle.focus(); }
        else if (active === toggle) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* --- Apparition au défilement ------------------------------------------ */
  function initReveal() {
    var nodes = document.querySelectorAll('[data-reveal]');
    if (!nodes.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      nodes.forEach(function (el) { el.dataset.revealed = 'true'; });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.dataset.revealed = 'true';
        io.unobserve(entry.target);
      });
    }, { threshold: token('--reveal-threshold', 0.12), rootMargin: '0px 0px -40px 0px' });

    nodes.forEach(function (el) { io.observe(el); });
  }

  /* --- Lien de navigation actif ------------------------------------------ */
  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-spy] a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var sections = [];

    links.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (!section) return;
      map[id] = link;
      sections.push(section);
    });
    if (!sections.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = map[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach(function (l) { l.removeAttribute('aria-current'); });
          link.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (s) { io.observe(s); });
  }

  /* --- Retour en haut ----------------------------------------------------- */
  function initToTop() {
    var btn = document.querySelector('[data-to-top]');
    if (!btn) return;

    var ticking = false;
    function update() {
      btn.dataset.visible = String(window.scrollY > 600);
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    update();
  }

  /* --- Année courante dans le pied de page -------------------------------- */
  function initYear() {
    var el = document.querySelector('[data-year]');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* --- Amorçage ----------------------------------------------------------- */
  function init() {
    initNav();
    initReveal();
    initScrollSpy();
    initToTop();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
