// Retro Desktop: builds the desktop (lazily, on first entry) and wires the boot
// screen, desktop icons, taskbar clock, Start menu, screensaver and Exit.
// Public API: Retro.enter(), Retro.exit()  (called by script.js setView()).
(function () {
  'use strict';
  const Retro = (window.Retro = window.Retro || {});
  const ICON = (name) => `retro/assets/icons/${name}.svg`;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BOOT_MS = 1500;
  const FADE_MS = 600;

  let root = null;
  let wm = null;
  let menu = null;
  let apps = null;
  let data = null;
  let clockTimer = 0;
  let bootTimer = 0;
  let stopScreensaver = null;

  const DESKTOP_ICONS = [
    { id: 'about', label: 'About.txt', icon: 'about', side: 'left' },
    { id: 'projects', label: 'Projects', icon: 'folder', side: 'left' },
    { id: 'skills', label: 'Skills.exe', icon: 'skills', side: 'left' },
    { id: 'education', label: 'Education.txt', icon: 'education', side: 'left' },
    { id: 'languages', label: 'Languages.txt', icon: 'languages', side: 'left' },
    { id: 'cv', label: 'CV.pdf', icon: 'cv', side: 'right' },
    { id: 'contact', label: 'Contact.exe', icon: 'contact', side: 'right' },
    { id: 'terminal', label: 'Terminal.exe', icon: 'terminal', side: 'right' },
    { id: 'exit', label: 'Exit', icon: 'exit', side: 'right' },
  ];

  /** Text logo with the portfolio owner's name (4:1, scales like an image). */
  function nameLogo(cls, name, colored = false, separator = true) {
    const [first = '', ...rest] = name.split(' ');
    const last = rest.join(' ');
    const id = `rd-grad-${Math.random().toString(36).slice(2, 8)}`;
    const fill = colored ? `url(#${id})` : 'currentColor';
    const accent = colored ? '#2ec4b6' : 'currentColor';
    const font = `'Arial Black', 'Helvetica Neue', Arial, sans-serif`;
    return `<svg class="${cls}" viewBox="0 0 480 120" role="img" aria-label="${Retro.esc(name)}" xmlns="http://www.w3.org/2000/svg">
      ${colored ? `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5e3a"/><stop offset="1" stop-color="#ffd23f"/></linearGradient></defs>` : ''}
      <g font-family="${font}">
        <text x="6" y="40" font-size="40" fill="${fill}" textLength="230" lengthAdjust="spacingAndGlyphs">${Retro.esc(first)}</text>
        ${separator ? `<rect x="246" y="14" width="14" height="27" fill="${accent}"/>` : ''}
        <text x="6" y="112" font-size="78" font-weight="900" fill="${fill}" textLength="468" lengthAdjust="spacingAndGlyphs">${Retro.esc(last || first)}</text>
      </g>
    </svg>`;
  }

  function build() {
    root = document.getElementById('retro-view');
    root.innerHTML = `
      <main class="rd-desktop" aria-label="Retro desktop">
        <h2 class="sr-only">Retro desktop</h2>
        <div class="rd-icons left" role="navigation" aria-label="Desktop icons"></div>
        <div class="rd-icons right" role="navigation" aria-label="Desktop shortcuts"></div>
      </main>
      <div class="rd-taskbar">
        <button class="rd-start raised" type="button" aria-label="Open the Start menu"><img src="${ICON('start')}" alt="">Start</button>
        <div class="rd-tasks"></div>
        <div class="rd-tray sunken-thin">
          <svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 6h3l4-4v12l-4-4H1z" fill="#000"/><path d="M5 7h2v2H5z" fill="#808080"/><path d="M10 6h1v4h-1zM12 4h1v8h-1z" fill="#000"/></svg>
          <span class="rd-clock">--:--</span>
        </div>
      </div>
      <div class="rd-startmenu raised" aria-label="Start menu">
        <div class="rail" aria-hidden="true"><span></span></div>
        <div class="items"></div>
      </div>`;

    const desktop = root.querySelector('.rd-desktop');
    wm = new Retro.WindowManager(desktop, root.querySelector('.rd-tasks'), {
      isBlocked: () => menu.isOpen() || !!stopScreensaver || !!root.querySelector('.rd-boot'),
    });
    ({ apps, data } = Retro.createApps(wm, { exit: () => window.Portfolio.setView('classic') }));

    const [first, ...rest] = data.name.split(' ');
    root.querySelector('.rail span').innerHTML = `${Retro.esc(first)} <b>${Retro.esc(rest.join(' '))}</b>`;

    // Desktop icons: a single click opens, focus selects (Enter/Space opens)
    const select = (el) => {
      root.querySelectorAll('.dicon.sel').forEach((n) => n.classList.remove('sel'));
      el?.classList.add('sel');
    };
    for (const def of DESKTOP_ICONS) {
      const el = document.createElement('div');
      el.className = 'dicon';
      el.dataset.app = def.id;
      el.innerHTML = `<div class="img"><img alt="" src="${ICON(def.icon)}"></div><div class="lbl"></div>`;
      el.querySelector('.lbl').textContent = def.label;
      Retro.makeButton(el, def.id === 'exit' ? 'Exit the retro desktop' : `Open ${def.label}`);
      el.addEventListener('focus', () => select(el));
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        select(el);
        apps[def.id]();
      });
      root.querySelector(`.rd-icons.${def.side}`).appendChild(el);
    }
    desktop.addEventListener('pointerdown', (e) => {
      if (e.target === desktop || e.target.classList.contains('rd-icons')) select(null);
    });

    menu = new Retro.StartMenu(root, root.querySelector('.rd-startmenu'), root.querySelector('.rd-start'), startEntries);
  }

  function startEntries() {
    return [
      { key: 'about', icon: ICON('about'), html: '<u>A</u>bout me', action: apps.about },
      {
        key: 'projects',
        icon: ICON('folder'),
        html: '<u>P</u>rojects',
        children: [
          { key: 'projects-folder', icon: ICON('folder'), html: 'Open folder', action: apps.projects },
          'separator',
          // Featured projects come first with a starred folder, then a separator before the rest
          ...data.projects.flatMap((p, i) => [
            ...(i > 0 && !p.featured && data.projects[i - 1].featured ? ['separator'] : []),
            { key: `project-${i}`, icon: ICON(p.featured ? 'folder-star' : 'folder'), html: Retro.esc(p.title), action: () => apps.project(i) },
          ]),
        ],
      },
      { key: 'skills', icon: ICON('skills'), html: '<u>S</u>kills', action: apps.skills },
      { key: 'education', icon: ICON('education'), html: '<u>E</u>ducation', action: apps.education },
      { key: 'languages', icon: ICON('languages'), html: '<u>L</u>anguages', action: apps.languages },
      { key: 'cv', icon: ICON('cv'), html: '<u>C</u>V', action: apps.cv },
      { key: 'contact', icon: ICON('contact'), html: 'C<u>o</u>ntact', action: apps.contact },
      { key: 'terminal', icon: ICON('terminal'), html: '<u>T</u>erminal', action: apps.terminal },
      'separator',
      {
        key: 'style',
        icon: ICON('sm-settings'),
        html: 'St<u>y</u>le',
        children: [
          { key: 'style-minimal', icon: ICON('sm-folder'), html: 'Minimal', action: () => window.Portfolio.setView('classic') },
          { key: 'style-terminal', icon: ICON('terminal'), html: 'Terminal', action: () => window.Portfolio.setView('terminal') },
          { key: 'style-neon', icon: ICON('folder-star'), html: '3D street', action: () => window.Portfolio.setView('neon') },
        ],
      },
      { key: 'sleep', icon: ICON('sm-moon'), html: 'Slee<u>p</u>', action: startScreensaver },
      { key: 'exit', icon: ICON('sm-door'), html: 'E<u>x</u>it to minimal...', action: () => window.Portfolio.setView('classic') },
    ];
  }

  function startClock() {
    const clock = root.querySelector('.rd-clock');
    const tick = () => {
      const d = new Date();
      clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  /** Short boot screen: about 1.5s, skipped on click or any key. */
  function boot(onDone) {
    const el = document.createElement('div');
    el.className = 'rd-boot';
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute('aria-label', 'Skip the loading screen');
    el.innerHTML = `
      <div class="boot-center">
        ${nameLogo('boot-logo', data.name, false, false)}
        <div class="xp-bar"><div class="xp-blocks"><span></span><span></span><span></span></div></div>
      </div>
      <div class="boot-copy">Copyright &copy; ${new Date().getFullYear()}<br>${Retro.esc(data.name)}</div>`;
    root.appendChild(el);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(bootTimer);
      root.removeEventListener('keydown', onKey, true);
      const fade = reducedMotion() ? 0 : FADE_MS;
      el.classList.add('hide');
      setTimeout(() => el.remove(), fade + 50);
      setTimeout(onDone, Math.max(0, fade - 100));
    };
    const onKey = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      finish();
    };
    el.addEventListener('click', finish);
    root.addEventListener('keydown', onKey, true);
    bootTimer = setTimeout(finish, BOOT_MS);
    el.focus({ preventScroll: true });
  }

  /** Sleep: the name bounces around (2.4 / 2 px per frame), hue changes on each bounce. */
  function startScreensaver() {
    if (stopScreensaver) return;
    const HUES = [0, 45, 90, 135, 170, 210, 260, 300, 330];
    const el = document.createElement('div');
    el.className = 'rd-screensaver';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Screensaver: press any key or click to return');
    el.innerHTML = nameLogo('ss-logo', data.name, true, false);
    root.appendChild(el);
    const logo = el.querySelector('svg');
    const width = Math.round(Math.min(280, window.innerWidth * 0.3));
    const height = width / 4;
    logo.style.width = `${width}px`;
    logo.style.height = `${height}px`;
    let hue = Math.floor(Math.random() * HUES.length);
    const applyHue = () => {
      logo.style.filter = `hue-rotate(${HUES[hue++ % HUES.length]}deg) saturate(2) brightness(1.08)`;
    };
    applyHue();
    let frame = 0;
    if (reducedMotion()) {
      logo.style.transform = `translate(${Math.round((window.innerWidth - width) / 2)}px, ${Math.round((window.innerHeight - height) / 2)}px)`;
    } else {
      let x = Math.random() * (window.innerWidth - width);
      let y = Math.random() * (window.innerHeight - height);
      let vx = 2.4 * (Math.random() < 0.5 ? -1 : 1);
      let vy = 2 * (Math.random() < 0.5 ? -1 : 1);
      const step = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        x += vx;
        y += vy;
        let hit = false;
        if (x <= 0) [x, vx, hit] = [0, Math.abs(vx), true];
        else if (x + width >= w) [x, vx, hit] = [w - width, -Math.abs(vx), true];
        if (y <= 0) [y, vy, hit] = [0, Math.abs(vy), true];
        else if (y + height >= h) [y, vy, hit] = [h - height, -Math.abs(vy), true];
        if (hit) applyHue();
        logo.style.transform = `translate(${x}px, ${y}px)`;
        frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }
    const exit = (e) => {
      e?.preventDefault();
      e?.stopImmediatePropagation();
      stopScreensaver?.();
    };
    stopScreensaver = () => {
      cancelAnimationFrame(frame);
      el.remove();
      document.removeEventListener('keydown', exit, true);
      stopScreensaver = null;
    };
    el.addEventListener('click', exit);
    document.addEventListener('keydown', exit, true);
  }

  Retro.enter = function enter() {
    if (!root) build();
    root.hidden = false;
    startClock();
    boot(() => {
      if (!wm.all().length) apps.welcome();
    });
  };

  Retro.exit = function exit() {
    if (!root) return;
    clearTimeout(bootTimer);
    root.querySelector('.rd-boot')?.remove();
    stopScreensaver?.();
    menu.close();
    wm.closeAll();
    clearInterval(clockTimer);
    root.hidden = true;
  };
})();
