// 3D style: a neon street corner (Three.js). Loaded on demand by script.js setView('neon').
// Public API: enter(root), exit()
//
// The model (neon/model/neon-corner.glb, built in Blender) carries its own lighting baked into
// one texture, the cameras (cam_home, cam_<id>), the marker anchors (hotspot_<id>), the clickable
// parts (meshes named <id>) and the movable items of the close-ups (bottles, letters, books, the
// CV door and sheet) plus empties that mark where their animations go. The content comes from
// the minimal view, like the terminal and retro styles, so nothing is written twice.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Bump ?v= after replacing the model, so browsers fetch the new file
const MODEL_URL = new URL('./model/neon-corner.glb?v=9', import.meta.url).href;

// guide: the close-up shows which items can be clicked (see startGuide)
const HOTSPOTS = [
    { id: 'projects', label: 'Projects', guide: true },                 // vending machine: one drink per project
    { id: 'education', label: 'Education', side: 'left', guide: true }, // book cart: one book per degree
    { id: 'skills', label: 'Skills' },                                  // chalkboard of the little shop
    { id: 'cv', label: 'CV', guide: true },                             // balcony door: the CV comes out
    { id: 'contact', label: 'Contact', guide: true },                   // post box: one letter per contact
    { id: 'about', label: 'About me', guide: true },                    // window above the ramen shop: LED message board
];

// Colours of the drinks in the vending machine, slot 01..08 (same as the model)
const SLOT_COLORS = ['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#8ac926', '#ff70a6', '#7b5cd6', '#ffd23f'];
const BOTTLES = 8;
const LETTERS = ['email', 'linkedin', 'github'];

const FLY_TIME = 1.4;         // seconds
const DESIGN_ASPECT = 16 / 9; // aspect the Blender cameras were framed for

const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const clean = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const slot = (i) => String(i + 1).padStart(2, '0');

let root = null;
let ui = null;          // DOM references, built once
let data = null;        // content read from the minimal view
let renderer = null;
let scene = null;
let camera = null;
let modelReady = false;
let active = false;
let dirty = true;       // render only when something changed
const views = {};       // id -> { position, quaternion, fov }
const anchors = {};     // animation targets (empties), world positions
let pins = [];
let focused = null;
let hovered = null;     // hotspot hovered in the start view
let hoveredItem = null; // item hovered in a close-up
let flight = null;      // { from, to, start, done }
let overlayClose = null;

// ---------------------------------------------------------------- content from the page

function firstSentences(text, count = 2) {
    const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.slice(0, count).join(' ').trim();
}

function readData() {
    const portfolio = window.Portfolio || {};
    const about = document.getElementById('about-data');
    const cvLink = document.getElementById('download-btn');
    return {
        projects: (portfolio.projects || []).slice(0, BOTTLES),
        education: Array.from(document.querySelectorAll('#education-data li')).map(li => ({
            title: clean(li.querySelector('.edu-title')),
            level: clean(li.querySelector('.edu-level')),
            school: clean(li.querySelector('.edu-school')),
            when: clean(li.querySelector('.edu-when')),
        })),
        skills: Array.from(document.querySelectorAll('#skills-data .skill-tag1')).map(clean),
        contacts: Array.from(document.querySelectorAll('#contact-data a')).map(a => {
            const href = a.getAttribute('href');
            return {
                label: a.dataset.label || clean(a),
                href,
                value: href.replace(/^mailto:/, '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
                email: href.startsWith('mailto:'),
            };
        }),
        role: clean(document.querySelector('.hero-role')),
        name: clean(document.querySelector('#classic-view h1')) || 'Jacopo Simonini',
        photo: document.querySelector('.profile-pic')?.getAttribute('src') || '',
        // the about text, minus the sentences about the style switch (not needed in here)
        aboutFull: (about ? about.textContent : '').split(/\n+/)
            .map(par => (par.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+/g) || [])
                .filter(sentence => !/switch|different view/i.test(sentence)).join(' ').trim())
            .filter(Boolean),
        phrases: (portfolio.phrases || []).slice(),
        about: firstSentences(about ? about.textContent : ''),
        cv: { href: cvLink.getAttribute('href'), file: cvLink.getAttribute('download') || 'cv.pdf' },
    };
}

/** The letter for a contact: matched by its label (Email, LinkedIn, GitHub). */
const contactFor = (letter) => data.contacts.find(c => c.label.toLowerCase().replace(/\s/g, '') === letter);

// ---------------------------------------------------------------- close-up cards (hint + buttons)

function pickButton(id, index, html, enabled = true) {
    return `<li><button type="button" class="nv-pick" data-pick="${id}:${index}"${enabled ? '' : ' disabled'}>${html}</button></li>`;
}

function buildPanels() {
    const projects = Array.from({ length: BOTTLES }, (_, i) => {
        const p = data.projects[i];
        const tag = `<span class="nv-slot" style="--c: ${SLOT_COLORS[i]}">${slot(i)}</span>`;
        return p
            ? pickButton('projects', i, `${tag}<span>${esc(p.title)}</span>`)
            : pickButton('projects', i, `${tag}<span>Sold out</span>`, false);
    }).join('');

    const books = data.education.slice(0, 3)
        .map((e, i) => pickButton('education', i, `<span class="nv-slot" style="--c: var(--accent-color)">${slot(i)}</span><span>${esc(e.title)}</span>`))
        .join('');

    const letters = LETTERS.map((name, i) => {
        const c = contactFor(name);
        return c ? pickButton('contact', i, `<span>${esc(c.label)}</span>`) : '';
    }).join('');

    const skills = data.skills.map(s => `<li>${esc(s)}</li>`).join('');

    return `
        <article data-panel="projects" hidden>
            <p class="nv-kicker">// プロジェクト</p>
            <h2>Projects</h2>
            <p class="nv-hint-text">Pick a drink: every one is a project.</p>
            <ul class="nv-picks nv-picks-grid">${projects}</ul>
        </article>

        <article data-panel="education" hidden>
            <p class="nv-kicker">// 教育</p>
            <h2>Education</h2>
            <p class="nv-hint-text">Pick a book: one for each degree.</p>
            <ul class="nv-picks">${books}</ul>
        </article>

        <article data-panel="skills" hidden>
            <p class="nv-kicker">// スキル</p>
            <h2>Skills</h2>
            <p class="nv-hint-text">Written on the board, in chalk.</p>
            <ul class="nv-chips">${skills}</ul>
        </article>

        <article data-panel="cv" hidden>
            <p class="nv-kicker">// 履歴書</p>
            <h2>CV</h2>
            <p class="nv-hint-text">The door is open: grab the sheet.</p>
            <ul class="nv-picks">${pickButton('cv', 0, '<span>Read the CV</span>')}</ul>
        </article>

        <article data-panel="about" hidden>
            <p class="nv-kicker">// 自己紹介</p>
            <h2>About me</h2>
            <p class="nv-hint-text">The light is on: read the sign.</p>
            <ul class="nv-picks">${pickButton('about', 0, '<span>Read about me</span>')}</ul>
        </article>

        <article data-panel="contact" hidden>
            <p class="nv-kicker">// 連絡</p>
            <h2>Contact</h2>
            <p class="nv-hint-text">Pick a letter from the box.</p>
            <ul class="nv-picks">${letters}</ul>
        </article>`;
}

// ---------------------------------------------------------------- pop-up with the details

function projectDetails(i) {
    const p = data.projects[i];
    const tags = (p.tags || []).map(t => `<li>${esc(t)}</li>`).join('');
    return {
        kicker: `// プロジェクト ${slot(i)}`,
        title: p.title,
        html: `${tags ? `<ul class="nv-chips">${tags}</ul>` : ''}
            <p>${esc(p.desc)}</p>
            <div class="nv-ov-actions">
                <a class="nv-button" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">View on GitHub</a>
            </div>`,
    };
}

function educationDetails(i) {
    const e = data.education[i];
    return {
        kicker: `// 教育 ${slot(i)}`,
        title: e.title,
        html: `<p class="nv-ov-lead">${esc(e.level)}</p>
            <p>${esc(e.school)}</p>
            <p class="nv-ov-when">${esc(e.when)}</p>`,
    };
}

function contactDetails(letter) {
    const c = contactFor(letter);
    const actions = c.email
        ? `<a class="nv-button" href="${esc(c.href)}">Write an email</a>
           <button type="button" class="nv-ghost" data-copy="${esc(c.value)}">Copy address</button>`
        : `<a class="nv-button" href="${esc(c.href)}" target="_blank" rel="noopener noreferrer">Open ${esc(c.label)}</a>`;
    return {
        kicker: '// 連絡',
        title: c.label,
        html: `<p class="nv-ov-lead">${esc(c.value)}</p><div class="nv-ov-actions">${actions}</div>`,
    };
}

function aboutDetails() {
    const photo = data.photo ? `<img class="nv-ov-photo" src="${esc(data.photo)}" alt="" width="72" height="72">` : '';
    return {
        kicker: '// 自己紹介',
        title: data.name,
        html: `<div class="nv-ov-about">${photo}<p class="nv-ov-lead">${esc(data.role)}</p></div>
            ${data.aboutFull.map(par => `<p>${esc(par)}</p>`).join('')}`,
    };
}

function cvDetails() {
    return {
        kicker: '// 履歴書',
        title: 'Curriculum Vitae',
        html: `<p>${esc(data.role)}. ${esc(data.about)}</p>
            <div class="nv-ov-actions">
                <a class="nv-button" href="${esc(data.cv.href)}" download="${esc(data.cv.file)}">Download CV</a>
                <a class="nv-ghost" href="${esc(data.cv.href)}" target="_blank" rel="noopener noreferrer">View PDF</a>
            </div>`,
    };
}

/** Show the pop-up; `onClose` runs once it is closed (puts the item back). */
function openOverlay({ kicker, title, html }, onClose) {
    if (overlayClose) closeOverlay();
    ui.ovKicker.textContent = kicker;
    ui.ovTitle.textContent = title;
    ui.ovBody.innerHTML = html;
    ui.overlay.hidden = false;
    ui.stage.classList.add('nv-overlay-open');
    overlayClose = onClose || (() => {});
    ui.ovClose.focus({ preventScroll: true });
}

function closeOverlay() {
    if (!overlayClose) return;
    const done = overlayClose;
    overlayClose = null;
    ui.overlay.hidden = true;
    ui.stage.classList.remove('nv-overlay-open');
    done();
    if (focused) ui.back.focus({ preventScroll: true });
}

function copyText(button) {
    const value = button.dataset.copy;
    const ok = () => {
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = 'Copy address'; }, 2000);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(value).then(ok).catch(() => {});
}

// ---------------------------------------------------------------- DOM

function buildDOM() {
    // The name from the minimal view's heading, one word per line
    const name = esc(clean(document.querySelector('#classic-view h1')) || 'Jacopo Simonini').split(' ').join('<br>');
    root.innerHTML = `
        <div class="nv-stage nv-pins-hidden">
            <div class="nv-canvas"></div>

            <div class="nv-loader">
                <div class="nv-bar"><span></span></div>
                <p>Loading the street<span class="nv-dots"></span></p>
            </div>

            <div class="nv-hero">
                <p class="nv-kicker" lang="ja">// ジャコポの街</p>
                <h1 class="nv-title">${name}</h1>
                <p class="nv-hint">Click a marker to explore</p>
            </div>

            <div class="nv-tip" hidden></div>

            <div class="nv-card" hidden>
                <button type="button" class="nv-back" aria-label="Back to the start view">
                    <span aria-hidden="true">←</span> Back
                </button>
                ${buildPanels()}
            </div>

            <div class="nv-overlay" hidden>
                <div class="nv-ov-card" role="dialog" aria-modal="true" aria-labelledby="nv-ov-title">
                    <button type="button" class="nv-ov-close" aria-label="Close">×</button>
                    <p class="nv-kicker nv-ov-kicker"></p>
                    <h2 id="nv-ov-title"></h2>
                    <div class="nv-ov-body"></div>
                </div>
            </div>
        </div>`;

    ui = {
        stage: root.querySelector('.nv-stage'),
        canvasBox: root.querySelector('.nv-canvas'),
        loader: root.querySelector('.nv-loader'),
        loaderText: root.querySelector('.nv-loader p'),
        progress: root.querySelector('.nv-bar span'),
        card: root.querySelector('.nv-card'),
        back: root.querySelector('.nv-back'),
        tip: root.querySelector('.nv-tip'),
        overlay: root.querySelector('.nv-overlay'),
        ovKicker: root.querySelector('.nv-ov-kicker'),
        ovTitle: root.querySelector('#nv-ov-title'),
        ovBody: root.querySelector('.nv-ov-body'),
        ovClose: root.querySelector('.nv-ov-close'),
    };
    ui.back.addEventListener('click', goHome);
    ui.ovClose.addEventListener('click', closeOverlay);
    ui.overlay.addEventListener('click', (e) => {
        if (e.target === ui.overlay) closeOverlay(); // click on the dimmed backdrop
        const copy = e.target.closest('[data-copy]');
        if (copy) copyText(copy);
    });
    // The card's buttons do the same as clicking the items (keyboard, small screens)
    ui.card.addEventListener('click', (e) => {
        const button = e.target.closest('[data-pick]');
        if (!button) return;
        const [id, index] = button.dataset.pick.split(':');
        HOTSPOTS.find(h => h.id === id)?.items?.[Number(index)]?.pick();
    });
}

// ---------------------------------------------------------------- animation helpers

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t;
const easeBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2; // slight overshoot

const tweens = new Set();
const idles = new Map(); // name -> fn(now), run every frame (gentle bobbing)

/** Animate `update(t)` from t=0 to 1; resolves when done. Starting a new tween on the same
    target cancels the old one. With reduced motion it jumps straight to the end. */
function tween(target, duration, update, { ease = easeInOut, delay = 0 } = {}) {
    for (const tw of tweens) {
        if (tw.target === target) {
            tweens.delete(tw);
            tw.resolve();
        }
    }
    return new Promise((resolve) => {
        if (reduceMotion() || !duration) {
            update(1);
            dirty = true;
            resolve();
            return;
        }
        tweens.add({ target, update, ease, resolve, start: performance.now() + delay * 1000, duration: duration * 1000 });
        dirty = true;
    });
}

function stepTweens(now) {
    for (const tw of tweens) {
        if (now < tw.start) continue;
        const t = Math.min((now - tw.start) / tw.duration, 1);
        tw.update(tw.ease(t));
        if (t === 1) {
            tweens.delete(tw);
            tw.resolve();
        }
    }
    if (tweens.size) dirty = true;
}

const sleep = (seconds) => new Promise(r => setTimeout(r, reduceMotion() ? 0 : seconds * 1000));

/** Wrap a movable node in a group placed at `point`, so it turns / scales around that point. */
function makePivot(node, point) {
    const pivot = new THREE.Group();
    pivot.position.copy(point);
    node.parent.add(pivot);
    pivot.add(node);
    node.position.sub(point);
    pivot.userData.home = {
        position: pivot.position.clone(),
        quaternion: pivot.quaternion.clone(),
    };
    return pivot;
}

const centreOf = (node) => new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());

/** Quaternion that turns an item so its front (local `front` direction) faces the camera. */
function facingCamera(pivot, front, cameraPos) {
    const home = pivot.userData.home;
    const worldFront = front.clone().applyQuaternion(home.quaternion).normalize();
    const toCamera = cameraPos.clone().sub(home.position).normalize();
    return new THREE.Quaternion().setFromUnitVectors(worldFront, toCamera).multiply(home.quaternion);
}

function resetPivot(pivot) {
    const { position, quaternion } = pivot.userData.home;
    pivot.position.copy(position);
    pivot.quaternion.copy(quaternion);
    pivot.scale.setScalar(1);
    pivot.visible = true;
}

// ---------------------------------------------------------------- the interactive close-ups

/** Each item: { pivot, label, enabled, pick() }. Picking while another one is busy is ignored. */
let busy = false;

function setupItems(model) {
    const node = (name) => model.getObjectByName(name);
    const anchor = (name) => {
        const n = node(name);
        return n ? n.getWorldPosition(new THREE.Vector3()) : null;
    };
    anchors.bottleDrop = anchor('bottle_drop');
    anchors.letterSlot = anchor('letter_slot');
    anchors.paperStart = anchor('cv_paper_start');
    const hs = (id) => HOTSPOTS.find(h => h.id === id);

    // --- Vending machine: the drinks
    const projects = hs('projects');
    projects.items = Array.from({ length: BOTTLES }, (_, i) => {
        const n = node(`bottle_${slot(i)}`);
        const pivot = makePivot(n, centreOf(n));
        const enabled = i < data.projects.length;
        const item = {
            pivot,
            enabled,
            label: enabled ? data.projects[i].title : 'Sold out',
            pick: () => enabled && dropBottle(item, i),
        };
        if (!enabled) tintItem(item, new THREE.Color(0.3, 0.3, 0.34)); // greyed out
        return item;
    });

    // --- Post box: the letters (start inside the box, come out in the close-up)
    const contact = hs('contact');
    contact.items = LETTERS.map((name, i) => {
        const n = node(`letter_${name}`);
        const pivot = makePivot(n, centreOf(n));
        const c = contactFor(name);
        const item = { pivot, enabled: !!c, label: c ? c.label : '', pick: () => c && pickLetter(item, name) };
        hideInSlot(item);
        return item;
    });
    contact.onFocus = () => lettersOut(contact);
    contact.onBlur = () => lettersIn(contact);

    // --- Book cart: one book per degree
    const education = hs('education');
    education.items = [1, 2, 3].map((n, i) => {
        const bookNode = node(`book_${n}`);
        const pivot = makePivot(bookNode, centreOf(bookNode));
        const e = data.education[i];
        const item = { pivot, enabled: !!e, label: e ? e.title : '', pick: () => e && pickBook(item, i) };
        if (!e) tintItem(item, new THREE.Color(0.35, 0.35, 0.38));
        return item;
    });
    education.onFocus = () => wiggleBooks(education);
    education.onBlur = () => education.items.forEach(item => goBack(item.pivot));
    projects.onBlur = () => projects.items.forEach(item => {
        if (!item.pivot.visible) resetPivot(item.pivot); // the one in the pickup slot
        goBack(item.pivot);
    });

    // --- CV: the door (hinged on its right edge) and the sheet that floats out
    const cv = hs('cv');
    const doorNode = node('cv_door');
    const doorBox = new THREE.Box3().setFromObject(doorNode);
    const hinge = new THREE.Vector3(doorBox.max.x, (doorBox.min.y + doorBox.max.y) / 2, (doorBox.min.z + doorBox.max.z) / 2);
    cv.door = makePivot(doorNode, hinge);
    const paperNode = node('cv_paper');
    const paper = makePivot(paperNode, centreOf(paperNode));
    const paperItem = { pivot: paper, enabled: true, label: 'Curriculum Vitae', pick: () => pickPaper(cv, paperItem) };
    cv.items = [paperItem];
    hidePaper(cv);
    cv.onFocus = () => openDoor(cv);
    cv.onBlur = () => closeDoor(cv);

    // --- Chalkboard: the skills are written on it
    const skills = hs('skills');
    skills.board = makeChalkBoard(node('skills_text'));
    skills.onFocus = () => writeSkills(skills);
    skills.onBlur = () => eraseSkills(skills);

    // --- About me: the light comes on, the curtains open, the LED board scrolls
    setupAbout(hs('about'), node);

    // Every item belongs to its hotspot (clicking it from the start view opens the close-up)
    for (const h of HOTSPOTS) {
        for (const item of h.items || []) {
            item.base = item.base || new THREE.Color(1, 1, 1);
            // the first pick in a close-up means the visitor has found out: the guide goes away
            const pick = item.pick;
            item.pick = () => {
                if (item.enabled && !busy && focused === h) learned(h);
                return pick();
            };
            item.pivot.traverse((o) => {
                if (!o.isMesh) return;
                o.userData.hotspot = h;
                o.userData.item = item;
            });
        }
    }
}

function tintItem(item, color) {
    item.base = color;
    item.pivot.traverse((o) => {
        if (o.isMesh) o.material.color.copy(color);
    });
}

// --- vending machine ---------------------------------------------

async function dropBottle(item, i) {
    if (busy || !focused) return;
    const h = focused;
    busy = true;
    setHoveredItem(null);
    const p = item.pivot;
    const start = p.position.clone();
    const out = start.clone().add(new THREE.Vector3(-0.18, 0.02, 0)); // released towards the glass
    await tween(p, 0.28, (t) => p.position.lerpVectors(start, out, t), { ease: easeOut });
    if (focused !== h) return;
    const drop = anchors.bottleDrop || out.clone().setY(0.4);
    const fallFrom = p.position.clone();
    const spin = p.quaternion.clone();
    const tumble = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0.4).normalize(), 1.6).multiply(spin);
    await tween(p, 0.55, (t) => {
        p.position.set(
            THREE.MathUtils.lerp(fallFrom.x, drop.x, t),
            THREE.MathUtils.lerp(fallFrom.y, drop.y, t * t), // falls faster and faster
            THREE.MathUtils.lerp(fallFrom.z, drop.z, t),
        );
        p.quaternion.slerpQuaternions(spin, tumble, t);
    }, { ease: (t) => t });
    if (focused !== h) return;
    p.visible = false; // in the pickup slot
    openOverlay(projectDetails(i), () => {
        resetPivot(p);
        p.scale.setScalar(0.01);
        tween(p, 0.35, (t) => p.scale.setScalar(Math.max(t, 0.01)), { ease: easeBack }).then(() => { busy = false; });
    });
}

/** Move an item towards the camera (it already faces it) and a little bigger. */
function comeForward(p, distance) {
    const home = p.userData.home.position;
    const from = p.position.clone();
    const target = home.clone().add(camera.position.clone().sub(home).normalize().multiplyScalar(distance));
    return tween(p, 0.4, (t) => {
        p.position.lerpVectors(from, target, t);
        p.scale.setScalar(1 + 0.12 * t);
    }, { ease: easeOut });
}

/** Back to where it was, then the next item can be picked. */
function goBack(p) {
    const { position, quaternion } = p.userData.home;
    const from = p.position.clone();
    const rot = p.quaternion.clone();
    const scale = p.scale.x;
    return tween(p, 0.45, (t) => {
        p.position.lerpVectors(from, position, t);
        p.quaternion.slerpQuaternions(rot, quaternion, t);
        p.scale.setScalar(THREE.MathUtils.lerp(scale, 1, t));
    }).then(() => { busy = false; });
}

// --- post box --------------------------------------------------------

function hideInSlot(item) {
    const p = item.pivot;
    if (anchors.letterSlot) p.position.copy(anchors.letterSlot);
    p.scale.setScalar(0.01);
    p.visible = false;
    item.out = false;
}

/** Resolves once every letter is out (the guide's markers wait for that). */
function lettersOut(h) {
    return Promise.all(h.items.map((item, i) => {
        if (!item.enabled) return null;
        const p = item.pivot;
        const { position: home, quaternion } = p.userData.home;
        const from = anchors.letterSlot ? anchors.letterSlot.clone() : home.clone();
        p.visible = true;
        p.quaternion.copy(quaternion);
        return tween(p, 0.7, (t) => {
            p.position.lerpVectors(from, home, t);
            p.position.y += Math.sin(t * Math.PI) * 0.12; // a little arc out of the slot
            p.scale.setScalar(Math.max(t, 0.01));
        }, { ease: easeOut, delay: i * 0.18 }).then(() => {
            if (focused !== h) return; // left before it was out
            item.out = true;
            idles.set(`letter-${i}`, (now) => {
                if (busy && hoveredItem !== item) return;
                p.position.y = home.y + Math.sin(now / 650 + i * 1.7) * 0.012;
            });
        });
    }));
}

function lettersIn(h) {
    h.items.forEach((item, i) => {
        idles.delete(`letter-${i}`);
        const p = item.pivot;
        if (!p.visible) return;
        const from = p.position.clone();
        const to = anchors.letterSlot || from;
        tween(p, 0.35, (t) => {
            p.position.lerpVectors(from, to, t);
            p.scale.setScalar(Math.max(1 - t, 0.01));
        }, { ease: easeIn }).then(() => hideInSlot(item));
    });
}

async function pickLetter(item, name) {
    if (busy || !focused) return;
    if (!item.out) { // picked from the card before it came out: just show it
        openOverlay(contactDetails(name));
        return;
    }
    const h = focused;
    busy = true;
    setHoveredItem(null);
    await comeForward(item.pivot, 0.45);
    if (focused !== h) return;
    openOverlay(contactDetails(name), () => goBack(item.pivot));
}

// --- book cart -------------------------------------------------------

function wiggleBooks(h) {
    h.items.forEach((item, i) => {
        if (!item.enabled) return;
        const p = item.pivot;
        const home = p.userData.home.quaternion;
        const axis = new THREE.Vector3(0, 0, 1);
        tween(p, 0.6, (t) => {
            const angle = Math.sin(t * Math.PI * 2) * 0.06 * (1 - t);
            p.quaternion.copy(home).multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
        }, { delay: 0.15 * i, ease: (t) => t });
    });
}

async function pickBook(item, i) {
    if (busy || !focused) return;
    const h = focused;
    busy = true;
    setHoveredItem(null);
    const p = item.pivot;
    const home = p.userData.home;
    // The books face the street on the left (-x): slide out that way, under the canopy
    const face = facingCamera(p, new THREE.Vector3(-1, 0, 0), camera.position);
    const out = home.position.clone().add(new THREE.Vector3(-0.35, 0.03, 0));
    const target = out.clone().add(camera.position.clone().sub(out).normalize().multiplyScalar(0.55));
    await tween(p, 0.3, (t) => p.position.lerpVectors(home.position, out, t), { ease: easeOut });
    if (focused !== h) return;
    await tween(p, 0.45, (t) => {
        p.position.lerpVectors(out, target, t);
        p.quaternion.slerpQuaternions(home.quaternion, face, t);
    }, { ease: easeInOut });
    if (focused !== h) return;
    openOverlay(educationDetails(i), () => goBack(p));
}

// --- CV door ---------------------------------------------------------

const DOOR_OPEN = 0.8; // radians, opening outwards onto the balcony

function hidePaper(h) {
    const p = h.items[0].pivot;
    if (anchors.paperStart) p.position.copy(anchors.paperStart);
    p.scale.setScalar(0.01);
    p.visible = false;
    h.items[0].out = false;
}

async function openDoor(h) {
    const door = h.door;
    const closed = door.userData.home.quaternion;
    const open = closed.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), DOOR_OPEN));
    await tween(door, 0.7, (t) => door.quaternion.slerpQuaternions(closed, open, t), { ease: easeOut });
    if (focused !== h) return;
    const item = h.items[0];
    const p = item.pivot;
    const { position: home, quaternion } = p.userData.home;
    const from = anchors.paperStart ? anchors.paperStart.clone() : home.clone();
    p.visible = true;
    p.quaternion.copy(quaternion);
    await tween(p, 0.7, (t) => {
        p.position.lerpVectors(from, home, t);
        p.scale.setScalar(Math.max(t, 0.01));
    }, { ease: easeBack });
    if (focused !== h) return;
    item.out = true;
    idles.set('cv-paper', (now) => {
        if (busy) return;
        p.position.y = home.y + Math.sin(now / 700) * 0.015;
    });
}

async function closeDoor(h) {
    idles.delete('cv-paper');
    const p = h.items[0].pivot;
    if (p.visible) {
        const from = p.position.clone();
        const to = anchors.paperStart || from;
        await tween(p, 0.3, (t) => {
            p.position.lerpVectors(from, to, t);
            p.scale.setScalar(Math.max(1 - t, 0.01));
        }, { ease: easeIn });
        hidePaper(h);
    }
    const door = h.door;
    const from = door.quaternion.clone();
    tween(door, 0.5, (t) => door.quaternion.slerpQuaternions(from, door.userData.home.quaternion, t));
}

async function pickPaper(h, item) {
    if (busy || focused !== h) return;
    if (!item.out) {
        openOverlay(cvDetails());
        return;
    }
    busy = true;
    setHoveredItem(null);
    await comeForward(item.pivot, 0.5);
    if (focused !== h) return;
    openOverlay(cvDetails(), () => goBack(item.pivot));
}

// --- About me window ---------------------------------------------------

const LIGHT_OFF = 0.12; // how dark the room is with the light off (colour multiplier)

function setupAbout(h, node) {
    const edgePivot = (n, side) => {
        const box = new THREE.Box3().setFromObject(n);
        const c = box.getCenter(new THREE.Vector3());
        // curtains bunch up towards the outer edge of the window
        return makePivot(n, new THREE.Vector3(side < 0 ? box.min.x : box.max.x, c.y, c.z));
    };
    h.room = node('about_room');
    h.curtains = [edgePivot(node('about_curtain_l'), -1), edgePivot(node('about_curtain_r'), 1)];
    const boardNode = node('about_led');
    h.board = makePivot(boardNode, centreOf(boardNode));
    h.led = makeLed(node('about_led_face'));

    const item = { pivot: h.board, enabled: true, label: 'About me', pick: () => pickBoard(h, item) };
    // the guide's marker goes just above the lit dots, not above the chains
    const face = node('about_led_face');
    if (face) item.markAt = face.localToWorld(new THREE.Vector3(0, LED_H / 2 + 0.05, 0));
    h.items = [item];
    h.onFocus = () => lightsOn(h);
    h.onBlur = () => lightsOff(h);
    h.revealDuringFlight = true;
    resetAbout(h);
}

/** Light level of the room (walls, floor, the board's frame): 0 = off, 1 = on. */
function setRoomLight(h, level) {
    const k = THREE.MathUtils.lerp(LIGHT_OFF, 1, level);
    const color = new THREE.Color(k, k, k);
    h.room.traverse((o) => { if (o.isMesh) o.material.color.copy(color); });
    h.board.traverse((o) => { if (o.isMesh) o.material.color.copy(color); });
    h.items[0].base = color; // the hover tint starts from the current light
    dirty = true;
}

function resetAbout(h) {
    idles.delete('about-led');
    setRoomLight(h, 0);
    h.curtains.forEach(c => resetPivot(c));
    drawLed(h.led, null);
    h.ready = false;
}

/** A tube light starting: a few flickers, then on. */
const flicker = (t) => (t < 0.12 ? t / 0.12 * 0.8 : t < 0.2 ? 0.1 : t < 0.3 ? 0.9 : t < 0.38 ? 0.25 : Math.min(1, 0.6 + (t - 0.38) * 1.2));

async function lightsOn(h) {
    const light = tween(h.room, 0.6, (t) => setRoomLight(h, flicker(t)), { ease: (t) => t });
    const curtains = h.curtains.map(c => tween(c, 0.75, (t) => c.scale.set(1 - 0.72 * t, 1, 1), { ease: easeInOut, delay: 0.3 }));
    await light;
    if (focused !== h) return;
    startScrolling(h); // the board comes on with the light
    await Promise.all(curtains);
    if (focused !== h) return;
    h.ready = true;
}

async function lightsOff(h) {
    idles.delete('about-led');
    drawLed(h.led, null);
    await Promise.all(h.curtains.map(c => {
        const from = c.scale.x;
        return tween(c, 0.5, (t) => c.scale.set(THREE.MathUtils.lerp(from, 1, t), 1, 1));
    }));
    tween(h.room, 0.3, (t) => setRoomLight(h, 1 - t));
}

async function pickBoard(h, item) {
    if (busy || focused !== h) return;
    if (!h.ready) {
        openOverlay(aboutDetails());
        return;
    }
    busy = true;
    setHoveredItem(null);
    const p = item.pivot;
    const y = p.userData.home.position.y;
    // a little swing on its chains, then the details
    await tween(p, 0.45, (t) => { p.rotation.x = Math.sin(t * Math.PI * 2) * 0.12 * (1 - t); p.position.y = y; }, { ease: (t) => t });
    if (focused !== h) return;
    openOverlay(aboutDetails(), () => { busy = false; });
}

// --- LED message board (About me) ------------------------------------------

const LED_COLS = 96; // dots across
const LED_ROWS = 16; // dots down
const LED_W = 1.04; // metres, the lit area of the board
const LED_H = 0.22;
const LED_SPEED = 26; // dots per second

function makeLed(face) {
    if (!face) return null;
    const dot = 10; // px per dot
    const canvas = document.createElement('canvas');
    canvas.width = LED_COLS * dot;
    canvas.height = LED_ROWS * dot;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(LED_W, LED_H), new THREE.MeshBasicMaterial({ map: texture }));
    plane.position.z = 0.002;
    face.add(plane);
    return { canvas, ctx: canvas.getContext('2d'), texture, dot, message: null };
}

/** The message as a strip of dots (one boolean per dot, column by column). */
function ledMessage(text) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = `bold ${LED_ROWS - 3}px 'IBM Plex Mono', ui-monospace, monospace`;
    const width = Math.ceil(ctx.measureText(text).width) + LED_COLS; // + a blank screen between loops
    c.width = width;
    c.height = LED_ROWS;
    ctx.font = `bold ${LED_ROWS - 3}px 'IBM Plex Mono', ui-monospace, monospace`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, LED_ROWS / 2 + 1);
    const pixels = ctx.getImageData(0, 0, width, LED_ROWS).data;
    const lit = new Uint8Array(width * LED_ROWS);
    for (let i = 0; i < lit.length; i++) lit[i] = pixels[i * 4 + 3] > 110 ? 1 : 0;
    return { width, lit };
}

/** Draw the dots; `offset` scrolls the message, `null` = board off. */
function drawLed(led, offset) {
    if (!led) return;
    const { ctx, canvas, dot } = led;
    ctx.fillStyle = '#0b0806';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const m = led.message;
    for (let x = 0; x < LED_COLS; x++) {
        for (let y = 0; y < LED_ROWS; y++) {
            const on = offset !== null && m && m.lit[y * m.width + ((x + offset) % m.width)];
            ctx.fillStyle = on ? '#ffb020' : offset === null ? '#1a120a' : '#2a1a0a';
            ctx.fillRect(x * dot + 2, y * dot + 2, dot - 3, dot - 3);
        }
    }
    led.texture.needsUpdate = true;
    dirty = true;
}

/** The board scrolls "Hi, I'm …" and the site's typewriter phrases, from right to left. */
function startScrolling(h) {
    const led = h.led;
    if (!led) return;
    const first = data.name.split(' ')[0];
    const ask = h.learned ? '' : '  >> CLICK ME <<'; // until the board has been clicked once
    const text = `Hi, I'm ${first}!${ask}  *  ${data.phrases.join('  *  ')}  *  `;
    if (led.text !== text) {
        led.text = text;
        led.message = ledMessage(text);
    }
    const start = performance.now();
    let shown = -1;
    idles.set('about-led', (now) => {
        const offset = Math.floor((now - start) / 1000 * LED_SPEED) % led.message.width;
        if (offset !== shown) {
            shown = offset;
            drawLed(led, offset);
        }
    });
}

// --- chalkboard ------------------------------------------------------

const BOARD_W = 0.64; // metres: the writing area below the board's header
const BOARD_H = 0.78;

function makeChalkBoard(face) {
    if (!face) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.round(512 * BOARD_H / BOARD_W);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(BOARD_W, BOARD_H),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    plane.position.set(0, -0.12, 0.003); // below the "SKILLS" header, just off the board
    face.add(plane);
    return { canvas, ctx: canvas.getContext('2d'), texture, written: 0 };
}

/** Draw the first `chars` characters of the skills list, like chalk. */
function drawChalk(board, chars) {
    const { canvas, ctx } = board;
    const lines = data.skills;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const size = Math.min(54, canvas.height / (lines.length + 1.2));
    ctx.font = `600 ${size}px 'IBM Plex Sans', system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(246, 240, 226, 0.92)';
    ctx.shadowColor = 'rgba(246, 240, 226, 0.35)';
    ctx.shadowBlur = 3;
    let left = chars;
    lines.forEach((line, i) => {
        if (left <= 0) return;
        const text = `・${line}`.slice(0, left);
        left -= line.length + 1;
        ctx.fillText(text, canvas.width * 0.06, size * (i + 0.9));
    });
    board.texture.needsUpdate = true;
    dirty = true;
}

function writeSkills(h) {
    const board = h.board;
    if (!board) return;
    const total = data.skills.reduce((n, s) => n + s.length + 1, 0);
    tween(board, Math.min(2.4, total * 0.035), (t) => drawChalk(board, Math.round(t * total)), { ease: (t) => t });
}

function eraseSkills(h) {
    if (!h.board) return;
    tween(h.board, 0, () => drawChalk(h.board, 0));
}

// ---------------------------------------------------------------- three.js setup

function setupRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    ui.canvasBox.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);

    const canvas = renderer.domElement;
    canvas.addEventListener('pointermove', (e) => {
        if (!modelReady || flight || overlayClose) return;
        if (focused) {
            setHoveredItem(pickItem(e, true), e);
        } else {
            setHovered(pickHotspot(e));
        }
    });
    canvas.addEventListener('pointerleave', () => {
        setHovered(null);
        setHoveredItem(null);
    });
    canvas.addEventListener('click', (e) => {
        if (!modelReady || flight || overlayClose) return;
        if (focused) {
            const item = pickItem(e);
            if (item) item.pick();
        } else {
            const h = pickHotspot(e);
            if (h) focusOn(h);
        }
    });

    new ResizeObserver(resize).observe(ui.canvasBox);
    window.addEventListener('keydown', (e) => {
        if (!active || e.key !== 'Escape') return;
        if (overlayClose) closeOverlay();
        else goHome();
    });
}

function loadModel() {
    new GLTFLoader().load(
        MODEL_URL,
        (gltf) => {
            const model = gltf.scene;
            const maxAniso = renderer.capabilities.getMaxAnisotropy();
            model.traverse((o) => {
                if (!o.isMesh) return;
                const map = o.material.map;
                map.anisotropy = Math.min(8, maxAniso); // keeps the signs crisp at grazing angles
                o.material = new THREE.MeshBasicMaterial({ map }); // lighting is baked in
            });
            scene.add(model);
            model.updateMatrixWorld(true);

            for (const id of ['home', ...HOTSPOTS.map(h => h.id)]) views[id] = readView(model, `cam_${id}`);
            applyView(views.home);

            for (const h of HOTSPOTS) {
                h.anchor = model.getObjectByName(`hotspot_${h.id}`).getWorldPosition(new THREE.Vector3());
                h.object = model.getObjectByName(h.id);
                h.object.traverse((o) => {
                    if (o.isMesh) o.userData.hotspot = h;
                });
            }
            try {
                setupItems(model);
            } catch (err) {
                // the street still works (markers, close-ups), just without the interactive items
                console.error('3D street: the interactive items could not be set up', err);
                for (const h of HOTSPOTS) {
                    h.items = [];
                    h.onFocus = h.onBlur = null;
                }
            }
            model.updateMatrixWorld(true);
            createPins();
            modelReady = true;
            resize();
            setPinsVisible(true);
            ui.loader.classList.add('nv-hidden');
        },
        (xhr) => {
            if (xhr.lengthComputable) {
                ui.progress.classList.add('nv-determinate');
                ui.progress.style.width = `${(xhr.loaded / xhr.total) * 100}%`;
            }
        },
        (err) => {
            console.error(err);
            ui.loaderText.textContent = 'Could not load the 3D street.';
        }
    );
}

/** Camera exported from Blender -> world position, rotation and vertical fov. */
function readView(model, name) {
    let cam = null;
    model.getObjectByName(name).traverse((o) => {
        if (!cam && o.isCamera) cam = o;
    });
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    cam.matrixWorld.decompose(position, quaternion, new THREE.Vector3());
    return { position, quaternion, fov: cam.fov };
}

// ---------------------------------------------------------------- camera

/** Keep the designed horizontal framing on screens narrower than 16:9 (phones). */
function fitFov(fov) {
    if (camera.aspect >= DESIGN_ASPECT) return fov;
    const half = THREE.MathUtils.degToRad(fov / 2);
    return THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(half) * DESIGN_ASPECT) / camera.aspect));
}

function applyView(view) {
    camera.position.copy(view.position);
    camera.quaternion.copy(view.quaternion);
    camera.userData.fov = view.fov;
    camera.fov = fitFov(view.fov);
    camera.updateProjectionMatrix();
    dirty = true;
}

/** Fly the camera to `view`; `done` runs on arrival. */
function flyTo(view, done) {
    if (reduceMotion()) {
        applyView(view);
        if (!focused) setPinsVisible(true);
        done?.();
        return;
    }
    flight = {
        from: { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.userData.fov },
        to: view,
        start: performance.now(),
        done,
    };
    setPinsVisible(false);
}

function stepFlight(now) {
    const t = Math.min((now - flight.start) / (FLY_TIME * 1000), 1);
    const e = easeInOut(t);
    const { from, to } = flight;
    camera.position.lerpVectors(from.position, to.position, e);
    camera.quaternion.slerpQuaternions(from.quaternion, to.quaternion, e);
    camera.userData.fov = THREE.MathUtils.lerp(from.fov, to.fov, e);
    camera.fov = fitFov(camera.userData.fov);
    camera.updateProjectionMatrix();
    dirty = true;
    if (t === 1) {
        const done = flight.done;
        flight = null;
        if (!focused) setPinsVisible(true);
        done?.();
    }
}

// ---------------------------------------------------------------- markers + cards

function createPins() {
    pins = HOTSPOTS.map((h) => {
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = h.side === 'left' ? 'nv-pin nv-pin-left' : 'nv-pin';
        pin.innerHTML = `<span class="nv-pin-dot" aria-hidden="true"></span><span class="nv-pin-label">${h.label}</span>`;
        pin.addEventListener('click', () => focusOn(h));
        pin.addEventListener('pointerenter', () => setHovered(h));
        pin.addEventListener('pointerleave', () => setHovered(null));
        ui.stage.appendChild(pin);
        return { h, pin };
    });
}

/** Pins are only shown at the start view, so they only need placing there. */
function placePins() {
    const { clientWidth: w, clientHeight: h } = ui.canvasBox;
    if (!pins.length || !w || !h) return false;
    // The camera's matrices are only refreshed when a frame is drawn: update them now,
    // or markers placed before the first frame would use a stale camera
    camera.updateMatrixWorld();
    const projected = new THREE.Vector3();
    for (const { h: spot, pin } of pins) {
        projected.copy(spot.anchor).project(camera);
        pin.style.transform = `translate(${((projected.x + 1) / 2) * w}px, ${((1 - projected.y) / 2) * h}px)`;
        pin.hidden = projected.z > 1; // behind the camera
    }
    return true;
}

function setPinsVisible(visible) {
    // Only show them once they could be placed (the view may still be hidden)
    const placed = visible && placePins();
    ui.stage.classList.toggle('nv-pins-hidden', !placed);
}

function focusOn(h) {
    if (flight || focused === h) return;
    focused = h;
    setHovered(null);
    for (const article of ui.card.querySelectorAll('[data-panel]')) {
        article.hidden = article.dataset.panel !== h.id;
    }
    ui.card.hidden = false;
    ui.stage.classList.add('nv-focused');
    // the guide starts once the close-up has finished opening (lights on, books wiggled...)
    const arrive = () => {
        if (focused === h) Promise.resolve(h.onFocus?.()).then(() => startGuide(h));
    };
    if (h.revealDuringFlight && !reduceMotion()) {
        // starts half-way through the flight, so it is already moving when the camera arrives
        flyTo(views[h.id]);
        setTimeout(arrive, FLY_TIME * 1000 * 0.5);
    } else {
        flyTo(views[h.id], arrive);
    }
    ui.back.focus({ preventScroll: true });
}

function goHome() {
    if (!focused) return;
    closeOverlay();
    const h = focused;
    focused = null;
    busy = false;
    stopGuide();
    setHoveredItem(null);
    h.onBlur?.();
    ui.card.hidden = true;
    ui.stage.classList.remove('nv-focused');
    flyTo(views.home);
}

// ---------------------------------------------------------------- hover + click

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const WHITE = new THREE.Color(1, 1, 1);
const HIGHLIGHT = new THREE.Color(1.25, 1.5, 0.85); // site-green tint multiplied over the texture

/** Visible, and so are all its parents (the ray-picking does not check this itself). */
function isShown(object) {
    for (let o = object; o; o = o.parent) if (!o.visible) return false;
    return true;
}

function raycast(e, objects) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(objects, true).find(hit => isShown(hit.object)) || null;
}

/** Start view: a hotspot's body or any of its items. */
function pickHotspot(e) {
    const objects = HOTSPOTS.flatMap(h => [h.object, ...(h.items || []).map(i => i.pivot)]).filter(Boolean);
    const hit = raycast(e, objects);
    return hit ? hit.object.userData.hotspot : null;
}

/** Close-up: only the focused hotspot's items that can be picked (`all`: sold-out ones too). */
function pickItem(e, all = false) {
    if (busy) return null;
    const items = (focused.items || []).filter(i => (all || i.enabled) && i.pivot.visible);
    const hit = raycast(e, items.map(i => i.pivot));
    return hit ? hit.object.userData.item : null;
}

function setHovered(h) {
    if (hovered === h) return;
    if (hovered) setHighlight(hovered, 0);
    hovered = h;
    ui.canvasBox.classList.toggle('nv-hovering', !!h);
    for (const { h: spot, pin } of pins) pin.classList.toggle('nv-active', spot === h);
    dirty = true;
}

/** Tint a hotspot's body towards the accent (amount 0 = original colours). */
function setHighlight(h, amount) {
    h.object.traverse((o) => {
        if (o.isMesh) o.material.color.lerpColors(WHITE, HIGHLIGHT, amount);
    });
}

function setHoveredItem(item, e) {
    const off = !!item && !item.enabled; // sold out: only its tip, no tint and no click
    const next = off ? null : item;
    if (hoveredItem && hoveredItem !== next) {
        const old = hoveredItem;
        old.pivot.traverse((o) => { if (o.isMesh) o.material.color.copy(old.base); });
    }
    hoveredItem = next;
    ui.canvasBox.classList.toggle('nv-hovering', !!next);
    if (item && e && item.label) {
        const rect = ui.stage.getBoundingClientRect();
        ui.tip.classList.toggle('nv-tip-off', off);
        ui.tip.textContent = item.label;
        ui.tip.style.transform = `translate(${e.clientX - rect.left + 14}px, ${e.clientY - rect.top + 14}px)`;
        ui.tip.hidden = false;
    } else {
        ui.tip.hidden = true;
    }
    dirty = true;
}

// ---------------------------------------------------------------- close-up guide
// A new visitor does not know the drinks, books, LED board, CV sheet and letters can be clicked.
// So these close-ups put a small marker above each item (tappable, for phones), every time they
// open. The first time, the items also light up one after another (a quick wave) and keep a
// faint breathing glow, until one of them is picked.

const GUIDE_WAVE = 0.7;   // seconds from the first item lighting up to the last
const GUIDE_PULSE = 0.5;  // seconds each item stays lit in the wave
const GUIDE_BREATH = 2.4; // seconds per breath of the glow after the wave
let guide = null;         // { h, start, glow, items: [{ item, delay, local, mark }] }
const markPoint = new THREE.Vector3();

function startGuide(h) {
    if (!h.guide || guide || focused !== h || !active) return;
    const items = (h.items || []).filter(i => i.enabled && i.pivot.visible);
    if (!items.length) return;
    guide = {
        h,
        start: performance.now(),
        glow: !h.learned,
        items: items.map((item, i) => {
            const delay = items.length > 1 ? (GUIDE_WAVE * i) / (items.length - 1) : 0;
            // the marker sits above the item's top (or its own point), and follows the item
            const box = new THREE.Box3().setFromObject(item.pivot);
            const top = item.markAt || new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
            const mark = document.createElement('button');
            mark.type = 'button';
            mark.className = 'nv-mark';
            mark.tabIndex = -1; // the card's buttons are the keyboard path
            mark.setAttribute('aria-hidden', 'true');
            mark.innerHTML = '<span class="nv-mark-dot"></span>';
            mark.addEventListener('click', () => item.pick());
            mark.addEventListener('pointerenter', (e) => { if (!busy) setHoveredItem(item, e); });
            mark.addEventListener('pointerleave', () => setHoveredItem(null));
            ui.stage.appendChild(mark);
            return { item, delay, local: item.pivot.worldToLocal(top.clone()), mark };
        }),
    };
    dirty = true;
}

/** Back to the items' own colours (the hovered one keeps its hover tint). */
function stopGlow() {
    if (!guide?.glow) return;
    guide.glow = false;
    for (const { item } of guide.items) {
        if (item !== hoveredItem) item.pivot.traverse((o) => { if (o.isMesh) o.material.color.copy(item.base); });
    }
    dirty = true;
}

function stopGuide() {
    if (!guide) return;
    stopGlow();
    for (const { mark } of guide.items) mark.remove();
    guide = null;
}

/** The visitor picked an item of `h`: no more glow there (and the LED board stops asking). */
function learned(h) {
    if (h.learned) return;
    h.learned = true;
    if (guide?.h === h) stopGlow();
    if (h.led && idles.has('about-led')) startScrolling(h);
}

function stepGuide(now) {
    const t = (now - guide.start) / 1000;
    const still = reduceMotion();
    const { clientWidth: w, clientHeight: hgt } = ui.canvasBox;
    for (const g of guide.items) {
        const { item, mark } = g;
        if (guide.glow && item !== hoveredItem) {
            let amount = 0.25; // reduced motion: a steady glow
            if (!still) {
                const k = (t - g.delay) / GUIDE_PULSE;  // this item's moment in the wave
                const breath = t - GUIDE_WAVE - GUIDE_PULSE; // after the whole wave
                amount = k > 0 && k < 1 ? Math.sin(k * Math.PI) * 0.8
                    : breath > 0 ? 0.22 * (0.5 - 0.5 * Math.cos((breath / GUIDE_BREATH) * Math.PI * 2))
                    : 0;
            }
            item.pivot.traverse((o) => { if (o.isMesh) o.material.color.copy(item.base).lerp(HIGHLIGHT, amount); });
        }
        markPoint.copy(g.local);
        item.pivot.localToWorld(markPoint).project(camera);
        mark.style.transform = `translate(${((markPoint.x + 1) / 2) * w}px, ${((1 - markPoint.y) / 2) * hgt}px)`;
        mark.hidden = busy || !item.pivot.visible || markPoint.z > 1;
    }
    if (guide.glow && !still) dirty = true;
}

// ---------------------------------------------------------------- loop

function resize() {
    if (!renderer) return;
    const { clientWidth: w, clientHeight: h } = ui.canvasBox;
    if (!w || !h) return; // hidden
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = fitFov(camera.userData.fov ?? camera.fov);
    camera.updateProjectionMatrix();
    if (pins.length && !focused && !flight) setPinsVisible(true);
    dirty = true;
}

function frame(now) {
    if (flight) stepFlight(now);
    stepTweens(now);
    if (idles.size && !reduceMotion()) {
        for (const fn of idles.values()) fn(now);
        dirty = true;
    }
    if (guide) stepGuide(now); // before the hover tint, which wins on the hovered item
    if (hovered) {
        setHighlight(hovered, 0.45 + 0.2 * Math.sin(now / 160));
        dirty = true;
    }
    if (hoveredItem) {
        const pulse = 0.35 + 0.15 * Math.sin(now / 160);
        hoveredItem.pivot.traverse((o) => {
            if (o.isMesh) o.material.color.copy(hoveredItem.base).lerp(HIGHLIGHT, pulse);
        });
        dirty = true;
    }
    if (dirty) {
        renderer.render(scene, camera);
        dirty = false;
    }
}

/** Put every item back where it starts (leaving the 3D style). */
function resetItems() {
    for (const tw of tweens) tw.resolve();
    tweens.clear();
    idles.clear();
    busy = false;
    for (const h of HOTSPOTS) {
        for (const item of h.items || []) {
            resetPivot(item.pivot);
            item.pivot.traverse((o) => { if (o.isMesh) o.material.color.copy(item.base); });
        }
        if (h.door) resetPivot(h.door);
    }
    const contact = HOTSPOTS.find(h => h.id === 'contact');
    contact.items?.forEach(hideInSlot);
    const cv = HOTSPOTS.find(h => h.id === 'cv');
    if (cv.items) hidePaper(cv);
    const skills = HOTSPOTS.find(h => h.id === 'skills');
    if (skills.board) drawChalk(skills.board, 0);
    const about = HOTSPOTS.find(h => h.id === 'about');
    if (about.room) resetAbout(about);
}

// ---------------------------------------------------------------- public API

export function enter(container) {
    active = true;
    if (!root) {
        root = container;
        data = readData();
        buildDOM();
        try {
            setupRenderer();
        } catch (err) {
            console.error(err);
            ui.loaderText.textContent = 'This browser cannot show the 3D street (WebGL is not available).';
            return;
        }
        loadModel();
    }
    if (!renderer) return;
    resize();
    dirty = true;
    renderer.setAnimationLoop(frame);
}

export function exit() {
    active = false;
    if (!renderer) return;
    renderer.setAnimationLoop(null); // nothing runs while another style is shown
    if (overlayClose) {
        overlayClose = null;
        ui.overlay.hidden = true;
        ui.stage.classList.remove('nv-overlay-open');
    }
    if (hovered) setHovered(null);
    stopGuide();
    setHoveredItem(null);
    if (focused) {
        // come back to the start view next time, without flying
        focused = null;
        ui.card.hidden = true;
        ui.stage.classList.remove('nv-focused');
    }
    flight = null;
    if (modelReady) resetItems();
    if (views.home) applyView(views.home);
    ui.stage.classList.add('nv-pins-hidden'); // placed again by resize() on the next enter
}
