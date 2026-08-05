/* ==========================================================================
   BRS Connect — Interactions
   Vanilla JS, sans dépendance. Chaque module est indépendant et sort
   silencieusement si son point d'ancrage est absent de la page.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.dataset.open === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* --- Compteurs animés -------------------------------------------------- */
  function initCounters() {
    var nodes = document.querySelectorAll('[data-count-to]');
    if (!nodes.length) return;

    function run(el) {
      var target = parseInt(el.dataset.countTo, 10) || 0;
      if (reduceMotion) { el.textContent = String(target); return; }

      var duration = 900;
      var start = null;

      function frame(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        // easeOutCubic
        el.textContent = String(Math.floor((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = String(target);
      }
      requestAnimationFrame(frame);
    }

    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (el) { el.textContent = el.dataset.countTo; });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    nodes.forEach(function (el) { io.observe(el); });
  }

  /* --- Animation du mot "Connect" ---------------------------------------- */
  function initSpinWord() {
    var el = document.querySelector('[data-spin-word]');
    if (!el || reduceMotion) return;

    var text = el.textContent.trim();
    var frag = document.createDocumentFragment();

    text.split('').forEach(function (ch, i) {
      var span = document.createElement('span');
      span.className = 'spin-word__letter';
      span.style.animationDelay = i * 55 + 'ms';
      span.textContent = ch;
      frag.appendChild(span);
    });

    el.textContent = '';
    el.appendChild(frag);
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
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

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

  /* --- Formulaire de démonstration ---------------------------------------
     Tant qu'aucun endpoint réel n'est branché, l'envoi est intercepté et
     seul un message de confirmation est affiché. Voir README.             */
  function initForm() {
    var form = document.querySelector('[data-demo-form]');
    var status = document.querySelector('[data-form-status]');
    if (!form || !status) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      status.dataset.visible = 'true';
      status.setAttribute('tabindex', '-1');
      status.focus();
      form.reset();
    });
  }

  /* --- Année courante dans le pied de page -------------------------------- */
  function initYear() {
    var el = document.querySelector('[data-year]');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* --- Amorçage ----------------------------------------------------------- */
  function init() {
    initNav();
    initCounters();
    initSpinWord();
    initReveal();
    initScrollSpy();
    initToTop();
    initForm();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
