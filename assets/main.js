/* keerat.fyi — sky, stars, dial, tabla loader, small interactions */
(function () {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------------- sky ---------------- */
  // [top, upper, lower, horizon, glow] at t = 0, .33, .66, 1
  const KEYS = [
    ['#24346e', '#4f5a9c', '#c98a9a', '#f6b27c', '#ffcf8a'],
    ['#1d275e', '#45407f', '#9c5a7c', '#d97a5e', '#ffad7a'],
    ['#10153d', '#2a2560', '#5e3a6e', '#a24a5c', '#e0788a'],
    ['#05071a', '#0a0e2a', '#141638', '#1f1d44', '#8ea2ff'],
  ];
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const KEYRGB = KEYS.map((row) => row.map(hex));
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const names = ['--sky-0', '--sky-1', '--sky-2', '--sky-3', '--glow'];

  function skyAt(t) {
    const x = Math.min(0.9999, Math.max(0, t)) * 3, i = Math.floor(x), k = x - i;
    return KEYRGB[i].map((c, j) => mix(c, KEYRGB[i + 1][j], k));
  }

  let dialT = 0, scrollT = 0, t = -1, userDial = false;
  const listeners = [];
  function applySky() {
    const nt = dialT + (1 - dialT) * scrollT;
    if (Math.abs(nt - t) < 0.002) return;
    t = nt;
    const cols = skyAt(t);
    cols.forEach((c, i) => root.style.setProperty(names[i], css(c)));
    root.style.setProperty('--t', t.toFixed(3));
    $('meta[name=theme-color]').setAttribute('content', css(cols[0]));
    listeners.forEach((fn) => fn(t));
  }
  const smooth = (e0, e1, x) => { const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? scrollY / max : 0;
    scrollT = smooth(0.02, 0.92, p);
    applySky();
    nav.classList.toggle('scrolled', scrollY > 40);
  }

  /* ---------------- dial: follows local time where Keerat is ---------------- */
  const dial = $('#skyDial'), skyName = $('#skyName'), skyTime = $('#skyTime'), reset = $('#skyReset');
  function myTime() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const h = +parts.find((p) => p.type === 'hour').value % 24, m = +parts.find((p) => p.type === 'minute').value;
    return { h, m, label: new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(new Date()).toLowerCase() };
  }
  function tFromClock(h, m) {
    const x = h + m / 60;
    if (x >= 5 && x < 16) return 0;                  // daytime → golden hour warmth
    if (x >= 16 && x < 19.5) return ((x - 16) / 3.5) * 0.35;
    if (x >= 19.5 && x < 21) return 0.35 + ((x - 19.5) / 1.5) * 0.25;
    return 0.6;                                       // night: hero stays at late twilight
  }
  const phase = (v) => (v < 0.15 ? 'golden hour' : v < 0.4 ? 'sunset' : v < 0.7 ? 'twilight' : 'night');
  function syncClock() {
    if (userDial) return;
    const { h, m, label } = myTime();
    dialT = tFromClock(h, m);
    dial.value = Math.round(dialT * 100);
    skyName.textContent = phase(dialT);
    skyTime.textContent = `It's ${label} where I am.`;
    dial.setAttribute('aria-valuetext', `${phase(dialT)}, matching ${label} where Keerat is`);
    reset.title = `It's ${label} where I am`;
    applySky();
  }
  dial.addEventListener('input', () => {
    userDial = true;
    dialT = dial.value / 100;
    skyName.textContent = phase(dialT);
    dial.setAttribute('aria-valuetext', phase(dialT));
    reset.hidden = false;
    applySky();
  });
  reset.addEventListener('click', () => { userDial = false; reset.hidden = true; syncClock(); });

  /* ---------------- stars ---------------- */
  const sc = $('.stars'), sx = sc.getContext('2d');
  let stars = [], starsAlpha = 0, starRaf = 0;
  function seedStars() {
    const dpr = Math.min(devicePixelRatio, 2);
    sc.width = innerWidth * dpr; sc.height = innerHeight * dpr;
    sx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((innerWidth * innerHeight) / 7000);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * innerWidth, y: Math.pow(Math.random(), 1.4) * innerHeight,
      r: Math.random() < 0.08 ? 1.4 + Math.random() : 0.4 + Math.random() * 0.8,
      p: Math.random() * Math.PI * 2, s: 0.4 + Math.random() * 1.2,
    }));
  }
  function drawStars(now) {
    starRaf = 0;
    sx.clearRect(0, 0, innerWidth, innerHeight);
    if (starsAlpha <= 0.01) return;
    const time = (now || 0) / 1000;
    for (const s of stars) {
      const tw = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(time * s.s + s.p);
      sx.globalAlpha = starsAlpha * tw * (1 - s.y / innerHeight * 0.55);
      sx.fillStyle = '#fff6e6';
      sx.beginPath(); sx.arc(s.x, s.y, s.r, 0, Math.PI * 2); sx.fill();
    }
    sx.globalAlpha = 1;
    if (!reduced && !document.hidden) starRaf = requestAnimationFrame(drawStars);
  }
  listeners.push((tt) => {
    const a = smooth(0.42, 0.95, tt);
    const was = starsAlpha; starsAlpha = a;
    if ((a > 0.01 && !starRaf) || (reduced && Math.abs(was - a) > 0.01) || (a <= 0.01 && was > 0.01)) {
      if (!starRaf) starRaf = requestAnimationFrame(drawStars);
    }
  });

  /* ---------------- nav + sound ---------------- */
  const nav = $('#nav');
  const soundBtn = $('#soundBtn');
  soundBtn.addEventListener('click', () => {
    const on = window.ksAudio.setDrone(!window.ksAudio.droneOn);
    soundBtn.setAttribute('aria-pressed', String(on));
  });

  /* ---------------- tabla (lazy) ---------------- */
  const stage = $('#stage');
  let tabla = null, loading = false;
  const bolBig = $('#bolBig');
  let bolTimer = 0;
  function showBol(bol) {
    bolBig.textContent = bol; bolBig.classList.add('show');
    clearTimeout(bolTimer); bolTimer = setTimeout(() => bolBig.classList.remove('show'), 420);
    const btn = $(`.bol[data-bol="${bol}"]`);
    if (btn) { btn.classList.add('hit'); setTimeout(() => btn.classList.remove('hit'), 140); }
  }
  function floatBol(bol, x, y) {
    const r = stage.getBoundingClientRect();
    const el = document.createElement('span');
    el.className = 'float-bol'; el.textContent = bol;
    el.style.left = `${x - r.left}px`; el.style.top = `${y - r.top}px`;
    stage.appendChild(el); setTimeout(() => el.remove(), 1000);
  }
  async function loadTabla() {
    if (loading) return; loading = true;
    try {
      const { mountTabla } = await import('./tabla.js');
      tabla = mountTabla(stage, {
        reducedMotion: reduced,
        onBol: (bol, drum, x, y) => {
          showBol(bol);
          if (x != null) { floatBol(bol, x, y); $('#stageHint').style.opacity = 0; }
        },
      });
      tabla.setSky(Math.max(0, t));
      listeners.push((tt) => tabla.setSky(tt));
      $('#stageLoading').remove();
    } catch (err) {
      console.warn('3D tabla unavailable', err);
      $('#stageLoading').textContent = 'The 3D tabla needs WebGL. The buttons still play every stroke.';
    }
  }
  new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { loadTabla(); io.disconnect(); } }, { rootMargin: '600px' }).observe(stage);

  function playBol(bol) {
    if (tabla) tabla.play(bol); else { window.ksAudio.play(bol); showBol(bol); }
  }
  $$('.bol').forEach((b) => b.addEventListener('click', () => playBol(b.dataset.bol)));
  const keys = { j: 'Na', k: 'Tin', l: 'Tun', d: 'Ge', f: 'Ke' };
  let playInView = false;
  new IntersectionObserver((es) => { playInView = es[0].isIntersecting; }, { threshold: 0.3 }).observe($('#play'));
  addEventListener('keydown', (e) => {
    if (!playInView || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (/input|textarea|select/i.test(document.activeElement.tagName)) return;
    const bol = keys[e.key.toLowerCase()];
    if (bol) { playBol(bol); e.preventDefault(); }
  });

  const thekaBtn = $('#thekaBtn'), matras = $$('.matras i');
  thekaBtn.addEventListener('click', () => {
    if (thekaBtn.getAttribute('aria-pressed') === 'true') {
      window.ksAudio.stopTheka(); thekaBtn.setAttribute('aria-pressed', 'false');
      thekaBtn.querySelector('span').textContent = 'Play teentaal'; matras.forEach((m) => m.classList.remove('on'));
      return;
    }
    thekaBtn.setAttribute('aria-pressed', 'true');
    thekaBtn.querySelector('span').textContent = 'Stop';
    window.ksAudio.playTheka((bol, i) => {
      matras.forEach((m, j) => m.classList.toggle('on', j === (i % 16)));
      if (tabla) tabla.strike(bol); else showBol(bol);
    }, () => {
      thekaBtn.setAttribute('aria-pressed', 'false');
      thekaBtn.querySelector('span').textContent = 'Play teentaal';
      setTimeout(() => matras.forEach((m) => m.classList.remove('on')), 500);
    });
  });

  /* ---------------- reveal on scroll ---------------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  $$('.reveal').forEach((el) => io.observe(el));

  /* ---------------- boot ---------------- */
  window.ksSky = { onChange: (fn) => listeners.push(fn), get t() { return t; } };
  seedStars();
  addEventListener('resize', () => { seedStars(); onScroll(); if (!starRaf) starRaf = requestAnimationFrame(drawStars); });
  addEventListener('scroll', onScroll, { passive: true });
  syncClock();
  onScroll();
  setInterval(syncClock, 60000);
})();
