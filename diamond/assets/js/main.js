/* =====================================================================
   DIAMOND BARBEARIA — main.js
   Protótipo visual navegável. Sem integrações, sem dados inventados.
   ===================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOBILE  = window.matchMedia('(max-width: 760px)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined';
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------------------------
     1. GEOMETRIA DO DIAMANTE — 12 facetas independentes
        (traçadas a partir da logo original, viewBox 1000 x 760)
     ------------------------------------------------------------------ */
  var FACETS = [
    /* coroa */
    { d:'M25,192 L195,18 L340,18 L170,192 Z',   g:'crown' },
    { d:'M170,192 L340,18 L340,192 Z',          g:'crown' },
    { d:'M340,18 L500,18 L340,192 Z',           g:'crown' },
    { d:'M340,192 L500,18 L660,192 Z',          g:'crown' },
    { d:'M500,18 L660,18 L660,192 Z',           g:'crown' },
    { d:'M660,18 L830,192 L660,192 Z',          g:'crown' },
    { d:'M660,18 L805,18 L975,192 L830,192 Z',  g:'crown' },
    /* pavilhão */
    { d:'M25,192 L148,192 L492,742 Z',          g:'pav' },
    { d:'M160,192 L334,192 L496,742 Z',         g:'pav' },
    { d:'M346,192 L654,192 L500,742 Z',         g:'pav' },
    { d:'M666,192 L840,192 L504,742 Z',         g:'pav' },
    { d:'M852,192 L975,192 L508,742 Z',         g:'pav' }
  ];

  function buildDiamond(svg, opts) {
    opts = opts || {};
    var ns = 'http://www.w3.org/2000/svg';
    var frag = document.createDocumentFragment();
    FACETS.forEach(function (f, i) {
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', f.d);
      p.setAttribute('class', 'facet' + (opts.fill ? ' is-fill' : ''));
      p.setAttribute('data-i', i);
      p.setAttribute('data-g', f.g);
      frag.appendChild(p);
    });
    var target = opts.group ? svg.querySelector(opts.group) : svg;
    target.appendChild(frag);
    return Array.prototype.slice.call(target.querySelectorAll('.facet'));
  }

  /* centro geométrico aproximado de cada faceta — define o vetor de explosão */
  function centroid(d) {
    var nums = d.match(/-?\d+(\.\d+)?/g).map(Number), x = 0, y = 0, n = 0;
    for (var i = 0; i + 1 < nums.length; i += 2) { x += nums[i]; y += nums[i + 1]; n++; }
    return { x: x / n, y: y / n };
  }
  var CORE = { x: 500, y: 330 };
  var VECT = FACETS.map(function (f, i) {
    var c = centroid(f.d);
    var dx = c.x - CORE.x, dy = c.y - CORE.y;
    var len = Math.hypot(dx, dy) || 1;
    return {
      ux: dx / len, uy: dy / len,
      spread: 0.55 + (i % 4) * 0.2,
      rot: ((i % 2 ? 1 : -1) * (9 + (i * 4) % 26)),
      depth: (i % 3) * 0.14
    };
  });

  /* ------------------------------------------------------------------
     2. ABERTURA CINEMATOGRÁFICA
     ------------------------------------------------------------------ */
  var intro     = document.getElementById('intro');
  var introSvg  = document.getElementById('introMark');
  var introSkip = document.getElementById('introSkip');
  var introDone = false;

  function closeIntro() {
    if (introDone) return;
    introDone = true;
    intro.classList.add('is-done');
    document.body.classList.remove('is-locked');
    setTimeout(function () { if (intro && intro.parentNode) intro.parentNode.removeChild(intro); }, 1000);
    playHero();
  }

  function playHero() {
    var items = document.querySelectorAll('[data-hero]');
    if (!hasGSAP || REDUCED) {
      items.forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; });
      return;
    }
    gsap.fromTo(items,
      { yPercent: 108, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 1.15, stagger: 0.085, ease: 'power3.out' });
  }

  function runIntro() {
    if (!introSvg) return;
    var paths = buildDiamond(introSvg);
    if (!hasGSAP || REDUCED) { closeIntro(); return; }

    document.body.classList.add('is-locked');
    var tl = gsap.timeline({ onComplete: function () { setTimeout(closeIntro, 420); } });

    gsap.set(paths, {
      opacity: 0,
      transformOrigin: 'center center',
      x: function (i) { return VECT[i].ux * 230; },
      y: function (i) { return VECT[i].uy * 230; },
      rotate: function (i) { return VECT[i].rot * 2.2; },
      scale: 0.5
    });
    gsap.set(introSvg, { scale: 1.12, opacity: 0 });

    tl.to(introSvg, { opacity: 1, scale: 1, duration: 1.3, ease: 'power2.out' }, 0)
      .to(paths, {
        opacity: 1, x: 0, y: 0, rotate: 0, scale: 1,
        duration: 1.5, ease: 'power3.out',
        stagger: { each: 0.055, from: 'center' }
      }, 0.1)
      .to(paths, { strokeWidth: 9, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 1.35)
      .to('.intro-word', { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 1.25)
      .fromTo('.intro-word b', { letterSpacing: '0.8em', opacity: 0 },
              { letterSpacing: '0.34em', opacity: 1, duration: 1.2, ease: 'power3.out' }, 1.25)
      .to('.intro-bar', { opacity: 1, duration: 0.3 }, 1.5)
      .fromTo('.intro-bar i', { scaleX: 0 }, { scaleX: 1, duration: 1.0, ease: 'power1.inOut' }, 1.55)
      .to(introSkip, { opacity: 1, duration: 0.4 }, 0.9)
      .to([introSvg, '.intro-word', '.intro-bar'], { opacity: 0, duration: 0.5, ease: 'power2.in' }, 2.75);
  }
  if (introSkip) introSkip.addEventListener('click', closeIntro);

  /* ------------------------------------------------------------------
     3. DIAMANTE CONDUZIDO PELO SCROLL
     ------------------------------------------------------------------ */
  function initStage() {
    var stage = document.getElementById('diamondStage');
    var svg   = document.getElementById('stageSvg');
    if (!stage || !svg) return;
    var paths = buildDiamond(svg, { group: '#stageGroup', fill: true });
    if (MOBILE) paths.forEach(function (p) { p.style.strokeWidth = '9'; });
    else if (window.innerWidth > 1024) svg.querySelector('#stageGroup').classList.add('glow');

    if (!hasGSAP || !window.ScrollTrigger || REDUCED) {
      gsap && gsap.set && gsap.set(stage, { opacity: 0.16 });
      if (!hasGSAP) stage.style.opacity = '0.16';
      return;
    }

    var K = MOBILE ? 0.52 : 1;               // amplitude dos fragmentos
    var start = document.getElementById('sobre');
    var end   = document.getElementById('agendar');
    if (!start || !end) return;

    /* --- timeline mestre: fragmenta → deriva → reconstrói --- */
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: start,
        start: 'top bottom',
        endTrigger: end,
        end: 'bottom center',
        scrub: 1.1,
        invalidateOnRefresh: true
      }
    });

    /* fase 1 — separação das partes */
    tl.to(paths, {
      x: function (i) { return VECT[i].ux * 340 * VECT[i].spread * K; },
      y: function (i) { return VECT[i].uy * 300 * VECT[i].spread * K; },
      rotate: function (i) { return VECT[i].rot * K; },
      scale: function (i) { return 1 - VECT[i].depth * 0.5; },
      opacity: function (i) { return 0.5 + VECT[i].depth; },
      ease: 'power1.inOut',
      duration: 0.42,
      stagger: { each: 0.012, from: 'center' }
    }, 0);

    /* fase 2 — deriva com profundidade */
    tl.to(paths, {
      x: function (i) { return VECT[i].ux * 430 * VECT[i].spread * K; },
      y: function (i) { return VECT[i].uy * 370 * VECT[i].spread * K + (i % 2 ? 26 : -26) * K; },
      rotate: function (i) { return VECT[i].rot * 1.75 * K; },
      scale: function (i) { return 0.84 - VECT[i].depth * 0.3; },
      ease: 'sine.inOut',
      duration: 0.2
    }, 0.42);

    /* fase 3 — reconstrução */
    tl.to(paths, {
      x: 0, y: 0, rotate: 0, scale: 1, opacity: 1,
      ease: 'power2.inOut',
      duration: 0.38,
      stagger: { each: 0.01, from: 'edges' }
    }, 0.62);

    /* --- presença do palco por seção --- */
    function stageAt(sel, vars, startAt, endAt) {
      var el = document.querySelector(sel);
      if (!el) return;
      gsap.to(stage, Object.assign({
        scrollTrigger: {
          trigger: el,
          start: startAt || 'top 80%',
          end: endAt || 'bottom 20%',
          scrub: 1,
          invalidateOnRefresh: true
        },
        ease: 'none'
      }, vars));
    }
    gsap.set(stage, { opacity: 0.62, scale: 1, yPercent: 0 });
    stageAt('#inicio',    { opacity: 0.09, scale: 0.6, yPercent: -3 }, 'top top', 'bottom 30%');
    stageAt('#manifesto', { opacity: 0.5,  scale: 0.84 }, 'top 30%', 'center center');
    stageAt('#manifesto', { opacity: 0.07, scale: 0.6  }, 'center center', 'bottom 25%');
    stageAt('#agendar',   { opacity: 0.16, scale: 0.72 }, 'top 55%', 'bottom 45%');
    stageAt('#contato',   { opacity: 0.3,  scale: 0.68 }, 'top 65%', 'center 60%');

    /* rotação lenta do conjunto, ligada ao scroll */
    gsap.to('#stageGroup', {
      rotation: MOBILE ? 4 : 9,
      transformOrigin: '50% 45%',
      ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 2 }
    });
  }

  /* ------------------------------------------------------------------
     4. DADOS — serviços, time, galeria (exatamente como fornecidos)
     ------------------------------------------------------------------ */
  var SERVICES = [
    { n:'Barba',                             d:'30 minutos', p:'30,00',  c:'barba' },
    { n:'Barba + Sobrancelha',               d:'30 minutos', p:'37,00',  c:'barba' },
    { n:'Corte',                             d:'30 minutos', p:'37,00',  c:'corte' },
    { n:'Corte + Barba',                     d:'1 hora',     p:'60,00',  c:'combo' },
    { n:'Corte + Barba + Sobrancelha',       d:'1 hora',     p:'65,00',  c:'combo' },
    { n:'Corte + Sobrancelha',               d:'30 minutos', p:'45,00',  c:'combo' },
    { n:'Máquina',                           d:'30 minutos', p:'28,00',  c:'corte' },
    { n:'Máquina + Barba',                   d:'1 hora',     p:'55,00',  c:'combo' },
    { n:'Máquina + Barba + Sobrancelha',     d:'1 hora',     p:'60,00',  c:'combo' },
    { n:'Máquina + Sobrancelha',             d:'30 minutos', p:'37,00',  c:'combo' },
    { n:'Pacote 4 Cabelo + Barba',           d:'30 minutos', p:'220,00', c:'pacote', pack:true },
    { n:'Pacote 4 Cortes',                   d:'30 minutos', p:'130,00', c:'pacote', pack:true },
    { n:'Pacote 4 Cortes Máquina',           d:'30 minutos', p:'110,00', c:'pacote', pack:true },
    { n:'Pigmentação',                       d:'30 minutos', p:'25,00',  c:'extra' },
    { n:'Sobrancelha',                       d:'10 minutos', p:'10,00',  c:'extra' }
  ];

  /* nome / especialidade / apresentação ficam como campos editáveis:
     nenhuma informação sobre os profissionais foi inventada. */
  var TEAM = [
    { img:'p1', name:'', role:'', bio:'' },
    { img:'p2', name:'', role:'', bio:'' },
    { img:'p3', name:'', role:'', bio:'' },
    { img:'p4', name:'', role:'', bio:'' },
    { img:'p5', name:'', role:'', bio:'' }
  ];
  var PH_NAME = 'A definir', PH_ROLE = 'Especialidade a definir',
      PH_BIO  = 'Apresentação individual — campo editável pelo estabelecimento.';

  var CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  /* ---------- serviços ---------- */
  var svcGrid = document.getElementById('svcGrid');
  if (svcGrid) {
    svcGrid.innerHTML = SERVICES.map(function (s, i) {
      return '<article class="svc' + (s.pack ? ' svc--pack' : '') + '" data-cat="' + s.c + '" data-rv="fade-u">' +
        (s.pack ? '<span class="tag">Pacote</span>' : '') +
        '<div class="svc-top"><h3 class="svc-name">' + s.n + '</h3>' +
        '<span class="svc-num">' + String(i + 1).padStart(2, '0') + '</span></div>' +
        '<p class="svc-meta">' + CLOCK + s.d + '</p>' +
        '<div class="svc-price"><em>A partir de</em><b><small>R$</small>' + s.p + '</b></div>' +
        '<div class="svc-foot"><span class="svc-meta" style="letter-spacing:.14em">' +
        (s.pack ? 'Pacote — 4 sessões' : 'Atendimento individual') + '</span>' +
        '<button class="btn btn--sm" type="button" data-book-service="' + i + '">Agendar</button></div>' +
        '</article>';
    }).join('');

    document.querySelectorAll('.svc-filters .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.svc-filters .chip').forEach(function (c) {
          c.classList.remove('is-on'); c.setAttribute('aria-selected', 'false');
        });
        chip.classList.add('is-on'); chip.setAttribute('aria-selected', 'true');
        var f = chip.dataset.filter;
        document.querySelectorAll('.svc').forEach(function (card) {
          var show = f === 'all' || card.dataset.cat === f;
          card.style.display = show ? '' : 'none';
          if (show && hasGSAP && !REDUCED) {
            gsap.fromTo(card, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .5, ease: 'power2.out' });
          }
        });
        if (hasGSAP && window.ScrollTrigger) ScrollTrigger.refresh();
      });
    });
  }

  /* ---------- time ---------- */
  var teamRail = document.getElementById('teamRail');
  if (teamRail) {
    teamRail.innerHTML = TEAM.map(function (m, i) {
      var isPh = !m.name;
      return '<article class="member" data-rv="fade-u" tabindex="0">' +
        '<img src="assets/img/' + m.img + '-portrait.webp" alt="Profissional da Diamond Barbearia" width="900" height="1200" loading="lazy" decoding="async">' +
        '<svg class="member-cut" viewBox="0 0 100 100" aria-hidden="true"><path d="M8 8 H46 L8 46 Z" fill="none" stroke="#fff" stroke-width="1.2" opacity=".8"/><path d="M8 8 H28 L8 28 Z" fill="none" stroke="#fff" stroke-width="1.2" opacity=".5"/></svg>' +
        '<div class="member-body">' +
          '<span class="member-idx">' + String(i + 1).padStart(2, '0') + ' / 05</span>' +
          '<h3 class="member-name' + (isPh ? ' is-ph' : '') + '">' + (m.name || PH_NAME) + '</h3>' +
          '<p class="member-role">' + (m.role || PH_ROLE) + '</p>' +
          '<p class="member-bio">' + (m.bio || PH_BIO) + '</p>' +
          '<button class="btn btn--sm" type="button" data-book-pro="' + i + '">Agendar com este profissional</button>' +
        '</div></article>';
    }).join('');
  }

  /* ---------- navegação do rail de profissionais ---------- */
  (function () {
    var rail = document.getElementById('teamRail');
    var prev = document.getElementById('railPrev');
    var next = document.getElementById('railNext');
    if (!rail || !prev || !next) return;
    function step() {
      var card = rail.querySelector('.member');
      return card ? card.getBoundingClientRect().width + 16 : 300;
    }
    function sync() {
      var max = rail.scrollWidth - rail.clientWidth - 2;
      prev.disabled = rail.scrollLeft <= 2;
      next.disabled = rail.scrollLeft >= max;
    }
    prev.addEventListener('click', function () {
      rail.scrollBy({ left: -step(), behavior: REDUCED ? 'auto' : 'smooth' });
    });
    next.addEventListener('click', function () {
      rail.scrollBy({ left: step(), behavior: REDUCED ? 'auto' : 'smooth' });
    });
    rail.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    setTimeout(sync, 60);
  })();

  /* ---------- galeria: apenas fotos reais + espaços reservados ---------- */
  var GAL = [
    { img:'p3', cap:'Ambiente — estação de trabalho', cls:'g-a' },
    { img:'p1', cap:'Atendimento',                    cls:'g-b' },
    { img:'p2', cap:'Resultado — acabamento',         cls:'g-c' },
    { slot:true, cls:'g-d', txt:'Ambiente interno' },
    { slot:true, cls:'g-d', txt:'Cadeiras & estações' },
    { img:'p5', cap:'Profissional',                   cls:'g-d' },
    { slot:true, cls:'g-d', txt:'Decoração' },
    { img:'p4', cap:'Profissional',                   cls:'g-d' },
    { slot:true, cls:'g-b', txt:'Equipamentos · fotos a enviar' }
  ];
  var galEl = document.getElementById('gal');
  var lbItems = [];
  if (galEl) {
    galEl.innerHTML = GAL.map(function (g) {
      if (g.slot) {
        return '<div class="gal-item gal-slot ' + g.cls + '" data-rv="fade-u">' +
          '<img src="assets/img/diamond-mark.png" alt="" width="40" height="31" loading="lazy">' +
          '<span>' + g.txt + '<br>espaço reservado</span></div>';
      }
      var idx = lbItems.length;
      lbItems.push({ src: 'assets/img/' + g.img + '.webp', cap: g.cap });
      return '<figure class="gal-item ' + g.cls + '" data-rv="fade-u" data-lb="' + idx + '" tabindex="0">' +
        '<img src="assets/img/' + g.img + '-sm.webp" alt="' + g.cap + ' — Diamond Barbearia" width="420" height="422" loading="lazy" decoding="async">' +
        '<span class="zoom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg></span>' +
        '<figcaption class="gal-cap">' + g.cap + '</figcaption></figure>';
    }).join('');
  }

  /* ---------- lightbox ---------- */
  var lb = document.getElementById('lb'), lbImg = document.getElementById('lbImg'),
      lbCount = document.getElementById('lbCount'), lbIdx = 0;
  function lbOpen(i) {
    lbIdx = (i + lbItems.length) % lbItems.length;
    lbImg.src = lbItems[lbIdx].src;
    lbImg.alt = lbItems[lbIdx].cap;
    lbCount.textContent = (lbIdx + 1) + ' / ' + lbItems.length;
    lb.classList.add('is-open');
    document.body.classList.add('is-locked');
  }
  function lbClose() { lb.classList.remove('is-open'); document.body.classList.remove('is-locked'); }
  if (galEl) {
    galEl.addEventListener('click', function (e) {
      var f = e.target.closest('[data-lb]'); if (f) lbOpen(+f.dataset.lb);
    });
    galEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var f = e.target.closest('[data-lb]'); if (f) { e.preventDefault(); lbOpen(+f.dataset.lb); }
    });
  }
  document.getElementById('lbClose').addEventListener('click', lbClose);
  document.getElementById('lbPrev').addEventListener('click', function () { lbOpen(lbIdx - 1); });
  document.getElementById('lbNext').addEventListener('click', function () { lbOpen(lbIdx + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) lbClose(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') lbClose();
    if (e.key === 'ArrowRight') lbOpen(lbIdx + 1);
    if (e.key === 'ArrowLeft') lbOpen(lbIdx - 1);
  });

  /* ------------------------------------------------------------------
     5. NAVEGAÇÃO
     ------------------------------------------------------------------ */
  var nav = document.getElementById('nav'), burger = document.getElementById('burger'),
      drawer = document.getElementById('drawer'), lastY = 0;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    nav.classList.toggle('is-stuck', y > 40);
    if (!drawer.classList.contains('is-open')) {
      nav.classList.toggle('is-hidden', y > lastY && y > 420);
    }
    lastY = y;
    var p = document.getElementById('progress');
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (p) p.style.transform = 'scaleX(' + (h > 0 ? Math.min(y / h, 1) : 0) + ')';
    var wa = document.getElementById('waFloat');
    if (wa) wa.classList.toggle('is-in', y > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  function toggleDrawer(force) {
    var open = typeof force === 'boolean' ? force : !drawer.classList.contains('is-open');
    drawer.classList.toggle('is-open', open);
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    drawer.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('is-locked', open);
    if (open) nav.classList.remove('is-hidden');
  }
  burger.addEventListener('click', function () { toggleDrawer(); });
  drawer.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { toggleDrawer(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) toggleDrawer(false);
  });

  /* link ativo */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('#navLinks a'));
  var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var i = sections.indexOf(en.target);
        if (i < 0) return;
        navLinks.forEach(function (a) { a.classList.remove('is-active'); });
        navLinks[i].classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { if (s) io.observe(s); });
  }

  /* ------------------------------------------------------------------
     6. REVEALS / PARALLAX / CONTADORES
     ------------------------------------------------------------------ */
  function initReveals() {
    var els = document.querySelectorAll('[data-rv]');
    if (!hasGSAP || !window.ScrollTrigger || REDUCED) {
      els.forEach(function (el) { el.style.opacity = 1; });
      return;
    }
    els.forEach(function (el) {
      var k = el.dataset.rv, from = { opacity: 0, y: 42 };
      if (k === 'fade-r') from = { opacity: 0, x: -46 };
      if (k === 'fade-l') from = { opacity: 0, x: 46 };
      gsap.fromTo(el, from, {
        opacity: 1, x: 0, y: 0, duration: 1.05, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    document.querySelectorAll('[data-parallax]').forEach(function (el) {
      var amt = parseFloat(el.dataset.parallax) || 0.08;
      gsap.fromTo(el.querySelector('img') || el, { yPercent: -amt * 100 }, {
        yPercent: amt * 100, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1 }
      });
    });

    document.querySelectorAll('[data-count]').forEach(function (el) {
      var target = +el.dataset.count, pad = el.textContent.trim().length;
      var o = { v: target > 100 ? target - 18 : 0 };
      gsap.to(o, {
        v: target, duration: 1.6, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: function () { el.textContent = String(Math.round(o.v)).padStart(pad, '0'); }
      });
    });

    gsap.utils.toArray('.sec-title').forEach(function (t) {
      gsap.fromTo(t, { letterSpacing: '0.16em', opacity: 0 },
        { letterSpacing: '0.03em', opacity: 1, duration: 1.3, ease: 'power3.out',
          scrollTrigger: { trigger: t, start: 'top 88%', once: true } });
    });
  }

  /* ------------------------------------------------------------------
     7. FLUXO DE AGENDAMENTO (somente interface — sem reservas)
     ------------------------------------------------------------------ */
  var state = { service: null, pro: null, date: null, step: 0 };

  var bookServices = document.getElementById('bookServices');
  if (bookServices) {
    bookServices.innerHTML = SERVICES.map(function (s, i) {
      return '<button class="opt" type="button" data-svc="' + i + '">' +
        '<b>' + s.n + '</b><span class="meta2">' + s.d + '</span>' +
        '<span class="meta2">a partir de R$ ' + s.p + '</span></button>';
    }).join('');
    bookServices.addEventListener('click', function (e) {
      var b = e.target.closest('[data-svc]'); if (!b) return;
      selService(+b.dataset.svc);
    });
  }
  var bookPros = document.getElementById('bookPros');
  if (bookPros) {
    bookPros.innerHTML = TEAM.map(function (m, i) {
      return '<button class="opt opt-pro" type="button" data-pro="' + i + '">' +
        '<img src="assets/img/' + m.img + '-sm.webp" alt="" width="46" height="46" loading="lazy">' +
        '<span style="display:flex;flex-direction:column;gap:3px;text-align:left">' +
        '<b>' + (m.name || ('Profissional ' + String(i + 1).padStart(2, '0'))) + '</b>' +
        '<span>' + (m.role || 'Nome a definir') + '</span></span></button>';
    }).join('');
    bookPros.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pro]'); if (!b) return;
      selPro(+b.dataset.pro);
    });
  }

  function selService(i) {
    state.service = i;
    bookServices.querySelectorAll('.opt').forEach(function (o, k) { o.classList.toggle('is-sel', k === i); });
    updateSummary();
  }
  function selPro(i) {
    state.pro = i;
    bookPros.querySelectorAll('.opt').forEach(function (o, k) { o.classList.toggle('is-sel', k === i); });
    updateSummary();
  }

  /* calendário real (datas), sem qualquer disponibilidade inventada */
  var MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var DOW = ['D','S','T','Q','Q','S','S'];
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var view = new Date(today.getFullYear(), today.getMonth(), 1);

  function renderCal() {
    var el = document.getElementById('cal'); if (!el) return;
    var y = view.getFullYear(), m = view.getMonth();
    var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    var atMin = (y === today.getFullYear() && m === today.getMonth());
    var h = '<div class="cal-head">' +
      '<button class="cal-nav" type="button" data-cal="-1" aria-label="Mês anterior"' + (atMin ? ' disabled' : '') + '>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18 9 12l6-6"/></svg></button>' +
      '<b>' + MONTHS[m] + ' ' + y + '</b>' +
      '<button class="cal-nav" type="button" data-cal="1" aria-label="Próximo mês">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg></button></div><div class="cal-grid">';
    DOW.forEach(function (d) { h += '<span class="cal-dow">' + d + '</span>'; });
    for (var i = 0; i < first; i++) h += '<span class="cal-day is-off"></span>';
    for (var d = 1; d <= days; d++) {
      var dt = new Date(y, m, d);
      var past = dt < today;
      var sel = state.date && dt.getTime() === state.date.getTime();
      var isToday = dt.getTime() === today.getTime();
      h += '<button class="cal-day' + (past ? ' is-off' : '') + (sel ? ' is-sel' : '') + (isToday ? ' is-today' : '') +
           '" type="button"' + (past ? ' disabled' : ' data-day="' + d + '"') + '>' + d + '</button>';
    }
    el.innerHTML = h + '</div>';
  }
  var calEl = document.getElementById('cal');
  if (calEl) {
    renderCal();
    calEl.addEventListener('click', function (e) {
      var nv = e.target.closest('[data-cal]');
      if (nv) { view.setMonth(view.getMonth() + (+nv.dataset.cal)); renderCal(); return; }
      var dd = e.target.closest('[data-day]');
      if (dd) {
        state.date = new Date(view.getFullYear(), view.getMonth(), +dd.dataset.day);
        renderCal(); updateSummary();
      }
    });
  }

  function updateSummary() {
    function set(id, val) {
      var el = document.getElementById(id); if (!el) return;
      el.textContent = val || el.dataset.ph || el.textContent;
      el.classList.toggle('empty', !val);
    }
    var s = state.service != null ? SERVICES[state.service] : null;
    set('sumService', s ? s.n : '');
    set('sumDuration', s ? s.d : '');
    set('sumPrice', s ? 'A partir de R$ ' + s.p : '');
    set('sumPro', state.pro != null
      ? (TEAM[state.pro].name || ('Profissional ' + String(state.pro + 1).padStart(2, '0') + ' — nome a definir'))
      : '');
    set('sumDate', state.date
      ? state.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      : '');
  }
  ['sumService','sumDuration','sumPrice','sumPro','sumDate','sumTime'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.dataset.ph = el.textContent;
  });

  function goStep(n) {
    state.step = Math.max(0, Math.min(4, n));
    document.querySelectorAll('.book-pane').forEach(function (p) {
      p.classList.toggle('is-on', +p.dataset.pane === state.step);
    });
    document.querySelectorAll('.bstep').forEach(function (b, i) {
      b.classList.toggle('is-on', i === state.step);
      b.classList.toggle('is-done', i < state.step);
    });
    var prev = document.getElementById('bookPrev'), next = document.getElementById('bookNext');
    prev.style.visibility = state.step === 0 ? 'hidden' : 'visible';
    next.textContent = state.step === 4 ? 'Aguardando integração' : 'Avançar';
    next.disabled = state.step === 4;
  }
  document.getElementById('bookPrev').addEventListener('click', function () { goStep(state.step - 1); });
  document.getElementById('bookNext').addEventListener('click', function () { goStep(state.step + 1); });
  document.getElementById('bookSteps').addEventListener('click', function (e) {
    var b = e.target.closest('.bstep'); if (b) goStep(+b.dataset.step);
  });
  goStep(0);

  /* atalhos vindos dos cards */
  document.addEventListener('click', function (e) {
    var sBtn = e.target.closest('[data-book-service]');
    var pBtn = e.target.closest('[data-book-pro]');
    if (!sBtn && !pBtn) return;
    if (sBtn) { selService(+sBtn.dataset.bookService); goStep(1); }
    if (pBtn) { selPro(+pBtn.dataset.bookPro); goStep(2); }
    document.getElementById('agendar').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  });

  /* ------------------------------------------------------------------
     8. RODAPÉ + BOOT
     ------------------------------------------------------------------ */
  var footMark = document.getElementById('footMark');
  if (footMark) {
    footMark.innerHTML = '<defs><linearGradient id="chromeStroke2" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#55595e"/><stop offset="40%" stop-color="#ffffff"/>' +
      '<stop offset="100%" stop-color="#6e7378"/></linearGradient></defs>';
    var fp = buildDiamond(footMark);
    if (hasGSAP && window.ScrollTrigger && !REDUCED) {
      gsap.fromTo(fp,
        { opacity: 0, scale: 0.78, y: 26, transformOrigin: 'center' },
        { opacity: 1, scale: 1, y: 0, duration: 1.1, ease: 'power3.out',
          stagger: { each: 0.05, from: 'center' },
          scrollTrigger: { trigger: footMark, start: 'top 92%', once: true } });
    }
  }
  var yr = document.getElementById('yr'); if (yr) yr.textContent = new Date().getFullYear();

  function boot() {
    initStage();
    initReveals();
    onScroll();
    if (hasGSAP && window.ScrollTrigger) {
      ScrollTrigger.refresh();
      window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    }
    if (location.hash && location.hash !== '#inicio') { if (intro) closeIntro(); }
    else runIntro();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
