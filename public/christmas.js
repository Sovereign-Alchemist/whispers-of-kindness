/* ============================================================
   WHISPERS OF KINDNESS · Christmas decorations (the switch)
   Put them up and take them down here. Nothing else to touch.

   on        false takes every decoration down immediately.
   from      first day they appear.
   until     last day they appear. After this the site looks
             exactly as it did before, with no editing needed.
   giftUrl   where the gift tag points (the free turkey chart page).
             Set to '' to hide the tag but keep the decorations.

   Preview any time:  https://whispersofkindness.ca/?xmas=on
   Force off:         https://whispersofkindness.ca/?xmas=off
   ============================================================ */
(function () {
  var XMAS = {
    on: true,
    from: '2026-11-15',
    until: '2027-01-06',
    giftUrl: 'https://gifts.whispersofkindness.ca'
  };

  var q = (location.search.match(/[?&]xmas=(on|off)/) || [])[1];
  var today = new Date();
  var inSeason = today >= new Date(XMAS.from + 'T00:00:00') && today <= new Date(XMAS.until + 'T23:59:59');
  if (q === 'off' || (!XMAS.on && q !== 'on') || (!inSeason && q !== 'on')) return;

  var NS = 'http://www.w3.org/2000/svg';
  var root = document.documentElement;
  root.classList.add('xmas');

  function svg(html, cls, vb, w, h) {
    var e = document.createElementNS(NS, 'svg');
    e.setAttribute('class', cls); if (vb) e.setAttribute('viewBox', vb);
    e.setAttribute('aria-hidden', 'true'); e.setAttribute('focusable', 'false');
    if (w) e.setAttribute('preserveAspectRatio', w);
    e.innerHTML = html; return e;
  }

  /* bunting */
  var header = document.querySelector('header');
  if (header) {
    var pennants = '<defs><pattern id="xp" width="240" height="40" patternUnits="userSpaceOnUse">' +
      '<path class="s" d="M0 4 Q30 14 60 4 Q90 14 120 4 Q150 14 180 4 Q210 14 240 4"/>' +
      '<path class="t" d="M10 8 L50 8 L30 34 Z"/><path class="p" d="M70 10 L110 10 L90 36 Z"/>' +
      '<path class="g" d="M130 10 L170 10 L150 36 Z"/><path class="c" d="M190 8 L230 8 L210 34 Z"/></pattern></defs>' +
      '<rect width="100%" height="40" fill="url(#xp)"/>';
    header.appendChild(svg(pennants, 'xmas-bunting', '', ''));
  }

  /* holly in the hero corners */
  var hero = document.querySelector('.hero');
  if (hero) {
    var holly = '<path class="lf" d="M20 60 C34 36 58 30 78 40 C70 48 74 58 62 62 C64 74 44 78 20 60 Z"/>' +
      '<path class="lf2" d="M78 40 C98 30 122 38 134 56 C120 56 118 70 104 68 C100 80 82 74 78 40 Z"/>' +
      '<path class="lf" d="M24 64 C20 84 30 104 50 112 C50 98 62 96 62 84 C72 84 74 70 24 64 Z"/>' +
      '<circle class="bb" cx="70" cy="62" r="9"/><circle class="bb" cx="86" cy="68" r="9"/><circle class="bp" cx="76" cy="78" r="9"/>';
    ['l', 'r'].forEach(function (side) {
      hero.appendChild(svg(holly, 'xmas-holly ' + side, '0 0 150 120'));
    });

    /* gift tag */
    if (XMAS.giftUrl) {
      var line = hero.querySelector('.hero-line');
      var wrap = document.createElement('span');
      wrap.className = 'xmas-giftwrap reveal';
      var a = document.createElement('a');
      a.className = 'xmas-gift'; a.href = XMAS.giftUrl;
      a.innerHTML = '<b>A Christmas gift for your table</b><span>Our free turkey roasting chart, sent to your inbox. </span><em>Get the chart</em>';
      wrap.appendChild(a);
      if (line && line.parentNode) line.parentNode.insertBefore(wrap, line.nextSibling);
    }
  }

  /* snow */
  if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    var box = document.createElement('div'); box.className = 'xmas-snow'; box.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 16; i++) {
      var f = document.createElement('i'), s = 3 + Math.random() * 4;
      f.style.cssText = 'left:' + (Math.random() * 100) + '%;width:' + s + 'px;height:' + s + 'px;' +
        'animation-duration:' + (12 + Math.random() * 12) + 's;animation-delay:' + (-Math.random() * 20) + 's';
      box.appendChild(f);
    }
    document.body.appendChild(box);
  }

  /* the hero's fade-in observer may not know about the new tag */
  var late = document.querySelectorAll('.xmas-giftwrap.reveal');
  setTimeout(function () { late.forEach(function (n) { n.classList.add('in'); }); }, 400);
})();
