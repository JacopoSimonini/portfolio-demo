// Retro Desktop: the portfolio "apps".
// Every app reads its content from the minimal view's DOM (index.html stays the
// single source of truth) and opens one window through the window manager.
(function () {
  'use strict';
  const Retro = (window.Retro = window.Retro || {});
  const esc = (v) => Retro.esc(v);
  const ICON = (name) => `retro/assets/icons/${name}.svg`;
  /** Featured projects get a folder with a red star. */
  const projectIcon = (p) => ICON(p.featured ? 'folder-star' : 'folder');

  // ---------------------------------------------------------------------------
  // Data, read from index.html
  // ---------------------------------------------------------------------------
  function readData() {
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => [...document.querySelectorAll(s)];
    const cv = $('#download-btn');
    return {
      name: $('#classic-view h1')?.textContent.trim() || '',
      avatar: $('.profile-pic')?.getAttribute('src') || '',
      about: ($('#about-data')?.textContent || '')
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean),
      phrases: window.Portfolio?.phrases || [],
      languages: $$('#languages-data li').map((li) => {
        const strong = li.querySelector('strong');
        const name = (strong?.textContent || '').replace(/:\s*$/, '').trim();
        return { name, level: li.textContent.replace(strong?.textContent || '', '').trim() };
      }),
      education: $$('#education-data li').map((li) => {
        const [title = '', level = '', school = '', ...rest] = li.textContent.split(/\s+-\s+/).map((t) => t.trim());
        return { title, level, school, when: rest.join(' - ') };
      }),
      skills: $$('#skills-data .skill-tag1').map((s) => s.textContent.trim()),
      // Featured first, as script.js collects them: { title, desc, link, featured, tags }
      projects: window.Portfolio?.projects || [],
      contacts: $$('#contact-data a.contact-link').map((a) => ({ label: a.dataset.label || a.textContent.trim(), href: a.getAttribute('href') })),
      email: $('#email-text')?.textContent.trim() || '',
      cv: { href: cv?.getAttribute('href') || 'cv.pdf', file: cv?.getAttribute('download') || 'resume.pdf' },
    };
  }

  // ---------------------------------------------------------------------------
  // Window geometry (Retro Desktop formulas; o = cascade offset)
  // ---------------------------------------------------------------------------
  const min = Math.min;
  const max = Math.max;
  const listRect = (d, o) => ({ x: 48 + o, y: 28 + o, w: min(620, max(280, d.w - 70)), h: min(520, max(280, d.h - 70)) });
  const explorerRect = (d, o) => ({ x: 48 + o, y: 28 + o, w: min(640, max(300, d.w - 70)), h: min(460, max(300, d.h - 70)) });
  const detailRect = (d, o) => ({ x: 76 + o, y: 42 + o, w: min(680, max(280, d.w - 70)), h: min(560, max(300, d.h - 70)) });
  const docRect = (d, o) => ({ x: 52 + o, y: max(6, 24 + o), w: min(720, max(320, d.w - 120)), h: min(620, max(320, d.h - 80)) });
  const smallRect = (d, o) => ({ x: 96 + o, y: 60 + o, w: min(520, max(300, d.w - 70)), h: min(360, max(300, d.h - 70)) });
  function centerRect(d, w, h) {
    const width = min(w, max(300, d.w - 60));
    const height = min(h, max(320, d.h - 60));
    return { x: max(6, Math.round((d.w - width) / 2)), y: max(6, Math.round((d.h - height) / 2 - 12)), w: width, h: height };
  }

  function downloadCv(data) {
    const a = document.createElement('a');
    a.href = data.cv.href;
    a.download = data.cv.file;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const listRows = (rows) =>
    `<div class="listview">${rows
      .map((r) => `<div class="lv-row"><img class="ic" src="${ICON('doc')}" alt=""><div class="nm"><span class="lv-main">${esc(r.main)}</span>${r.sub ? `<span class="lv-sub">${esc(r.sub)}</span>` : ''}</div></div>`)
      .join('')}</div>`;

  /** Row selection on press, like a file list. */
  function selectable(container, selector) {
    container.addEventListener('pointerdown', (e) => {
      const row = e.target.closest(selector);
      container.querySelectorAll(`${selector}.sel`).forEach((n) => n !== row && n.classList.remove('sel'));
      row?.classList.add('sel');
    });
  }

  // ---------------------------------------------------------------------------
  // Apps
  // ---------------------------------------------------------------------------
  function createApps(wm, hooks) {
    const data = readData();
    const geo = (fn) => fn(wm.bounds(), wm.nextCascadeOffset());
    /** Open a window, reusing it when it already exists (no new cascade step). */
    const open = (id, build) => wm.get(id) ? wm.open(wm.get(id).def) : wm.open(build());

    const apps = {
      about: () =>
        open('about', () => ({
          id: 'about',
          title: 'About.txt',
          icon: ICON('about'),
          ...geo(detailRect),
          menu: true,
          menuActions: [{ label: 'Download CV', onClick: () => downloadCv(data) }],
          status: 'About me',
          content: `<div class="bioview">
              ${data.avatar ? `<div class="rest-hero"><img src="${esc(data.avatar)}" alt="${esc(data.name)}"></div>` : ''}
              <p class="bio-title">${esc(data.name)}</p>
              ${data.phrases.length ? `<div class="bio-tags">${data.phrases.map((p) => `<span class="bio-tag">${esc(p)}</span>`).join('')}</div>` : ''}
              <div class="bio-body">${data.about.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
            </div>`,
        })),

      projects: () =>
        open('projects', () => ({
          id: 'projects',
          title: 'Projects',
          icon: ICON('folder'),
          ...geo(explorerRect),
          menu: true,
          status: `${data.projects.length} objects (${data.projects.filter((p) => p.featured).length} featured)`,
          content: (el, win) => {
            el.innerHTML = `<div class="explorer">${data.projects
              .map((p, i) => `<div class="tile" role="button" tabindex="0" aria-label="Open ${esc(p.title)}${p.featured ? ' (featured)' : ''}" data-i="${i}"><img src="${projectIcon(p)}" alt=""><span class="nm">${esc(p.title)}</span></div>`)
              .join('')}</div>`;
            selectable(el, '.tile');
            const openTile = (tile) => tile && apps.project(Number(tile.dataset.i), win.id);
            el.addEventListener('click', (e) => openTile(e.target.closest('.tile')));
            el.addEventListener('keydown', (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              const tile = e.target.closest('.tile');
              if (!tile) return;
              e.preventDefault();
              tile.classList.add('sel');
              openTile(tile);
            });
          },
        })),

      project: (index, parentId) => {
        const p = data.projects[index];
        if (!p) return null;
        return open(`project:${index}`, () => ({
          id: `project:${index}`,
          title: p.title,
          taskLabel: p.title,
          icon: projectIcon(p),
          ...geo(detailRect),
          parentId,
          menu: true,
          menuActions: [{ label: 'View on GitHub', onClick: () => window.open(p.link, '_blank', 'noopener') }],
          status: 'Projects',
          content: `<div class="bioview">
              <p class="bio-title">${esc(p.title)}</p>
              <div class="bio-tags">${p.featured ? '<span class="bio-tag featured">Featured</span>' : ''}${p.tags.map((t) => `<span class="bio-tag">${esc(t)}</span>`).join('')}<span class="bio-tag">GitHub repository</span></div>
              <div class="bio-body"><p>${esc(p.desc)}</p></div>
              <div class="bio-divider"></div>
              <p><a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.link.replace(/^https?:\/\//, ''))}</a></p>
            </div>`,
        }));
      },

      skills: () =>
        open('skills', () => ({
          id: 'skills',
          title: 'Skills.exe',
          icon: ICON('skills'),
          ...geo(listRect),
          menu: true,
          status: `${data.skills.length} objects`,
          content: (el) => {
            el.innerHTML = listRows(data.skills.map((s) => ({ main: s })));
            selectable(el, '.lv-row');
          },
        })),

      education: () =>
        open('education', () => ({
          id: 'education',
          title: 'Education.txt',
          icon: ICON('education'),
          ...geo(listRect),
          menu: true,
          status: `${data.education.length} objects`,
          content: (el) => {
            el.innerHTML = listRows(data.education.map((e) => ({ main: e.title, sub: [e.level, e.school, e.when].filter(Boolean).join(' · ') })));
            selectable(el, '.lv-row');
          },
        })),

      languages: () =>
        open('languages', () => ({
          id: 'languages',
          title: 'Languages.txt',
          icon: ICON('languages'),
          ...geo(listRect),
          menu: true,
          status: `${data.languages.length} objects`,
          content: (el) => {
            el.innerHTML = listRows(data.languages.map((l) => ({ main: l.name, sub: l.level })));
            selectable(el, '.lv-row');
          },
        })),

      cv: () =>
        open('cv', () => {
          // Phones and touch browsers usually can't show a PDF inside a page
          const inline = !window.matchMedia('(max-width: 640px), (hover: none)').matches;
          return {
            id: 'cv',
            title: 'CV.pdf',
            icon: ICON('cv'),
            ...geo(docRect),
            menu: true,
            menuActions: [{ label: 'Download', onClick: () => downloadCv(data) }],
            status: data.cv.file,
            bodyClass: 'greybg',
            content: inline
              ? `<div class="cv-frame"><div class="well sunken"><iframe src="${esc(data.cv.href)}#view=FitH" title="${esc(data.name)} - CV"></iframe></div></div>`
              : `<div class="bioview">
                   <p class="bio-title">Curriculum Vitae</p>
                   <div class="bio-body"><p>The PDF can't be shown inside this window on this device.</p></div>
                   <div class="btn-row">
                     <a class="w95btn raised" href="${esc(data.cv.href)}" download="${esc(data.cv.file)}">Download CV</a>
                     <a class="w95btn raised" href="${esc(data.cv.href)}" target="_blank" rel="noopener">Open in a new tab</a>
                   </div>
                 </div>`,
          };
        }),

      contact: () =>
        open('contact', () => ({
          id: 'contact',
          title: 'Contact.exe',
          icon: ICON('contact'),
          ...geo(smallRect),
          menu: true,
          status: `${data.contacts.length} links`,
          content: (el, win) => {
            el.innerHTML = `<div class="bioview">
                <p class="bio-title">Let's Connect</p>
                <p class="bio-sub">E-mail</p>
                <div class="field-row">
                  <div class="field sunken" title="${esc(data.email)}">${esc(data.email)}</div>
                  <button class="w95btn raised" type="button" data-copy>Copy</button>
                </div>
                <p class="bio-sub">Links</p>
                <div class="btn-row">${data.contacts
                  .map((c) => {
                    const external = !c.href.startsWith('mailto:');
                    return `<a class="w95btn raised" href="${esc(c.href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${esc(c.label)}</a>`;
                  })
                  .join('')}</div>
              </div>`;
            el.querySelector('[data-copy]').addEventListener('click', () => {
              const done = (ok) => wm.setStatus(win, ok ? 'Copied to the clipboard!' : 'Copy failed: select the address manually');
              if (navigator.clipboard?.writeText) navigator.clipboard.writeText(data.email).then(() => done(true), () => done(false));
              else done(false);
            });
          },
        })),

      terminal: () => open('terminal', () => terminalWindow(wm, geo(detailRect), data)),

      welcome: () =>
        open('welcome', () => ({
          id: 'welcome',
          title: `${data.name} - Portfolio`,
          icon: ICON('about'),
          ...centerRect(wm.bounds(), 520, 420),
          onlyClose: true,
          resizable: false,
          content: (el, win) => {
            el.innerHTML = `<div class="welcome">
                <div class="wl-main">
                  ${data.avatar ? `<img class="wl-pic sunken" src="${esc(data.avatar)}" alt="">` : ''}
                  <div class="wl-big">${esc(data.name)}</div>
                  <div class="wl-line" aria-live="off">${esc(data.phrases[0] || '')}</div>
                </div>
                <div class="wl-actions">
                  <button class="w95btn raised" type="button" data-wl="projects">Open Projects</button>
                  <button class="w95btn raised" type="button" data-wl="cv">Download CV</button>
                </div>
              </div>`;
            const line = el.querySelector('.wl-line');
            let i = 0;
            const timer = data.phrases.length > 1 ? setInterval(() => (line.textContent = data.phrases[(i = (i + 1) % data.phrases.length)]), 2200) : 0;
            win.onClose = () => clearInterval(timer);
            el.querySelector('[data-wl="projects"]').addEventListener('click', () => apps.projects());
            el.querySelector('[data-wl="cv"]').addEventListener('click', () => downloadCv(data));
          },
        })),

      exit: () => hooks.exit(),
    };
    return { apps, data };
  }

  // ---------------------------------------------------------------------------
  // Terminal.exe: the portfolio terminal inside a window
  // ---------------------------------------------------------------------------
  function terminalWindow(wm, rect, data) {
    let stopDonut = null;
    return {
      id: 'terminal',
      title: 'Terminal.exe',
      icon: ICON('terminal'),
      ...rect,
      bodyClass: 'term',
      status: "Type 'help' for the commands",
      onClose: () => stopDonut?.(),
      content: (el, win) => {
        el.innerHTML = `<div class="term-out"><p>Welcome to the terminal. Type 'help' to see available commands.</p></div>
          <div class="term-line"><span>_&gt;</span><input type="text" aria-label="Terminal command" autocomplete="off" spellcheck="false"></div>`;
        const out = el.querySelector('.term-out');
        const input = el.querySelector('input');
        const history = [];
        let pos = 0;
        const html = (s) => {
          const p = document.createElement('p');
          p.innerHTML = s; // trusted command output built from the page
          out.appendChild(p);
        };
        const text = (s) => {
          const p = document.createElement('p');
          p.textContent = s; // user input: never parsed as HTML
          out.appendChild(p);
          return p;
        };
        const commands = { ...(window.Portfolio?.commands || {}) };
        // Here 'exit' only closes this window, and 'minimal' leaves the retro desktop
        if (window.Portfolio?.buildHelp) {
          commands.help = window.Portfolio.buildHelp(
            window.Portfolio.helpRows.flatMap(([name, desc]) =>
              name === 'exit'
                ? [['minimal', 'Switch to the minimal style'], ['exit', 'Close this terminal window']]
                : [[name, desc]],
            ),
          );
        }

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            // Autocomplete like the main terminal; list the options when Tab adds nothing new
            e.preventDefault();
            const done = window.Portfolio?.completeCommand?.(input.value, ['minimal']);
            if (!done) return;
            if (done.value !== input.value) input.value = done.value;
            else if (done.matches.length > 1) {
              text(`_> ${input.value}`);
              text(done.matches.join('   ')).style.whiteSpace = 'pre-wrap';
              el.scrollTop = el.scrollHeight;
            }
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (pos > 0) input.value = history[--pos];
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            pos = Math.min(history.length, pos + 1);
            input.value = history[pos] || '';
            return;
          }
          if (e.key !== 'Enter') return;
          const cmd = input.value.trim().toLowerCase();
          input.value = '';
          if (cmd) history.push(cmd);
          pos = history.length;
          text(`_> ${cmd}`);
          if (cmd === 'clear') {
            stopDonut?.();
            out.innerHTML = '';
          } else if (cmd === 'exit') {
            wm.close(win);
            return;
          } else if (cmd === 'minimal') {
            window.Portfolio?.setView('classic');
            return;
          } else if (cmd === 'retro') {
            text('You are already on the retro desktop.');
          } else if (cmd === '3d') {
            window.Portfolio?.setView('neon');
            return;
          } else if (cmd === 'cv' || cmd === 'resume') {
            html(`&gt; <a href="${esc(data.cv.href)}" download="${esc(data.cv.file)}">[Click here to download the CV]</a>`);
          } else if (cmd === 'donut' && window.Portfolio?.renderDonut) {
            stopDonut?.();
            const frame = document.createElement('div');
            frame.className = 'donut-frame';
            out.appendChild(frame);
            stopDonut = window.Portfolio.renderDonut(frame);
            text("Type 'clear' to stop.");
          } else if (commands[cmd]) {
            html(commands[cmd]);
          } else if (cmd) {
            text(`${cmd}: command not found. Type 'help' for a list of commands.`);
          }
          el.scrollTop = el.scrollHeight;
        });
        // Clicking anywhere in the terminal focuses the prompt (unless selecting text)
        el.addEventListener('click', () => {
          if (!window.getSelection().toString()) input.focus();
        });
        // The window is already in the page here, so the prompt can take focus right away
        input.focus();
      },
    };
  }

  Retro.createApps = createApps;
})();
