'use strict';

const LANGS = ['en', 'es'];
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ES = { Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miércoles', Thursday: 'Jueves', Friday: 'Viernes', Saturday: 'Sábado', Sunday: 'Domingo' };
const PATH = { en: '/', es: '/es' };

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Only allow same-site paths or http(s) URLs in src/href attributes.
function safeUrl(u) {
  const s = String(u ?? '').trim();
  return /^(\/(?!\/)|https?:\/\/)/i.test(s) ? esc(s) : '';
}
function paragraphs(text) {
  return String(text ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}
function fmtTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
  if (!m) return esc(t);
  let h = +m[1]; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}
const dayName = (d, lang) => (lang === 'es' ? DAY_ES[d] || d : d);
const progName = (x, lang) => (lang === 'es' && x.programEs ? x.programEs : x.program);
// Canonical (English) label — what gets stored with a trial request.
function classLabel(c) {
  return `${c.day} · ${fmtTime(c.start)}–${fmtTime(c.end)}${c.group ? ` (Group ${c.group})` : ''}`;
}
function classLabelLocal(c, lang, ui) {
  return `${dayName(c.day, lang)} · ${fmtTime(c.start)}–${fmtTime(c.end)}${c.group ? ` (${ui.group || 'Group'} ${c.group})` : ''}`;
}
const arr = v => (Array.isArray(v) ? v : []);
const waLink = (num, text) => {
  const n = String(num || '').replace(/\D/g, '');
  return n ? `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}` : '';
};

function renderPage(content, lang = 'en') {
  if (!LANGS.includes(lang)) lang = 'en';
  const s = content.settings || {};
  const c = content[lang] || content.en || {};
  const ui = Object.assign({}, content.en?.ui, c.ui);
  const other = lang === 'en' ? 'es' : 'en';
  const base = String(s.siteUrl || '').replace(/\/$/, '');

  const classes = arr(content.schedule?.classes).filter(x => x && x.day && x.start && x.program);
  const extras = arr(content.schedule?.extraPrograms).filter(x => x && x.program);
  const days = DAY_ORDER.filter(d => classes.some(x => x.day === d));
  const times = [...new Set(classes.map(x => x.start))].sort();
  const programs = [];
  [...classes, ...extras].forEach(x => { if (!programs.some(p => p.program === x.program)) programs.push(x); });

  const wa = waLink(s.whatsappNumber, ui.waHello);
  const mapsQ = encodeURIComponent(c.location?.mapsQuery || '');
  const clientData = {
    lang,
    ui: { formAnyTime: ui.formAnyTime, formSending: ui.formSending, formSubmit: ui.formSubmit, formFill: ui.formFill, formError: ui.formError,
      waRequested: ui.waRequested, waParent: ui.waParent, waChild: ui.waChild, waProgram: ui.waProgram, waClass: ui.waClass },
    classes: classes.map(x => ({ program: x.program, value: classLabel(x), label: classLabelLocal(x, lang, ui) })),
    whatsapp: String(s.whatsappNumber || '').replace(/\D/g, ''),
    ga: !!s.googleAnalyticsId
  };

  const btn = (label, cls = 'btn') => `<a href="#trial" class="${cls}">${esc(label)}</a>`;
  const head = (eyebrow, title) => `${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h2 class="h2">${esc(title)}</h2>`;
  const slot = x => `<a href="#trial" class="slot" data-program="${esc(x.program)}" data-class="${esc(classLabel(x))}"><b>${esc(progName(x, lang))}${x.group ? ' ' + esc(x.group) : ''}</b><span>${fmtTime(x.start)}–${fmtTime(x.end)}</span></a>`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: 'Flight Sports Academy',
    description: c.seo?.description,
    url: base + PATH[lang],
    image: base + '/img/og.jpg',
    address: { '@type': 'PostalAddress', streetAddress: c.location?.address, addressLocality: 'San Antonio', addressRegion: 'TX', addressCountry: 'US' }
  };
  const gaId = s.googleAnalyticsId && /^[A-Z0-9-]+$/i.test(s.googleAnalyticsId) ? s.googleAnalyticsId : '';

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.seo?.title)}</title>
<meta name="description" content="${esc(c.seo?.description)}">
<link rel="canonical" href="${esc(base + PATH[lang])}">
<link rel="alternate" hreflang="en" href="${esc(base + '/')}">
<link rel="alternate" hreflang="es" href="${esc(base + '/es')}">
<link rel="alternate" hreflang="x-default" href="${esc(base + '/')}">
<meta property="og:type" content="website">
<meta property="og:locale" content="${lang === 'es' ? 'es_MX' : 'en_US'}">
<meta property="og:title" content="${esc(c.seo?.title)}">
<meta property="og:description" content="${esc(c.seo?.description)}">
<meta property="og:image" content="${esc(base)}/img/og.jpg">
<meta name="theme-color" content="#0A0A0A">
<link rel="icon" href="/img/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
${gaId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(gaId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(gaId)}');</script>` : ''}
</head>
<body>
<a class="skip" href="#main">${esc(ui.skip)}</a>
<header class="topbar">
  <div class="wrap topbar-in">
    <a href="#top" class="brand"><img src="/img/shield.jpg" alt="" width="40" height="48"><span>FLIGHT <em>SPORTS ACADEMY</em></span></a>
    <nav aria-label="Main" class="nav">
      <a href="#programs">${esc(ui.navPrograms)}</a><a href="#videos">${esc(ui.navVideos)}</a><a href="#schedule">${esc(ui.navSchedule)}</a><a href="#pricing">${esc(ui.navPricing)}</a><a href="#about">${esc(ui.navAbout)}</a><a href="#location">${esc(ui.navLocation)}</a>
    </nav>
    <div class="row top-actions">
      <a href="${PATH[other]}" class="lang" hreflang="${other}" lang="${other}">${esc(ui.languageSwitch)}</a>
      ${btn(ui.bookTrial, 'btn btn-sm')}
    </div>
  </div>
</header>

<main id="main">
<section id="top" class="hero">
  ${s.heroVideo ? `<video class="hero-bg" autoplay muted loop playsinline preload="metadata" poster="${safeUrl(s.heroPoster)}" aria-hidden="true"><source src="${safeUrl(s.heroVideo)}" type="video/mp4"></video>` : ''}
  <div class="hero-shade"></div>
  <div class="wrap hero-in">
    <div class="hero-copy">
      <p class="eyebrow">${esc(c.hero?.eyebrow)}</p>
      <h1 class="h1">${esc(c.hero?.title)}</h1>
      <p class="lead">${esc(c.hero?.subtitle)}</p>
      <div class="row">${btn(c.hero?.primaryButton, 'btn btn-lg')}<a href="#programs" class="btn btn-ghost btn-lg">${esc(c.hero?.secondaryButton)}</a></div>
      <div class="stats">${arr(c.hero?.stats).map(x => `<div><strong>${esc(x.value)}</strong><span>${esc(x.label)}</span></div>`).join('')}</div>
    </div>
    <img class="hero-logo" src="/img/logo-dragon.jpg" alt="Flight Sports Academy" width="900" height="810">
  </div>
</section>

<section class="mission">
  <div class="wrap mission-in">
    <div>
      ${c.mission?.eyebrow ? `<p class="mission-eyebrow">${esc(c.mission.eyebrow)}</p>` : ''}
      <p class="statement">${esc(c.mission?.statement)}</p>
      ${c.mission?.quote ? `<p class="quote-small">“${esc(c.mission.quote)}”</p>` : ''}
    </div>
    <ul class="pillars">${arr(c.mission?.pillars).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
  </div>
</section>

<section id="programs" class="wrap section">
  ${head(c.programs?.eyebrow, c.programs?.title)}
  <div class="tracks">
    ${arr(c.programs?.tracks).map((t, i) => `
    <article class="card track ${i % 2 ? 'track-alt' : ''}">
      <div><div class="ages">${esc(t.ages)}</div><div class="muted caps">${esc(t.agesLabel)}</div></div>
      <h3>${esc(t.headline)}</h3>
      <p class="soft">${esc(t.text)}</p>
      <ul class="items">${arr(t.items).map(it => `<li><b>${esc(it.name)}</b>${it.tag ? ` <span class="muted">· ${esc(it.tag)}</span>` : ''}<span>${esc(it.text)}</span></li>`).join('')}</ul>
      <a href="#trial" class="btn ${i % 2 ? 'btn-ghost' : ''} mt-auto">${esc(t.button)}</a>
    </article>`).join('')}
  </div>
</section>

${arr(content.videos).length ? `
<section id="videos" class="band">
  <div class="wrap section">
    ${head(c.gallery?.eyebrow, c.gallery?.title)}
    <div class="videos">
      ${arr(content.videos).map(v => {
        const cap = lang === 'es' && v.captionEs ? v.captionEs : v.caption;
        return `
      <figure class="vid">
        <button type="button" class="vid-btn" data-src="${safeUrl(v.src)}" aria-label="${esc(ui.playVideo)}: ${esc(cap)}">
          <img src="${safeUrl(v.poster)}" alt="" loading="lazy">
          <span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>
        </button>
        ${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}
      </figure>`;
      }).join('')}
    </div>
    <div class="center">${btn(ui.videoCta, 'btn btn-lg')}</div>
  </div>
</section>` : ''}

<section id="schedule" class="wrap section">
  <div class="split-head">
    <div>${head(c.schedule?.eyebrow, c.schedule?.title)}</div>
    ${btn(ui.scheduleCta)}
  </div>
  <div class="table-box">
    <table class="sched">
      <thead><tr><th scope="col">${esc(ui.scheduleTime)}</th>${days.map(d => `<th scope="col">${esc(dayName(d, lang))}</th>`).join('')}</tr></thead>
      <tbody>${times.map(t => `<tr><th scope="row">${fmtTime(t)}</th>${days.map(d => {
        const here = classes.filter(x => x.day === d && x.start === t);
        return `<td>${here.length ? here.map(slot).join('') : '<span class="dash">—</span>'}</td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>
  <div class="sched-mobile">
    ${days.map(d => `<div class="day"><h3>${esc(dayName(d, lang))}</h3>${classes.filter(x => x.day === d).sort((a, b) => a.start.localeCompare(b.start)).map(slot).join('')}</div>`).join('')}
  </div>
  <p class="muted small">${esc(c.schedule?.note)} ${esc(ui.scheduleTap)}</p>
</section>

<section id="pricing" class="band">
  <div class="wrap section">
    ${head(c.pricing?.eyebrow, c.pricing?.title)}
    <p class="soft intro">${esc(c.pricing?.intro)}</p>
    <div class="grid3">${arr(c.pricing?.plans).map(p => `<div class="card plan${p.featured ? ' featured' : ''}"><div class="caps ${p.featured ? 'red' : 'muted'}">${esc(p.label)}</div><div class="price">${esc(p.price)}<small>${esc(p.period)}</small></div></div>`).join('')}</div>
    <div class="grid3 extras">${arr(c.pricing?.extras).map(e => `<div class="extra"><b>${esc(e.title)}</b><span>${esc(e.text)}</span></div>`).join('')}</div>
    ${c.pricing?.note ? `<p class="muted small">${esc(c.pricing.note)}</p>` : ''}
    ${btn(ui.pricingCta, 'btn btn-lg')}
  </div>
</section>

<section id="about" class="wrap section about">
  <div class="about-side">
    <div class="about-photo">${s.coachPhoto ? `<img src="${safeUrl(s.coachPhoto)}" alt="${esc(c.about?.title)}" loading="lazy">` : ''}</div>
    <div class="highlights">${arr(c.about?.highlights).map(x => `<div><strong>${esc(x.value)}</strong><span>${esc(x.label)}</span></div>`).join('')}</div>
  </div>
  <div class="about-copy">
    ${head(c.about?.eyebrow, c.about?.title)}
    <div class="soft prose">${paragraphs(c.about?.bio)}</div>
    ${c.about?.partners ? `<p class="partners">${esc(c.about.partners)}</p>` : ''}
    <div class="principles">${arr(c.about?.principles).map(p => `<div><b>${esc(p.title)}</b><span>${esc(p.text)}</span></div>`).join('')}</div>
    ${btn(ui.aboutCta)}
  </div>
</section>

${arr(c.testimonials?.items).length ? `
<section class="band">
  <div class="wrap section">
    ${head(c.testimonials?.eyebrow, c.testimonials?.title)}
    <div class="grid3">${arr(c.testimonials.items).map(t => `<figure class="card quote-card"><blockquote>“${esc(t.quote)}”</blockquote><figcaption><b>${esc(t.name)}</b> · ${esc(t.detail)}</figcaption></figure>`).join('')}</div>
  </div>
</section>` : ''}

${arr(c.faq?.items).length ? `
<section class="wrap section faq">
  <h2 class="h2">${esc(c.faq?.title)}</h2>
  ${arr(c.faq.items).map(f => `<details><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('')}
</section>` : ''}

<section id="location" class="band">
  <div class="wrap section loc">
    <div class="loc-copy">
      ${head(c.location?.eyebrow, c.location?.title)}
      <address><strong>${esc(c.location?.venue)}</strong><br>${esc(c.location?.address)}<br>${esc(c.location?.city)}</address>
      <p class="muted">${esc(c.location?.hours)}</p>
      <div class="row"><a href="https://www.google.com/maps/search/?api=1&amp;query=${mapsQ}" class="btn btn-ghost" target="_blank" rel="noopener">${esc(ui.getDirections)}</a>${btn(ui.bookTrial)}</div>
    </div>
    <iframe class="map" title="${esc(c.location?.venue)}" src="https://www.google.com/maps?output=embed&amp;hl=${lang}&amp;q=${mapsQ}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  </div>
</section>

<section id="trial" class="wrap section trial">
  <div class="trial-copy">
    <p class="eyebrow">${esc(c.trial?.eyebrow)}</p>
    <h2 class="h2 big">${esc(c.trial?.title)}</h2>
    <p class="lead">${esc(c.trial?.text)}</p>
    ${wa ? `<a href="${esc(wa)}" class="btn btn-light" target="_blank" rel="noopener"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.4L3 20.5l1.6-5.3A8.4 8.4 0 1 1 21 11.5z"/></svg>${esc(ui.whatsappButton)}</a>` : ''}
  </div>
  <form id="trial-form" class="card form" novalidate>
    <input type="hidden" name="lang" value="${lang}">
    <div class="form-grid">
      <label>${esc(ui.formParent)}<input name="parentName" autocomplete="name" required></label>
      <label>${esc(ui.formPhone)}<input name="phone" type="tel" autocomplete="tel" required></label>
      <label><span>${esc(ui.formEmail)} <span class="muted">${esc(ui.optional)}</span></span><input name="email" type="email" autocomplete="email"></label>
      <label>${esc(ui.formChild)}<input name="childName"></label>
      <label>${esc(ui.formAge)}<input name="childAge" type="number" min="1" max="17" inputmode="numeric" required></label>
      <label>${esc(ui.formProgram)}<select name="program" required><option value="">${esc(ui.formChooseProgram)}</option>${programs.map(p => `<option value="${esc(p.program)}">${esc(progName(p, lang))}</option>`).join('')}</select></label>
    </div>
    <label id="class-wrap" hidden>${esc(ui.formClass)}<select name="classChoice"></select></label>
    <p id="class-none" class="muted small" hidden>${esc(ui.formNoClasses)}</p>
    <label><span>${esc(ui.formNotes)} <span class="muted">${esc(ui.optional)}</span></span><textarea name="notes" rows="3"></textarea></label>
    <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
    <button type="submit" class="btn btn-lg btn-block">${esc(ui.formSubmit)}</button>
    <p class="form-msg" role="status" aria-live="polite"></p>
  </form>
  <div id="trial-done" class="card done" hidden>
    <h3>${esc(c.trial?.successTitle)}</h3>
    <p class="soft">${esc(c.trial?.successText)}</p>
    ${clientData.whatsapp ? `<a id="done-wa" class="btn btn-light" target="_blank" rel="noopener" href="#">${esc(ui.sendWhatsapp)}</a>` : ''}
  </div>
</section>
</main>

<footer class="footer">
  <div class="wrap footer-in">
    <div class="row"><img src="/img/shield.jpg" alt="" width="32" height="40"><span class="muted small">${esc(c.footer?.text)}</span></div>
    <div class="row small">
      <a href="${PATH[other]}" hreflang="${other}" lang="${other}">${esc(ui.languageSwitch)}</a>
      ${s.instagramUrl ? `<a href="${safeUrl(s.instagramUrl)}" target="_blank" rel="noopener">Instagram</a>` : ''}
      ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      ${s.contactEmail ? `<a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a>` : ''}
      <a href="#trial" class="red b">${esc(ui.bookTrial)}</a>
    </div>
  </div>
</footer>
<a href="#trial" class="fab">${esc(ui.bookTrial)}</a>

<dialog id="player" aria-label="Video"><button type="button" class="close" aria-label="${esc(ui.closeVideo)}">×</button><video controls playsinline></video></dialog>
<script id="fsa-data" type="application/json">${JSON.stringify(clientData).replace(/</g, '\\u003c')}</script>
<script src="/site.js" defer></script>
</body>
</html>`;
}

module.exports = { renderPage, LANGS };
