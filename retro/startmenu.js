// Retro Desktop: Start menu.
// 260px panel above the taskbar. Sub-menus replace the list in place, headed by a
// bold "Back - <label>" item. Keyboard: arrows, Home/End, Enter/Space, ArrowRight
// opens a sub-menu, ArrowLeft goes back, Escape closes, Tab closes.
(function () {
  'use strict';
  const Retro = (window.Retro = window.Retro || {});

  class StartMenu {
    /**
     * @param {HTMLElement} root    the #retro-view element (Escape is captured here)
     * @param {HTMLElement} menu    the .rd-startmenu panel
     * @param {HTMLElement} button  the Start button
     * @param {() => Array} getEntries  entries: {key, icon, html, action?, children?} or 'separator'
     */
    constructor(root, menu, button, getEntries) {
      this.menu = menu;
      this.list = menu.querySelector('.items');
      this.button = button;
      this.getEntries = getEntries;
      this.trail = [];

      this.list.setAttribute('role', 'menu');
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');

      button.addEventListener('pointerdown', (e) => e.stopPropagation());
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isOpen()) this.close();
        else this.open();
      });
      menu.addEventListener('pointerdown', (e) => e.stopPropagation());
      root.addEventListener('pointerdown', () => this.close());
      // Capture phase: runs before the window manager's Escape handler
      root.addEventListener('keydown', (e) => this.onKey(e), true);
    }

    isOpen() {
      return this.menu.classList.contains('show');
    }

    open() {
      this.trail = [];
      this.render();
      this.menu.classList.add('show');
      this.button.classList.replace('raised', 'pressed');
      this.button.setAttribute('aria-expanded', 'true');
      this.focusItem(0);
    }

    close(returnFocus = false) {
      if (!this.isOpen()) return;
      this.menu.classList.remove('show');
      this.button.classList.replace('pressed', 'raised');
      this.button.setAttribute('aria-expanded', 'false');
      this.trail = [];
      if (returnFocus) this.button.focus();
    }

    item(entry, onClick, extraClass = '') {
      const el = document.createElement('div');
      el.className = `smi${extraClass}`;
      if (entry.key) el.dataset.key = entry.key;
      el.setAttribute('role', 'menuitem');
      el.tabIndex = -1;
      const label = entry.html.replace(/<[^>]+>/g, '');
      el.setAttribute('aria-label', label);
      if (entry.children) el.setAttribute('aria-haspopup', 'menu');
      el.innerHTML = `<div class="ico"><img src="${entry.icon || 'retro/assets/icons/sm-folder.svg'}" alt=""></div><div class="txt">${entry.html}</div>${entry.children ? '<div class="arr" aria-hidden="true">&#9658;</div>' : ''}`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      // Focus follows the pointer, so hover and keyboard highlight never diverge
      el.addEventListener('pointerenter', () => el.focus({ preventScroll: true }));
      return el;
    }

    separator() {
      const el = document.createElement('div');
      el.className = 'sm-sep';
      el.setAttribute('role', 'separator');
      return el;
    }

    activate(entry) {
      if (entry.children) {
        this.trail.push(entry);
        this.render();
        this.focusItem(0);
        return;
      }
      this.close();
      entry.action?.();
    }

    back() {
      this.trail.pop();
      this.render();
      this.focusItem(0);
    }

    render() {
      this.list.innerHTML = '';
      const current = this.trail[this.trail.length - 1];
      let entries;
      if (current) {
        const label = `Back - ${current.html.replace(/<[^>]+>/g, '')}`;
        this.list.setAttribute('aria-label', label);
        this.list.appendChild(this.item({ key: 'back', icon: 'retro/assets/icons/sm-back.svg', html: label }, () => this.back(), ' sm-back'));
        this.list.appendChild(this.separator());
        entries = current.children;
      } else {
        this.list.setAttribute('aria-label', 'Start menu');
        entries = this.getEntries();
      }
      for (const entry of entries) this.list.appendChild(entry === 'separator' ? this.separator() : this.item(entry, () => this.activate(entry)));
    }

    items() {
      return [...this.list.querySelectorAll('.smi')];
    }

    focusItem(index) {
      const all = this.items();
      if (!all.length) return;
      all[((index % all.length) + all.length) % all.length].focus();
    }

    onKey(e) {
      if (!this.isOpen()) return;
      const all = this.items();
      const i = all.indexOf(document.activeElement);
      const stop = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      switch (e.key) {
        case 'Escape':
          stop();
          this.close(true);
          break;
        case 'ArrowDown':
          stop();
          this.focusItem(i + 1);
          break;
        case 'ArrowUp':
          stop();
          this.focusItem(i < 0 ? -1 : i - 1);
          break;
        case 'Home':
          stop();
          this.focusItem(0);
          break;
        case 'End':
          stop();
          this.focusItem(-1);
          break;
        case 'ArrowRight':
          if (i >= 0 && all[i].getAttribute('aria-haspopup') === 'menu') {
            stop();
            all[i].click();
          }
          break;
        case 'ArrowLeft':
          if (this.trail.length) {
            stop();
            this.back();
          }
          break;
        case 'Enter':
        case ' ':
          if (i >= 0) {
            stop();
            all[i].click();
          }
          break;
        case 'Tab':
          this.close();
          break;
      }
    }
  }

  Retro.StartMenu = StartMenu;
})();
