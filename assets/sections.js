/* keerat.fyi — cards, sunsets, thoughts, contact */
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- mobile menu ---------- */
  const menuBtn = $('#menuBtn'), menu = $('#menu');
  const setMenu = (open) => { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

  /* ---------- cards ---------- */
  const cards = $$('.card'), pips = $$('.dex-pips i'), dexCount = $('#dexCount'), dex = $('.dex');
  const seen = new Set();
  function setFlipped(card, on, focus) {
    card.classList.toggle('flipped', on);
    const [front, back] = $$('.face', card);
    front.inert = on; back.inert = !on;
    if (on) {
      seen.add(card);
      pips.forEach((p, i) => p.classList.toggle('on', i < seen.size));
      dexCount.textContent = seen.size === cards.length ? 'Full collection ✦' : `${seen.size} / ${cards.length} flipped`;
      dex.classList.toggle('done', seen.size === cards.length);
      if (seen.size === cards.length) cards.forEach((c, i) => setTimeout(() => shine(c), i * 90));
    }
    if (focus) (on ? $('.flip-back', card) : $('.card-flip', card)).focus({ preventScroll: true });
  }
  function shine(card) {
    card.style.setProperty('--sheen', 1); card.style.setProperty('--mx', '0%'); card.style.setProperty('--my', '0%');
    setTimeout(() => card.style.setProperty('--sheen', 0), 700);
  }
  cards.forEach((card) => {
    $('.card-flip', card).addEventListener('click', (e) => setFlipped(card, true, e.detail === 0));
    $('.flip-back', card).addEventListener('click', (e) => setFlipped(card, false, e.detail === 0));
    if (fine && !reduced) {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        const flip = card.classList.contains('flipped') ? -1 : 1;
        card.style.setProperty('--ry', `${(x - 0.5) * 12 * flip}deg`);
        card.style.setProperty('--rx', `${(0.5 - y) * 10}deg`);
        card.style.setProperty('--mx', `${(flip === 1 ? x : 1 - x) * 100}%`);
        card.style.setProperty('--my', `${y * 100}%`);
        card.style.setProperty('--sheen', 1);
      });
      card.addEventListener('pointerleave', () => { ['--rx', '--ry'].forEach((p) => card.style.setProperty(p, '0deg')); card.style.setProperty('--sheen', 0); });
    }
  });

  /* filters */
  const chips = $$('.chip');
  function filter(tag) {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === tag)));
    cards.forEach((c) => c.classList.toggle('dim', tag !== 'all' && !c.dataset.tags.split(' ').includes(tag)));
  }
  chips.forEach((c) => c.addEventListener('click', () => filter(c.dataset.filter)));
  $$('.interests a[data-filter]').forEach((a) => a.addEventListener('click', () => filter(a.dataset.filter)));

  /* ---------- card art: PCA star map, helix, waveform ---------- */
  function fitCanvas(cv) {
    const dpr = Math.min(devicePixelRatio, 2), r = cv.getBoundingClientRect();
    cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w: r.width, h: r.height };
  }
  let pca = null;
  const pcaCv = $('canvas.pca');
  function drawPCA() {
    if (!pca || !pcaCv) return;
    const { g, w, h } = fitCanvas(pcaCv);
    const bg = g.createRadialGradient(w * .45, h * .45, 0, w * .5, h * .5, w * .8);
    bg.addColorStop(0, '#16193f'); bg.addColorStop(1, '#090b22');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const xs = [-6.5, 17], ys = [-8.5, 13], pad = 14;
    const X = (v) => pad + ((v - xs[0]) / (xs[1] - xs[0])) * (w - pad * 2);
    const Y = (v) => h - pad - 12 - ((v - ys[0]) / (ys[1] - ys[0])) * (h - pad * 2 - 12);
    for (const [a, b, y] of pca) {
      const benign = y === 1;
      g.fillStyle = benign ? 'rgba(160, 230, 215, .9)' : 'rgba(255, 190, 120, .95)';
      g.shadowColor = benign ? 'rgba(143, 224, 208, .9)' : 'rgba(255, 170, 100, .9)'; g.shadowBlur = 6;
      g.beginPath(); g.arc(X(a), Y(b), benign ? 1.3 : 1.5, 0, Math.PI * 2); g.fill();
    }
    g.shadowBlur = 0;
    g.font = '600 10px Manrope, sans-serif'; g.textAlign = 'left';
    g.fillStyle = 'rgba(160, 230, 215, .95)'; g.fillText('● benign', w - 74, 18);
    g.fillStyle = 'rgba(255, 190, 120, .95)'; g.fillText('● malignant', w - 74, 32);
  }
  fetch('assets/data/pca.json').then((r) => r.json()).then((d) => { pca = d; drawPCA(); }).catch(() => {});

  const animated = [];
  const helixCv = $('canvas.helix');
  if (helixCv) animated.push({ cv: helixCv, draw(g, w, h, t) {
    g.clearRect(0, 0, w, h);
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#0f1a35'); bg.addColorStop(1, '#091024');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const n = 26, amp = w * 0.22, cx = w / 2;
    for (let i = 0; i < n; i++) {
      const y = 18 + (i / (n - 1)) * (h - 36), ph = i * 0.42 + t * 0.6;
      const x1 = cx + Math.sin(ph) * amp, x2 = cx - Math.sin(ph) * amp, z = Math.cos(ph);
      g.strokeStyle = `rgba(143, 224, 208, ${0.12 + 0.18 * Math.abs(z)})`; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); g.stroke();
      [[x1, z], [x2, -z]].forEach(([x, d]) => {
        g.fillStyle = d > 0 ? 'rgba(160, 235, 220, .95)' : 'rgba(185, 166, 255, .55)';
        g.shadowColor = 'rgba(143, 224, 208, .8)'; g.shadowBlur = d > 0 ? 8 : 0;
        g.beginPath(); g.arc(x, y, d > 0 ? 3 : 2.2, 0, Math.PI * 2); g.fill();
      });
      g.shadowBlur = 0;
    }
  } });
  const waveCv = $('canvas.wave');
  if (waveCv) animated.push({ cv: waveCv, draw(g, w, h, t) {
    g.clearRect(0, 0, w, h);
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#1d1640'); bg.addColorStop(1, '#0b0b26');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const bars = Math.floor(w / 6), mid = h * 0.42;
    for (let i = 0; i < bars; i++) {
      const x = 6 + i * 6, k = i / bars;
      const env = Math.sin(k * Math.PI) * (0.55 + 0.45 * Math.sin(k * 9 + 1.3));
      const a = env * (0.35 + 0.65 * Math.abs(Math.sin(k * 23 + t * 1.6) * Math.cos(k * 7 - t)));
      const bh = Math.max(2, a * h * 0.34);
      const grd = g.createLinearGradient(0, mid - bh, 0, mid + bh);
      grd.addColorStop(0, '#d4c8ff'); grd.addColorStop(1, '#8a73ff');
      g.fillStyle = grd; g.globalAlpha = 0.85;
      g.fillRect(x, mid - bh, 3, bh * 2);
    }
    g.globalAlpha = 1;
  } });
  animated.forEach((a) => {
    a.vis = false;
    const io = new IntersectionObserver(([e]) => { a.vis = e.isIntersecting; if (a.vis) tick(); });
    io.observe(a.cv);
  });
  let raf = 0;
  function tick(now = performance.now()) {
    raf = 0; let any = false;
    animated.forEach((a) => {
      if (!a.vis) return;
      if (!a.ctx || a.cv.width !== Math.round(a.cv.getBoundingClientRect().width * Math.min(devicePixelRatio, 2))) a.ctx = fitCanvas(a.cv);
      a.draw(a.ctx.g, a.ctx.w, a.ctx.h, reduced ? 0 : now / 1000); any = true;
    });
    if (any && !reduced) raf = requestAnimationFrame(tick);
  }
  addEventListener('resize', () => { animated.forEach((a) => (a.ctx = null)); drawPCA(); if (!raf) tick(); });

  /* ---------- SoundCloud player (loads only on request) ---------- */
  const player = $('#player');
  $$('.listen-btn').forEach((b) => b.addEventListener('click', () => {
    const body = $('.player-body', player);
    if (!body.firstChild) {
      const f = document.createElement('iframe');
      f.title = 'SacSangat recordings on SoundCloud'; f.allow = 'autoplay'; f.loading = 'lazy';
      f.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(b.dataset.sc) + '&color=%23b9a6ff&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false';
      body.appendChild(f);
    }
    player.hidden = false;
    player.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
  }));
  $('.player-close').addEventListener('click', () => { player.hidden = true; });

  /* ---------- sunsets ---------- */
  const strip = $('#strip'), shots = $$('.shot'), borrow = $('.borrow');
  $$('.strip-nav button').forEach((b) => b.addEventListener('click', () => {
    strip.scrollBy({ left: +b.dataset.dir * strip.clientWidth * 0.7, behavior: reduced ? 'auto' : 'smooth' });
  }));
  shots.forEach((s) => {
    const on = () => { borrow.style.setProperty('--borrow', s.dataset.glow); borrow.classList.add('on'); };
    const off = () => borrow.classList.remove('on');
    s.addEventListener('pointerenter', on); s.addEventListener('focus', on);
    s.addEventListener('pointerleave', off); s.addEventListener('blur', off);
  });
  // drag to scroll with a mouse
  let down = false, sx = 0, sl = 0, dragged = false;
  strip.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; dragged = false; sx = e.clientX; sl = strip.scrollLeft; });
  addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 5) { dragged = true; strip.style.scrollSnapType = 'none'; } strip.scrollLeft = sl - dx; });
  addEventListener('pointerup', () => { if (!down) return; down = false; strip.style.scrollSnapType = ''; });
  strip.addEventListener('click', (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);

  const lb = $('#lightbox'), lbImg = $('#lbImg');
  let cur = 0;
  function show(i) {
    cur = (i + shots.length) % shots.length;
    const s = shots[cur], img = $('img', s);
    lbImg.src = s.dataset.full; lbImg.alt = img.alt;
    borrow.style.setProperty('--borrow', s.dataset.glow); borrow.classList.add('on');
  }
  shots.forEach((s, i) => s.addEventListener('click', () => { show(i); lb.showModal(); }));
  $('.lb-prev').addEventListener('click', () => show(cur - 1));
  $('.lb-next').addEventListener('click', () => show(cur + 1));
  $('.lb-close').addEventListener('click', () => lb.close());
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1); });
  lb.addEventListener('close', () => { borrow.classList.remove('on'); shots[cur].focus({ preventScroll: true }); });

  /* ---------- thoughts ---------- */
  // Keerat: add new thoughts here.
  const THOUGHTS = [
    'Every mistake is a data point to improve your mental model.',
    'An idiot in motion is faster than a genius at rest.',
    'CLOSED MOUTHS DON’T GET FED.',
  ];
  let ti = 0;
  const thought = $('#thought'), tCount = $('#thoughtCount'), shoot = $('#shooting');
  tCount.textContent = `1 / ${THOUGHTS.length}`;
  $('#thoughtBtn').addEventListener('click', () => {
    ti = (ti + 1) % THOUGHTS.length;
    if (!reduced) { shoot.classList.remove('go'); void shoot.offsetWidth; shoot.style.top = `${10 + Math.random() * 25}%`; shoot.style.left = `${Math.random() * 30}%`; shoot.classList.add('go'); }
    thought.classList.add('out');
    setTimeout(() => {
      $('p', thought).textContent = THOUGHTS[ti];
      tCount.textContent = `${ti + 1} / ${THOUGHTS.length}`;
      thought.classList.remove('out');
    }, reduced ? 0 : 450);
  });

  /* ---------- contact ---------- */
  const copyBtn = $('#copyEmail');
  copyBtn.addEventListener('click', async () => {
    const email = 'codingwithdaas@gmail.com';
    try { await navigator.clipboard.writeText(email); copyBtn.textContent = 'Copied'; }
    catch { const r = document.createRange(); r.selectNodeContents($('.email-link')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copyBtn.textContent = 'Selected'; }
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1800);
  });
  $('#year').textContent = new Date().getFullYear();
})();
