(function () {
  'use strict';

  // ---------- helpers ----------
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === 'text') el.textContent = v;
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v);
    });
    [].concat(kids || []).forEach(function (c) { if (c != null && c !== false) el.append(c.nodeType ? c : String(c)); });
    return el;
  }
  function api(method, url, body) {
    return fetch(url, { method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { showLogin(); throw new Error('Please log in again'); }
        return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Request failed'); return j; });
      });
  }
  var toastTimer;
  function toast(text, bad) {
    var t = document.getElementById('toast');
    t.textContent = text; t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = 'toast'; }, 2600);
  }
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  // ---------- login ----------
  function showLogin() { document.getElementById('app').hidden = true; document.getElementById('login').hidden = false; }
  function showApp() { document.getElementById('login').hidden = true; document.getElementById('app').hidden = false; loadTrials(); loadContent(); }
  document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = e.target.querySelector('.err'); err.textContent = '';
    api('POST', '/api/admin/login', { password: e.target.password.value })
      .then(function () { e.target.reset(); showApp(); })
      .catch(function (x) { err.textContent = x.message; });
  });
  document.getElementById('logout').addEventListener('click', function () { api('POST', '/api/admin/logout').then(showLogin); });

  // ---------- tabs ----------
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      document.getElementById('tab-trials').hidden = b.dataset.tab !== 'trials';
      document.getElementById('tab-content').hidden = b.dataset.tab !== 'content';
    });
  });

  // ---------- trial requests ----------
  var STATUSES = [['new', 'New'], ['contacted', 'Contacted'], ['scheduled', 'Trial scheduled'], ['enrolled', 'Enrolled'], ['not-interested', 'Not interested']];
  var trials = [];
  function loadTrials() { api('GET', '/api/admin/trials').then(function (t) { trials = t; renderTrials(); }).catch(function (e) { toast(e.message, true); }); }
  document.getElementById('status-filter').addEventListener('change', renderTrials);

  function renderTrials() {
    var box = document.getElementById('trials');
    var f = document.getElementById('status-filter').value;
    var list = trials.filter(function (t) { return !f || t.status === f; });
    var newCount = trials.filter(function (t) { return t.status === 'new'; }).length;
    var pill = document.getElementById('new-count'); pill.hidden = !newCount; pill.textContent = newCount;
    box.replaceChildren();
    if (!list.length) { box.append(h('div', { className: 'empty', text: trials.length ? 'No requests with this status.' : 'No trial requests yet. They will appear here when parents submit the form.' })); return; }
    list.forEach(function (t) {
      var digits = (t.phone || '').replace(/\D/g, '');
      var waNum = digits.length === 10 ? '1' + digits : digits;
      var date = new Date(t.createdAt);
      var statusSel = h('select', { 'aria-label': 'Status', on: { change: function () { patch(t, { status: statusSel.value }); } } },
        STATUSES.map(function (s) { return h('option', { value: s[0], text: s[1], selected: t.status === s[0] }); }));
      var notes = h('textarea', { placeholder: 'Your notes (saved automatically)', value: t.adminNotes || '', on: { change: function () { patch(t, { adminNotes: notes.value }); } } });
      box.append(h('article', { className: 'trial' + (t.status === 'new' ? ' is-new' : '') }, [
        h('div', {}, [
          h('h3', { text: (t.childName || 'Child') + ', ' + t.childAge + ' yrs' }),
          h('div', { className: 'cls', text: t.program }),
          h('div', { text: t.classChoice || 'Any time — needs help choosing' }),
          h('div', { className: 'meta', text: 'Received ' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })
        ]),
        h('div', {}, [
          h('div', { text: t.parentName }),
          h('div', { className: 'contact' }, [
            h('a', { href: 'tel:' + t.phone, text: t.phone }),
            waNum ? h('a', { href: 'https://wa.me/' + waNum, target: '_blank', rel: 'noopener', text: 'WhatsApp' }) : null,
            t.email ? h('a', { href: 'mailto:' + t.email, text: t.email }) : null
          ]),
          t.notes ? h('div', { className: 'notes-from', text: '“' + t.notes + '”' }) : null
        ]),
        h('div', { className: 'trial-side' }, [
          statusSel, notes,
          h('button', { type: 'button', className: 'btn btn-ghost btn-sm', text: 'Delete', on: { click: function () {
            if (!confirm('Delete this request permanently?')) return;
            api('DELETE', '/api/admin/trials/' + t.id).then(function () { trials = trials.filter(function (x) { return x !== t; }); renderTrials(); toast('Deleted'); });
          } } })
        ])
      ]));
    });
  }
  function patch(t, body) {
    api('PATCH', '/api/admin/trials/' + t.id, body).then(function (u) { Object.assign(t, u); renderTrials(); toast('Saved'); }).catch(function (e) { toast(e.message, true); });
  }

  // ---------- content editor ----------
  var SECTIONS = {
    settings: ['Site settings', 'Contact numbers, links, Google Analytics and the background video at the top.'],
    hero: ['Top banner', 'The first thing parents see.'],
    mission: ['Mission', 'The red band with the quote.'],
    programs: ['Programs', 'The two age groups and their classes.'],
    gallery: ['Videos', 'Class videos. Upload vertical phone videos (MP4) and a cover image for each.'],
    schedule: ['Schedule', 'Each class shows in the schedule table AND in the trial form, so parents can pick it.'],
    pricing: ['Pricing', ''],
    about: ['About / Coach', 'Leave an empty line between paragraphs in the bio.'],
    testimonials: ['Testimonials', 'Parent quotes.'],
    faq: ['FAQ', ''],
    location: ['Location', ''],
    trial: ['Trial form', '"Extra programs" appear in the form even if they are not on the schedule (e.g. camps).'],
    footer: ['Footer', '']
  };
  var LABELS = {
    siteTitle: 'Browser tab / Google title', metaDescription: 'Google description', siteUrl: 'Website address (https://…)', googleAnalyticsId: 'Google Analytics ID (G-XXXXXXX)',
    whatsappNumber: 'WhatsApp number (with country code, e.g. 12105551234)', instagramUrl: 'Instagram link', contactEmail: 'Contact email',
    heroVideo: 'Background video', heroPoster: 'Background video cover image', quoteSpanish: 'Quote (Spanish)', ages: 'Age range',
    tag: 'Small tag (optional)', src: 'Video file', poster: 'Cover image', group: 'Group (A, B…) optional', start: 'Starts', end: 'Ends',
    featured: 'Highlight this plan', extraPrograms: 'Extra programs (form only)', mapsQuery: 'Google Maps search text',
    successTitle: 'Message after sending (title)', successText: 'Message after sending (text)', button: 'Button text',
    primaryButton: 'Main button text', secondaryButton: 'Second button text', bio: 'Bio', question: 'Question', answer: 'Answer'
  };
  var LONG = /^(text|bio|quote|quoteSpanish|answer|subtitle|intro|metaDescription|note|successText|title)$/;
  var MEDIA = /^(src|poster|photo|heroVideo|heroPoster)$/;
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  var saved = null, draft = null;
  function label(k) { return LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); }); }
  function setDirty() { document.getElementById('savebar').hidden = JSON.stringify(draft) === JSON.stringify(saved); }

  function loadContent() {
    api('GET', '/api/admin/content').then(function (c) { saved = c; draft = clone(c); renderEditor(); }).catch(function (e) { toast(e.message, true); });
  }
  document.getElementById('discard').addEventListener('click', function () { draft = clone(saved); renderEditor(); setDirty(); });
  document.getElementById('save').addEventListener('click', function () {
    api('PUT', '/api/admin/content', draft).then(function () { saved = clone(draft); setDirty(); toast('Saved — the website is updated'); }).catch(function (e) { toast(e.message, true); });
  });
  window.addEventListener('beforeunload', function (e) { if (draft && JSON.stringify(draft) !== JSON.stringify(saved)) { e.preventDefault(); e.returnValue = ''; } });

  function renderEditor() {
    var ed = document.getElementById('editor'), nav = document.getElementById('section-nav');
    ed.replaceChildren(); nav.replaceChildren();
    Object.keys(draft).forEach(function (key) {
      var meta = SECTIONS[key] || [label(key), ''];
      nav.append(h('a', { href: '#sec-' + key, text: meta[0] }));
      ed.append(h('section', { className: 'sec', id: 'sec-' + key }, [
        h('h3', { text: meta[0] }), meta[1] ? h('p', { className: 'hint', text: meta[1] }) : null,
        objectFields(draft[key])
      ]));
    });
  }

  function objectFields(obj) {
    var box = h('div', { className: 'fields' });
    Object.keys(obj).forEach(function (k) { box.append(field(obj, k)); });
    return box;
  }

  function field(obj, k) {
    var v = obj[k];
    function set(val) { obj[k] = val; setDirty(); }
    if (Array.isArray(v)) return h('div', { className: 'wide' }, [listEditor(obj, k)]);
    if (v && typeof v === 'object') return h('div', { className: 'wide' }, [objectFields(v)]);
    if (typeof v === 'boolean') return h('label', { className: 'check' }, [h('input', { type: 'checkbox', checked: v, on: { change: function (e) { set(e.target.checked); } } }), label(k)]);
    if (MEDIA.test(k)) return h('div', { className: 'wide' }, [mediaField(label(k), v, set)]);
    if (k === 'day') return h('label', {}, [label(k), h('select', { on: { change: function (e) { set(e.target.value); } } }, DAYS.map(function (d) { return h('option', { text: d, selected: d === v }); }))]);
    if (k === 'start' || k === 'end') return h('label', {}, [label(k), h('input', { type: 'time', value: v || '', on: { input: function (e) { set(e.target.value); } } })]);
    if (LONG.test(k) && (String(v).length > 60 || k === 'bio' || k === 'text' || k === 'answer')) {
      return h('label', { className: 'wide' }, [label(k), h('textarea', { value: v || '', rows: k === 'bio' ? 7 : 3, on: { input: function (e) { set(e.target.value); } } })]);
    }
    return h('label', {}, [label(k), h('input', { type: 'text', value: v == null ? '' : v, on: { input: function (e) { set(typeof v === 'number' ? Number(e.target.value) : e.target.value); } } })]);
  }

  function mediaField(lab, value, set) {
    var thumb = h('div', { className: 'thumb' });
    var input = h('input', { type: 'text', value: value || '', 'aria-label': lab, on: { input: function () { set(input.value); paint(); } } });
    function paint() {
      thumb.replaceChildren();
      if (!input.value) return;
      thumb.append(/\.(mp4|webm|mov)$/i.test(input.value) ? h('video', { src: input.value, muted: true, preload: 'metadata' }) : h('img', { src: input.value, alt: '' }));
    }
    var file = h('input', { type: 'file', accept: 'image/*,video/mp4,video/webm,video/quicktime', on: { change: function () {
      var f = file.files[0]; if (!f) return;
      var fd = new FormData(); fd.append('file', f);
      upBtn.firstChild.textContent = 'Uploading…';
      fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'same-origin' })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Upload failed'); return j; }); })
        .then(function (j) { input.value = j.url; set(j.url); paint(); toast('Uploaded — remember to Save'); })
        .catch(function (e) { toast(e.message, true); })
        .finally(function () { upBtn.firstChild.textContent = 'Upload'; file.value = ''; });
    } } });
    var upBtn = h('span', { className: 'btn btn-ghost btn-sm up' }, ['Upload', file]);
    paint();
    return h('label', {}, [lab, h('div', { className: 'media' }, [thumb, input, upBtn])]);
  }

  function blankLike(x) {
    if (Array.isArray(x)) return [];
    if (x && typeof x === 'object') { var o = {}; Object.keys(x).forEach(function (k) { o[k] = blankLike(x[k]); }); return o; }
    if (typeof x === 'boolean') return false;
    if (typeof x === 'number') return 0;
    return '';
  }
  function itemTitle(it) {
    if (it.day) return it.day + ' ' + (it.start || '') + ' · ' + (it.program || '') + (it.group ? ' ' + it.group : '');
    var keys = ['name', 'title', 'label', 'question', 'caption', 'headline', 'quote', 'value', 'ages'];
    for (var i = 0; i < keys.length; i++) if (it[keys[i]]) return String(it[keys[i]]);
    return '(empty)';
  }

  function listEditor(obj, k) {
    var arr = obj[k];
    var wrap = h('div', { className: 'list' });
    var template = arr.length ? blankLike(arr[0]) : '';
    var isObj = arr.length ? typeof arr[0] === 'object' : false;
    function redraw(openIndex) {
      wrap.replaceChildren();
      wrap.append(h('div', { className: 'list-head' }, [h('span', { text: label(k) + ' (' + arr.length + ')' }),
        h('button', { type: 'button', className: 'btn btn-ghost btn-sm', text: '+ Add', on: { click: function () { arr.push(clone(template)); setDirty(); redraw(arr.length - 1); } } })]));
      arr.forEach(function (it, i) {
        var tools = [
          h('button', { type: 'button', className: 'icon-btn', title: 'Move up', 'aria-label': 'Move up', text: '↑', disabled: i === 0, on: { click: function (e) { e.preventDefault(); arr.splice(i - 1, 0, arr.splice(i, 1)[0]); setDirty(); redraw(); } } }),
          h('button', { type: 'button', className: 'icon-btn', title: 'Move down', 'aria-label': 'Move down', text: '↓', disabled: i === arr.length - 1, on: { click: function (e) { e.preventDefault(); arr.splice(i + 1, 0, arr.splice(i, 1)[0]); setDirty(); redraw(); } } }),
          h('button', { type: 'button', className: 'icon-btn danger', title: 'Remove', 'aria-label': 'Remove', text: '×', on: { click: function (e) { e.preventDefault(); if (!confirm('Remove this item?')) return; arr.splice(i, 1); setDirty(); redraw(); } } })
        ];
        if (isObj) {
          var t = h('span', { className: 't', text: itemTitle(it) });
          var body = h('div', { className: 'item-body' }, [objectFields(it)]);
          body.addEventListener('input', function () { t.textContent = itemTitle(it); });
          body.addEventListener('change', function () { t.textContent = itemTitle(it); });
          wrap.append(h('details', { className: 'item', open: i === openIndex }, [h('summary', {}, [t].concat(tools)), body]));
        } else {
          wrap.append(h('div', { className: 'str-row' }, [h('input', { type: 'text', value: it, 'aria-label': label(k) + ' ' + (i + 1), on: { input: function (e) { arr[i] = e.target.value; setDirty(); } } })].concat(tools)));
        }
      });
    }
    redraw();
    return wrap;
  }

  // ---------- boot ----------
  fetch('/api/admin/me', { credentials: 'same-origin' }).then(function (r) { r.ok ? showApp() : showLogin(); }).catch(showLogin);
})();
