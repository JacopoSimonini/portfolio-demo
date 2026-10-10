// Retro Desktop: window manager.
// Creates windows, keeps focus/z-order, cascades new windows, handles drag,
// 8-way resize, maximize/restore, minimize and close, and the matching
// taskbar buttons. Classic script (no modules) so the site also works from file://.
(function () {
  'use strict';
  const Retro = (window.Retro = window.Retro || {});

  const TITLE_VISIBLE = 25; // title bar 22px + padding 3px stay above the taskbar
  const MIN_VISIBLE_RIGHT = 60; // dragging right keeps the icon + title start visible
  const MIN_VISIBLE_LEFT = 120; // dragging left keeps the title buttons + a grabbable strip
  const MIN_W = 220;
  const MIN_H = 140;
  const CASCADE_STEP = 24;
  const CASCADE_WRAP = 144;
  const Z_BASE = 10;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const isPinned = () => window.matchMedia('(max-width: 640px)').matches;

  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch]);

  /** Give a non-button element button semantics (role, focus, Enter/Space). */
  function makeButton(el, label) {
    el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    if (label) el.setAttribute('aria-label', label);
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      el.click();
    });
  }

  const GLYPH = {
    min: '<svg width="8" height="8" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 6h6v2H1z"/></svg>',
    max: '<svg width="10" height="9" viewBox="0 0 10 9" shape-rendering="crispEdges" aria-hidden="true"><path d="M0 0h10v2H0zM0 2h1v7H0zM9 2h1v7H9zM1 8h8v1H1z"/></svg>',
    restore:
      '<svg width="10" height="10" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true"><path d="M3 0h7v2H3zM3 2h1v1H3zM9 2h1v5H9zM8 6h1v1H8zM0 3h7v2H0zM0 5h1v5H0zM6 5h1v5H6zM1 9h5v1H1z"/></svg>',
    close:
      '<svg width="8" height="7" viewBox="0 0 8 7" shape-rendering="crispEdges" aria-hidden="true"><path d="M0 0h2v1H0zM6 0h2v1H6zM1 1h2v1H1zM5 1h2v1H5zM2 2h4v1H2zM3 3h2v1H3zM2 4h4v1H2zM1 5h2v1H1zM5 5h2v1H5zM0 6h2v1H0zM6 6h2v1H6z"/></svg>',
  };
  const LABEL = { min: 'Minimize', max: 'Maximize', restore: 'Restore', close: 'Close' };

  let uid = 0;

  function readRect(el) {
    return { left: parseInt(el.style.left, 10) || 0, top: parseInt(el.style.top, 10) || 0, width: el.offsetWidth, height: el.offsetHeight };
  }
  function applyRect(el, r) {
    if (r.left !== undefined) el.style.left = `${Math.round(r.left)}px`;
    if (r.top !== undefined) el.style.top = `${Math.round(r.top)}px`;
    if (r.width !== undefined) el.style.width = `${Math.round(r.width)}px`;
    if (r.height !== undefined) el.style.height = `${Math.round(r.height)}px`;
  }

  /** Pointer-based drag/resize helper: calls move(dx, dy) until release. */
  function trackPointer(handle, e, move) {
    const sx = e.clientX;
    const sy = e.clientY;
    handle.setPointerCapture(e.pointerId);
    const onMove = (ev) => move(ev.clientX - sx, ev.clientY - sy);
    const end = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  class WindowManager {
    /**
     * @param {HTMLElement} desktop  windows are appended here
     * @param {HTMLElement} tasks    taskbar button strip
     * @param {{isBlocked?: () => boolean}} opts  Escape is ignored while isBlocked() is true
     */
    constructor(desktop, tasks, opts = {}) {
      this.desktop = desktop;
      this.tasks = tasks;
      this.opts = opts;
      this.windows = new Map();
      this.active = null;
      this.z = Z_BASE;
      this.cascade = 0;

      desktop.closest('#retro-view').addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !this.active || this.opts.isBlocked?.()) return;
        e.preventDefault();
        this.close(this.active);
      });
      window.addEventListener('resize', () => {
        for (const win of this.windows.values()) if (win.maxed) this.fillDesktop(win);
      });
    }

    bounds() {
      return { w: this.desktop.clientWidth, h: this.desktop.clientHeight };
    }

    nextCascadeOffset() {
      const offset = this.cascade;
      this.cascade = (this.cascade + CASCADE_STEP) % CASCADE_WRAP;
      return offset;
    }

    get(id) {
      return this.windows.get(id);
    }

    all() {
      return [...this.windows.values()];
    }

    /**
     * Open a window, or restore + focus the one with the same id.
     * def: { id, title, icon, x, y, w, h, menu?, menuActions?: [{label, onClick}], status?,
     *        onlyClose?, resizable?, bodyClass?, content: string | (contentEl, win) => void, onClose? }
     */
    open(def) {
      const existing = this.windows.get(def.id);
      if (existing) {
        if (existing.minimized) this.restore(existing);
        this.focus(existing);
        return existing;
      }

      const titleId = `rd-win-title-${++uid}`;
      const el = document.createElement('div');
      el.className = 'win raised';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-labelledby', titleId);
      el.setAttribute('aria-modal', 'false');
      el.tabIndex = -1;
      el.dataset.winId = def.id;

      const tbtn = (act) => `<div class="tbtn raised${act === 'close' ? ' close' : ''}" data-act="${act}" title="${LABEL[act]}">${GLYPH[act]}</div>`;
      const extras = (def.menuActions || []).map((a, i) => `<button class="mi mi-extra raised" type="button" data-extra="${i}">${esc(a.label)}</button>`).join('');
      el.innerHTML = `
        <div class="titlebar">
          <img class="ti-icon" src="${esc(def.icon)}" alt="">
          <div class="ti-text" id="${titleId}"></div>
          <div class="tbtns">${def.onlyClose ? '' : tbtn('min') + tbtn('max')}${tbtn('close')}</div>
        </div>
        ${
          def.menu
            ? `<div class="menubar" role="toolbar" aria-label="Window menu">
                 <button class="mi raised" type="button" data-act="back"><u>B</u>ack</button>
                 <button class="mi raised" type="button" data-act="close"><u>C</u>lose</button>${extras}
               </div>`
            : ''
        }
        <div class="content ${esc(def.bodyClass || '')}"></div>
        ${def.status !== undefined ? '<div class="statusbar"><div class="pane grow sunken-thin"></div><div class="pane fixed sunken-thin"></div></div>' : ''}`;
      el.querySelector('.ti-text').textContent = def.title;

      const win = {
        id: def.id,
        def,
        el,
        contentEl: el.querySelector('.content'),
        statusEl: el.querySelector('.statusbar .pane.grow'),
        taskbtn: this.createTaskButton(def),
        minimized: false,
        maxed: false,
        prevRect: null,
        parentId: def.parentId,
        goBack: null,
        onClose: def.onClose,
      };
      if (win.statusEl) win.statusEl.textContent = def.status || '';
      applyRect(el, { left: def.x, top: def.y, width: def.w, height: def.h });

      el.addEventListener('pointerdown', () => {
        if (this.active !== win) this.focus(win);
      });

      // Title-bar buttons
      el.querySelectorAll('.tbtn').forEach((btn) => {
        const act = btn.dataset.act;
        makeButton(btn, `${LABEL[act]} ${def.title}`);
        btn.addEventListener('pointerdown', (e) => e.stopPropagation());
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (act === 'min') this.minimize(win);
          else if (act === 'max') this.toggleMaximize(win);
          else this.close(win);
        });
      });

      // Menu bar
      el.querySelectorAll('.menubar .mi').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (btn.dataset.act === 'back') this.goBack(win);
          else if (btn.dataset.act === 'close') this.close(win);
          else def.menuActions[Number(btn.dataset.extra)].onClick(win);
        });
      });

      const titlebar = el.querySelector('.titlebar');
      titlebar.addEventListener('dblclick', (e) => {
        if (!def.onlyClose && !e.target.closest('.tbtn')) this.toggleMaximize(win);
      });
      this.enableDrag(win, titlebar);
      if (def.resizable !== false) this.enableResize(win);

      win.taskbtn.addEventListener('click', () => {
        if (win.minimized) {
          this.restore(win);
          this.focus(win);
        } else if (this.active === win) this.minimize(win);
        else this.focus(win);
      });

      this.desktop.appendChild(el);
      this.tasks.appendChild(win.taskbtn);
      this.windows.set(def.id, win);

      if (typeof def.content === 'function') def.content(win.contentEl, win);
      else win.contentEl.innerHTML = def.content || '';

      this.focus(win);
      return win;
    }

    createTaskButton(def) {
      const btn = document.createElement('div');
      btn.className = 'taskbtn raised';
      btn.innerHTML = `<img src="${esc(def.icon)}" alt=""><span></span>`;
      btn.querySelector('span').textContent = def.taskLabel || def.title;
      btn.title = def.taskLabel || def.title;
      makeButton(btn, `Activate window ${def.taskLabel || def.title}`);
      btn.setAttribute('aria-pressed', 'false');
      return btn;
    }

    setTaskActive(win, on) {
      win.taskbtn.classList.toggle('active', on);
      win.taskbtn.classList.toggle('pressed', on);
      win.taskbtn.classList.toggle('raised', !on);
      win.taskbtn.setAttribute('aria-pressed', String(on));
    }

    focus(win) {
      if (this.active && this.active !== win) {
        this.active.el.classList.add('inactive');
        this.setTaskActive(this.active, false);
      }
      this.active = win;
      win.el.classList.remove('inactive');
      win.el.style.zIndex = String(++this.z);
      this.setTaskActive(win, true);
      if (!win.el.contains(document.activeElement)) win.el.focus({ preventScroll: true });
    }

    minimize(win) {
      win.minimized = true;
      win.el.hidden = true;
      win.el.setAttribute('aria-hidden', 'true');
      win.el.classList.add('inactive');
      this.setTaskActive(win, false);
      if (this.active === win) {
        this.active = null;
        this.focusTopmost();
      }
    }

    restore(win) {
      win.minimized = false;
      win.el.hidden = false;
      win.el.removeAttribute('aria-hidden');
    }

    toggleMaximize(win) {
      if (win.maxed) {
        win.maxed = false;
        win.el.classList.remove('maxed');
        if (win.prevRect) applyRect(win.el, win.prevRect);
      } else {
        win.prevRect = readRect(win.el);
        win.maxed = true;
        win.el.classList.add('maxed');
        this.fillDesktop(win);
      }
      const btn = win.el.querySelector('.tbtn[data-act="max"]');
      if (btn) {
        const act = win.maxed ? 'restore' : 'max';
        btn.innerHTML = GLYPH[act];
        btn.title = LABEL[act];
        btn.setAttribute('aria-label', `${LABEL[act]} ${win.def.title}`);
      }
      this.focus(win);
    }

    close(win) {
      win.onClose?.(win);
      win.el.remove();
      win.taskbtn.remove();
      this.windows.delete(win.id);
      if (this.active === win) {
        this.active = null;
        this.focusTopmost();
      }
      if (this.windows.size === 0) this.cascade = 0;
    }

    closeAll() {
      for (const win of this.all()) this.close(win);
    }

    /** Back: in-window history first, then the parent window, otherwise close. */
    goBack(win) {
      if (win.goBack?.()) return;
      const parent = win.parentId ? this.windows.get(win.parentId) : undefined;
      this.close(win);
      if (parent) {
        if (parent.minimized) this.restore(parent);
        this.focus(parent);
      }
    }

    setStatus(win, text) {
      if (win.statusEl) win.statusEl.textContent = text;
    }

    fillDesktop(win) {
      const { w, h } = this.bounds();
      applyRect(win.el, { left: 0, top: 0, width: w, height: h });
    }

    focusTopmost() {
      const visible = this.all().filter((w) => !w.minimized);
      if (!visible.length) return;
      visible.sort((a, b) => Number(a.el.style.zIndex) - Number(b.el.style.zIndex));
      this.focus(visible[visible.length - 1]);
    }

    enableDrag(win, handle) {
      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || win.maxed || isPinned() || e.target.closest('.tbtn')) return;
        e.preventDefault();
        this.focus(win);
        const start = readRect(win.el);
        trackPointer(handle, e, (dx, dy) => {
          const { w, h } = this.bounds();
          const width = win.el.offsetWidth;
          win.el.style.left = `${Math.round(clamp(start.left + dx, -(width - MIN_VISIBLE_LEFT), w - MIN_VISIBLE_RIGHT))}px`;
          win.el.style.top = `${Math.round(clamp(start.top + dy, 0, h - TITLE_VISIBLE))}px`;
        });
      });
    }

    enableResize(win) {
      for (const dir of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
        const handle = document.createElement('div');
        handle.className = `rsz rsz-${dir}`;
        handle.setAttribute('aria-hidden', 'true');
        win.el.appendChild(handle);
        handle.addEventListener('pointerdown', (e) => {
          if (e.button !== 0 || win.maxed || isPinned()) return;
          e.preventDefault();
          e.stopPropagation();
          this.focus(win);
          const s = readRect(win.el);
          const right = s.left + s.width;
          const bottom = s.top + s.height;
          trackPointer(handle, e, (dx, dy) => {
            const { w, h } = this.bounds();
            const r = { ...s };
            if (dir.includes('e')) r.width = clamp(s.width + dx, MIN_W, Math.max(w, right) - s.left);
            if (dir.includes('s')) r.height = clamp(s.height + dy, MIN_H, Math.max(h, bottom) - s.top);
            if (dir.includes('w')) {
              r.left = clamp(s.left + dx, Math.min(0, s.left), right - MIN_W);
              r.width = right - r.left;
            }
            if (dir.includes('n')) {
              r.top = clamp(s.top + dy, Math.min(0, s.top), bottom - MIN_H);
              r.height = bottom - r.top;
            }
            applyRect(win.el, r);
          });
        });
      }
    }
  }

  Retro.WindowManager = WindowManager;
  Retro.makeButton = makeButton;
  Retro.esc = esc;
})();
