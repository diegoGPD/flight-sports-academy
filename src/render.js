'use strict';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
function classLabel(c) {
  return `${c.day} · ${fmtTime(c.start)}–${fmtTime(c.end)}${c.group ? ` (Group ${c.group})` : ''}`;
}
const arr = v => (Array.isArray(v) ? v : []);
const waLink = (num, text) => {
  const n = String(num || '').replace(/\D/g, '');
  return n ? `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}` : '';
};

function renderPage(c) {
  const s = c.settings || {};
  const classes = arr(c.schedule?.classes).filter(x => x && x.day && x.start);
  const days = DAY_ORDER.filter(d => classes.some(x => x.day === d));
  const times = [...new Set(classes.map(x => x.start))].sort();
  const programs = [...new Set([...classes.map(x => x.program), ...arr(c.trial?.extraPrograms)].filter(Boolean))];
  const wa = waLink(s.whatsappNumber, "Hi! I'd like to book a trial class at Flight Sports Academy.");
  const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.location?.mapsQuery || '');
  const mapsEmbed = 'https://www.google.com/maps?output=embed&q=' + encodeURIComponent(c.location?.mapsQuery || '');
  const clientData = {
    classes: classes.map(x => ({ program: x.program, label: classLabel(x) })),
    whatsapp: String(s.whatsappNumber || '').replace(/\D/g, ''),
    ga: !!s.googleAnalyticsId
  };

  const btn = (label, cls = 'btn', extra = '') => `<a href="#trial" class="${cls}"${extra}>${esc(label)}</a>`;
  const sectionHead = (eyebrow, title) => `${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h2 class="h2">${esc(title)}</h2>`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: 'Flight Sports Academy',
    description: s.metaDescription,
    url: s.siteUrl,
    image: (s.siteUrl || '').replace(/\/$/, '') + '/img/og.jpg',
    address: { '@type': 'PostalAddress', streetAddress: c.location?.address, addressLocality: 'San Antonio', addressRegion: 'TX', addressCountry: 'US' }
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.siteTitle)}</title>
<meta name="description" content="${esc(s.metaDescription)}">
<link rel="canonical" href="${safeUrl(s.siteUrl)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(s.siteTitle)}">
<meta property="og:description" content="${esc(s.metaDescription)}">
<meta property="og:image" content="${esc((s.siteUrl || '').replace(/\/$/, ''))}/img/og.jpg">
<meta name="theme-color" content="#0A0A0A">
<link rel="icon" href="/img/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
${s.googleAnalyticsId && /^[A-Z0-9-]+$/i.test(s.googleAnalyticsId) ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(s.googleAnalyticsId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(s.googleAnalyticsId)}');</script>` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <div class="wrap topbar-in">
    <a href="#top" class="brand"><img src="/img/shield.jpg" alt="" width="40" height="48"><span>FLIGHT <em>SPORTS ACADEMY</em></span></a>
    <nav aria-label="Main" class="nav">
      <a href="#programs">Programs</a><a href="#videos">Videos</a><a href="#schedule">Schedule</a><a href="#pricing">Pricing</a><a href="#about">About</a><a href="#location">Location</a>
    </nav>
    ${btn('Book a trial', 'btn btn-sm')}
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
      <div class="row">${btn(c.hero?.primaryButton || 'Book a trial class', 'btn btn-lg')}<a href="#programs" class="btn btn-ghost btn-lg">${esc(c.hero?.secondaryButton || 'See programs')}</a></div>
      <div class="stats">${arr(c.hero?.stats).map(x => `<div><strong>${esc(x.value)}</strong><span>${esc(x.label)}</span></div>`).join('')}</div>
    </div>
    <img class="hero-logo" src="/img/logo-dragon.jpg" alt="Flight Sports Academy logo" width="900" height="810">
  </div>
</section>

<section class="mission">
  <div class="wrap mission-in">
    <div>
      <p class="quote">“${esc(c.mission?.quote)}”</p>
      ${c.mission?.quoteSpanish ? `<p class="quote-es" lang="es">${esc(c.mission.quoteSpanish)}</p>` : ''}
    </div>
    <ul class="pillars">${arr(c.mission?.pillars).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
  </div>
</section>

<section id="programs" class="wrap section">
  ${sectionHead(c.programs?.eyebrow, c.programs?.title)}
  <div class="tracks">
    ${arr(c.programs?.tracks).map((t, i) => `
    <article class="card track ${i % 2 ? 'track-alt' : ''}">
      <div><div class="ages">${esc(t.ages)}</div><div class="muted caps">Years old</div></div>
      <h3>${esc(t.headline)}</h3>
      <p class="soft">${esc(t.text)}</p>
      <ul class="items">${arr(t.items).map(it => `<li><b>${esc(it.name)}</b>${it.tag ? ` <span class="muted">· ${esc(it.tag)}</span>` : ''}<span>${esc(it.text)}</span></li>`).join('')}</ul>
      <a href="#trial" class="btn ${i % 2 ? 'btn-ghost' : ''} mt-auto" data-program="${esc(arr(t.items)[0]?.name || '')}">${esc(t.button)}</a>
    </article>`).join('')}
  </div>
</section>

${arr(c.gallery?.videos).length ? `
<section id="videos" class="band">
  <div class="wrap section">
    ${sectionHead(c.gallery?.eyebrow, c.gallery?.title)}
    <div class="videos">
      ${arr(c.gallery.videos).map(v => `
      <figure class="vid">
        <button type="button" class="vid-btn" data-src="${safeUrl(v.src)}" aria-label="Play video: ${esc(v.caption)}">
          <img src="${safeUrl(v.poster)}" alt="" loading="lazy">
          <span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>
        </button>
        ${v.caption ? `<figcaption>${esc(v.caption)}</figcaption>` : ''}
      </figure>`).join('')}
    </div>
    <div class="center">${btn('Book a trial class', 'btn btn-lg')}</div>
  </div>
</section>` : ''}

<section id="schedule" class="wrap section">
  <div class="split-head">
    <div>${sectionHead(c.schedule?.eyebrow, c.schedule?.title)}</div>
    ${btn('Pick a class for your trial')}
  </div>
  <div class="table-box">
    <table class="sched">
      <thead><tr><th scope="col">Time</th>${days.map(d => `<th scope="col">${esc(d)}</th>`).join('')}</tr></thead>
      <tbody>${times.map(t => `<tr><th scope="row">${fmtTime(t)}</th>${days.map(d => {
        const here = classes.filter(x => x.day === d && x.start === t);
        return `<td>${here.length ? here.map(x => `<a href="#trial" class="slot" data-program="${esc(x.program)}" data-class="${esc(classLabel(x))}"><b>${esc(x.program)}${x.group ? ' ' + esc(x.group) : ''}</b><span>${fmtTime(x.start)}–${fmtTime(x.end)}</span></a>`).join('') : '<span class="dash">—</span>'}</td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>
  <div class="sched-mobile">
    ${days.map(d => `<div class="day"><h3>${esc(d)}</h3>${classes.filter(x => x.day === d).sort((a, b) => a.start.localeCompare(b.start)).map(x => `<a href="#trial" class="slot" data-program="${esc(x.program)}" data-class="${esc(classLabel(x))}"><b>${esc(x.program)}${x.group ? ' ' + esc(x.group) : ''}</b><span>${fmtTime(x.start)}–${fmtTime(x.end)}</span></a>`).join('')}</div>`).join('')}
  </div>
  <p class="muted small">${esc(c.schedule?.note)} Tap any class to request a trial for it.</p>
</section>

<section id="pricing" class="band">
  <div class="wrap section">
    ${sectionHead(c.pricing?.eyebrow, c.pricing?.title)}
    <p class="soft intro">${esc(c.pricing?.intro)}</p>
    <div class="grid3">${arr(c.pricing?.plans).map(p => `<div class="card plan${p.featured ? ' featured' : ''}"><div class="caps ${p.featured ? 'red' : 'muted'}">${esc(p.label)}</div><div class="price">${esc(p.price)}<small>${esc(p.period)}</small></div></div>`).join('')}</div>
    <div class="grid3 extras">${arr(c.pricing?.extras).map(e => `<div class="extra"><b>${esc(e.title)}</b><span>${esc(e.text)}</span></div>`).join('')}</div>
    ${c.pricing?.note ? `<p class="muted small">${esc(c.pricing.note)}</p>` : ''}
    ${btn('Start with a trial class', 'btn btn-lg')}
  </div>
</section>

<section id="about" class="wrap section about">
  <div class="about-photo">${c.about?.photo ? `<img src="${safeUrl(c.about.photo)}" alt="${esc(c.about?.title)}" loading="lazy">` : ''}</div>
  <div class="about-copy">
    ${sectionHead(c.about?.eyebrow, c.about?.title)}
    <div class="soft prose">${paragraphs(c.about?.bio)}</div>
    <div class="principles">${arr(c.about?.principles).map(p => `<div><b>${esc(p.title)}</b><span>${esc(p.text)}</span></div>`).join('')}</div>
    ${btn('Train with us')}
  </div>
</section>

${arr(c.testimonials?.items).length ? `
<section class="band">
  <div class="wrap section">
    ${sectionHead(c.testimonials?.eyebrow, c.testimonials?.title)}
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
      ${sectionHead(c.location?.eyebrow, c.location?.title)}
      <address><strong>${esc(c.location?.venue)}</strong><br>${esc(c.location?.address)}<br>${esc(c.location?.city)}</address>
      <p class="muted">${esc(c.location?.hours)}</p>
      <div class="row"><a href="${esc(mapsUrl)}" class="btn btn-ghost" target="_blank" rel="noopener">Get directions</a>${btn('Book a trial')}</div>
    </div>
    <iframe class="map" title="Map to ${esc(c.location?.venue)}" src="${esc(mapsEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  </div>
</section>

<section id="trial" class="wrap section trial">
  <div class="trial-copy">
    <p class="eyebrow">${esc(c.trial?.eyebrow)}</p>
    <h2 class="h2 big">${esc(c.trial?.title)}</h2>
    <p class="lead">${esc(c.trial?.text)}</p>
    ${wa ? `<a href="${esc(wa)}" class="btn btn-light" target="_blank" rel="noopener"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.4L3 20.5l1.6-5.3A8.4 8.4 0 1 1 21 11.5z"/></svg>Message us on WhatsApp</a>` : ''}
  </div>
  <form id="trial-form" class="card form" novalidate>
    <div class="form-grid">
      <label>Parent name<input name="parentName" autocomplete="name" required></label>
      <label>Phone / WhatsApp<input name="phone" type="tel" autocomplete="tel" required></label>
      <label><span>Email <span class="muted">(optional)</span></span><input name="email" type="email" autocomplete="email"></label>
      <label>Child's first name<input name="childName"></label>
      <label>Child's age<input name="childAge" type="number" min="1" max="17" inputmode="numeric" required></label>
      <label>Program<select name="program" required><option value="">Choose a program</option>${programs.map(p => `<option>${esc(p)}</option>`).join('')}</select></label>
    </div>
    <label id="class-wrap" hidden>Which class would you like to try?<select name="classChoice"></select></label>
    <p id="class-none" class="muted small" hidden>We'll contact you with available times for this program.</p>
    <label><span>Anything we should know? <span class="muted">(optional)</span></span><textarea name="notes" rows="3"></textarea></label>
    <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
    <button type="submit" class="btn btn-lg btn-block">Request my trial class</button>
    <p class="form-msg" role="status" aria-live="polite"></p>
  </form>
  <div id="trial-done" class="card done" hidden>
    <h3>${esc(c.trial?.successTitle)}</h3>
    <p class="soft">${esc(c.trial?.successText)}</p>
    ${clientData.whatsapp ? `<a id="done-wa" class="btn btn-light" target="_blank" rel="noopener" href="#">Also send it on WhatsApp</a>` : ''}
  </div>
</section>
</main>

<footer class="footer">
  <div class="wrap footer-in">
    <div class="row"><img src="/img/shield.jpg" alt="" width="32" height="40"><span class="muted small">${esc(c.footer?.text)}</span></div>
    <div class="row small">
      ${s.instagramUrl ? `<a href="${safeUrl(s.instagramUrl)}" target="_blank" rel="noopener">Instagram</a>` : ''}
      ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      ${s.contactEmail ? `<a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a>` : ''}
      <a href="#trial" class="red b">Book a trial</a>
    </div>
  </div>
</footer>
<a href="#trial" class="fab">Book a trial</a>

<dialog id="player" aria-label="Class video"><button type="button" class="close" aria-label="Close video">×</button><video controls playsinline></video></dialog>
<script id="fsa-data" type="application/json">${JSON.stringify(clientData).replace(/</g, '\\u003c')}</script>
<script src="/site.js" defer></script>
</body>
</html>`;
}

module.exports = { renderPage, fmtTime, classLabel };
