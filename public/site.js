(function () {
  'use strict';
  var data = JSON.parse(document.getElementById('fsa-data').textContent);
  var ui = data.ui;
  var form = document.getElementById('trial-form');
  var program = form.elements.program;
  var classSel = form.elements.classChoice;
  var classWrap = document.getElementById('class-wrap');
  var classNone = document.getElementById('class-none');
  var msg = form.querySelector('.form-msg');

  function track(name, params) { if (data.ga && window.gtag) window.gtag('event', name, params || {}); }

  // ----- program -> class options -----
  function fillClasses(selected) {
    var list = data.classes.filter(function (c) { return c.program === program.value; });
    classSel.innerHTML = '';
    if (!program.value) { classWrap.hidden = true; classNone.hidden = true; return; }
    if (!list.length) { classWrap.hidden = true; classNone.hidden = false; return; }
    classNone.hidden = true; classWrap.hidden = false;
    var any = new Option(ui.formAnyTime, '');
    classSel.add(any);
    list.forEach(function (c) { classSel.add(new Option(c.label, c.value)); });
    if (selected) classSel.value = selected;
  }
  program.addEventListener('change', function () { fillClasses(); });

  // Buttons/schedule cells that preselect a program (and class)
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-program]');
    if (!a) return;
    var p = a.getAttribute('data-program');
    if (p && [].some.call(program.options, function (o) { return o.value === p; })) {
      program.value = p;
      fillClasses(a.getAttribute('data-class') || '');
    }
    track('select_class', { program: p, class: a.getAttribute('data-class') || '' });
  });

  // ----- submit -----
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.textContent = '';
    var required = ['parentName', 'phone', 'childAge', 'program'];
    var firstBad = null;
    required.forEach(function (n) {
      var el = form.elements[n];
      var bad = !String(el.value).trim();
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (bad && !firstBad) firstBad = el;
    });
    if (firstBad) { msg.textContent = ui.formFill; firstBad.focus(); return; }

    var payload = {};
    new FormData(form).forEach(function (v, k) { payload[k] = v; });
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = ui.formSending;

    fetch('/api/trial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j; }); })
      .then(function () {
        track('generate_lead', { program: payload.program });
        form.hidden = true;
        var done = document.getElementById('trial-done');
        done.hidden = false;
        var wa = document.getElementById('done-wa');
        if (wa && data.whatsapp) {
          var progLabel = program.options[program.selectedIndex].text;
          var classLabel = classSel.selectedIndex >= 0 && classSel.value ? classSel.options[classSel.selectedIndex].text : '';
          var text = ui.waRequested + '\n' +
            ui.waParent + ': ' + payload.parentName + '\n' + ui.waChild + ': ' + (payload.childName || '') + ' (' + payload.childAge + ')\n' +
            ui.waProgram + ': ' + progLabel + (classLabel ? '\n' + ui.waClass + ': ' + classLabel : '');
          wa.href = 'https://wa.me/' + data.whatsapp + '?text=' + encodeURIComponent(text);
        }
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function (err) {
        msg.textContent = data.lang === 'en' ? err.message : ui.formError;
        btn.disabled = false; btn.textContent = ui.formSubmit;
      });
  });

  // ----- video player -----
  var dlg = document.getElementById('player');
  var vid = dlg.querySelector('video');
  document.querySelectorAll('.vid-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      vid.src = b.getAttribute('data-src');
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      vid.play().catch(function () {});
      track('video_play', { src: vid.src });
    });
  });
  function closePlayer() { vid.pause(); vid.removeAttribute('src'); vid.load(); if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  dlg.querySelector('.close').addEventListener('click', closePlayer);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closePlayer(); });
  dlg.addEventListener('close', function () { vid.pause(); });

  // ----- hide floating CTA when the form is on screen -----
  var fab = document.querySelector('.fab');
  if (fab && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      fab.style.visibility = entries[0].isIntersecting ? 'hidden' : 'visible';
    }).observe(document.getElementById('trial'));
  }
})();
