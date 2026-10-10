// moon- solar (dark-light mode) logic
// --- Theme Toggle Logic ---
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const sunIcon = document.querySelector('.sun-icon');
const moonIcon = document.querySelector('.moon-icon');

// Apply a theme and keep the sun/moon icons in sync
function applyTheme(isDark) {
    document.body.classList.toggle('classic-dark', isDark);
    // Dark mode shows the sun (to switch to light); light mode shows the moon
    sunIcon.classList.toggle('hidden-icon', !isDark);
    moonIcon.classList.toggle('hidden-icon', isDark);
    themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

// Restore the saved theme on load (defaults to dark, matching the markup)
function readTheme() {
    try { return localStorage.getItem('theme'); } catch { return null; }
}

const savedTheme = readTheme();
applyTheme(savedTheme ? savedTheme === 'dark' : true);

// Flip to the opposite of the current theme and remember it.
// Used by the dock button and by the terminal's `theme` command.
function toggleTheme() {
    const isDark = !document.body.classList.contains('classic-dark');
    // Pause the CSS fades for one frame so every colour changes at once (see style.css)
    document.body.classList.add('theme-switching');
    applyTheme(isDark);
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('theme-switching')));
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch { /* storage blocked */ }
    return isDark;
}

themeToggleBtn.addEventListener('click', () => toggleTheme());


// --- Typewriter Effect Logic ---
const typewriterText = document.getElementById('typewriter-text');
const phrases = [
    "Tech Enthusiast",
    "Bachelor Graduate",
    "Problem Solver",
    "Linux Enthusiast",
    "Continuous Learner",
    "Building Digital Solutions" // You can add as many as you want here!
];

let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;

function typeEffect() {
    const currentPhrase = phrases[phraseIndex];
    
    // Update the text content
    if (isDeleting) {
        // Remove a character
        typewriterText.textContent = currentPhrase.substring(0, charIndex - 1);
        charIndex--;
    } else {
        // Add a character
        typewriterText.textContent = currentPhrase.substring(0, charIndex + 1);
        charIndex++;
    }

    // Determine typing speed (Deleting is usually faster than typing)
    let typeSpeed = isDeleting ? 40 : 100;

    // Logic for pausing and switching directions
    if (!isDeleting && charIndex === currentPhrase.length) {
        // Finished typing the word: Pause for 2 seconds before deleting
        typeSpeed = 2000; 
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        // Finished deleting the word: Move to the next phrase
        isDeleting = false;
        phraseIndex++;
        
        // Loop back to the first phrase if we reach the end of the list
        if (phraseIndex === phrases.length) {
            phraseIndex = 0;
        }
        
        // Pause for half a second before typing the new word
        typeSpeed = 700; 
    }

    // Call the function again after the calculated delay
    setTimeout(typeEffect, typeSpeed);
}

// Start the animation when the page loads (a static phrase if the visitor prefers less motion)
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (typewriterText) {
    // Reserve room for the longest phrase (+2 for the cursor and its margin) so the header never shifts while typing
    const longest = Math.max(...phrases.map(p => p.length));
    typewriterText.closest('.subtitle').style.setProperty('--typewriter-width', `${longest + 2}ch`);

    if (prefersReducedMotion) {
        typewriterText.textContent = phrases[0];
    } else {
        typeEffect();
    }
}



// Grab elements from the DOM
const styleButtons = document.querySelectorAll('.style-opt');
const classicView = document.getElementById('classic-view');
const terminalView = document.getElementById('terminal-view');

// --- 1. Project Grid Interaction Logic ---
// Grab the DOM elements
const projectBtns = document.querySelectorAll('.project-btn');
const infoBox = document.getElementById('project-info-box');
const infoTitle = document.getElementById('info-title');
const infoDesc = document.getElementById('info-desc');
const infoLink = document.getElementById('info-link');

// Add a click listener to every project button
projectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // 1. Check if the clicked button is ALREADY active
        const isAlreadyActive = btn.classList.contains('active-project');

        // 2. Clear all active highlights regardless of what happens next
        projectBtns.forEach(b => {
            b.classList.remove('active-project');
            b.setAttribute('aria-expanded', 'false');
        });

        if (isAlreadyActive) {
            // 3a. If it was already active, the user wants to close it. 
            // Hide the box and do nothing else.
            infoBox.classList.remove('visible');
        } else {
            // 3b. If it was NOT active, the user wants to open it.
            // Add the highlight to the clicked button
            btn.classList.add('active-project');
            btn.setAttribute('aria-expanded', 'true');

            // Extract data attributes and inject them into the rectangle
            infoTitle.textContent = btn.getAttribute('data-title');
            infoDesc.textContent = btn.getAttribute('data-desc');
            infoLink.href = btn.getAttribute('data-link');

            // Move the detail card directly below the clicked project
            btn.insertAdjacentElement('afterend', infoBox);

            // Make the rectangle visible
            infoBox.classList.add('visible');
        }
    });
});


// "Read more" on the featured cards swaps the summary for the full description
document.querySelectorAll('.project-card .read-more').forEach(btn => {
    btn.addEventListener('click', () => {
        const expanded = btn.closest('.project-card').classList.toggle('expanded');
        btn.textContent = expanded ? 'Show less' : 'Read more';
        btn.setAttribute('aria-expanded', String(expanded));
    });
});


// --- 2. Updated Dynamic Data Linking for the Terminal ---

// Every project, featured cards first, read the same way for the terminal and retro styles
const projects = Array.from(document.querySelectorAll('#featured-projects .project-card, #projects-grid .project-btn'))
    .map(el => ({
        title: el.getAttribute('data-title'),
        // Featured cards keep the long text in the page; the other rows keep it in data-desc
        desc: el.getAttribute('data-desc') || el.querySelector('.project-full')?.textContent.trim() || '',
        link: el.getAttribute('data-link'),
        featured: el.hasAttribute('data-featured'),
        tags: Array.from(el.querySelectorAll('.project-tags li')).map(li => li.textContent.trim())
    }));
const featuredProjects = projects.filter(p => p.featured);
const otherProjects = projects.filter(p => !p.featured);

const aboutDataElement = document.getElementById('about-data');
const skillNodes = document.querySelectorAll('#skills-data .skill-tag1');
const educationNodes = document.querySelectorAll('#education-data li');
const languageNodes = document.querySelectorAll('#languages-data li');
const contactNodes = document.querySelectorAll('#contact-data a');

// Help menu rows: [command, description]. The retro Terminal.exe adapts these to its own commands
const helpRows = [
    ['about', 'Show information about me'],
    ['skills', 'List my core technical skills'],
    ['education', 'Display my educational background'],
    ['projects', 'View my recent work and GitHub links'],
    ['more_info', 'View a brief description of the projects'],
    ['languages', 'List spoken languages'],
    ['contact', 'Get my contact information'],
    ['cv', 'Download my resume'],
    ['donut', 'Render a spinning 3D ASCII donut'],
    ['clear', 'Clear the terminal screen'],
    ['retro', 'Switch to the retro desktop style'],
    ['3d', 'Explore the 3D neon street'],
    ['exit', 'Return to the minimal view']
];

// Formatted Help Menu using CSS Grid for perfect mobile wrapping
function buildHelp(rows) {
    return `
<div style="margin-bottom: 0.5rem;">Available commands (press Tab to autocomplete):</div>
<div class="help-grid">
${rows.map(([name, desc]) => `    <span>${name}</span><span>- ${desc}</span>`).join('\n')}
</div>
`;
}

const dynamicHelp = buildHelp(helpRows);

const dynamicAbout = aboutDataElement.innerText;

const dynamicSkills = Array.from(skillNodes)
    .map(skill => `- ${skill.innerText}`)
    .join('<br>');

const dynamicEducation = Array.from(educationNodes)
    .map(edu => `- ${edu.innerText}`)
    .join('<br>');

const dynamicLanguages = Array.from(languageNodes)
    .map(lang => `- ${lang.innerHTML}`) // Using innerHTML to keep the bold <strong> tags
    .join('<br>');

const dynamicContact = Array.from(contactNodes)
    .map(link => {
        const url = link.getAttribute('href');
        const text = link.dataset.label || link.innerText.trim(); // .innerText ignores the SVG!
        
        // Assembles a clean string specifically for the terminal
        return `- <strong>${text}:</strong> <a href="${url}" target="_blank">[Open Link]</a>`;
    })
    .join('<br>');

// Terminal output: featured projects first, each group under its own heading
const projectGroups = (format, separator) => [
    ['Featured projects:', featuredProjects],
    ['More projects:', otherProjects]
]
    .filter(([, list]) => list.length)
    .map(([heading, list]) => `${heading}<br>${list.map(format).join(separator)}`)
    .join('<br><br>');

const dynamicProjects = projectGroups(
    p => `- <strong>${p.title}:</strong> <a href="${p.link}" target="_blank">[View on GitHub]</a>`,
    '<br>'
);

const dynamicProjectsInfo = projectGroups(
    p => `- <strong>${p.title}:</strong> ${p.desc} <a href="${p.link}" target="_blank">[View on GitHub]</a>`,
    '<br><br>'
);

// Update the commands dictionary
const commands = {
    help: dynamicHelp,
    about: dynamicAbout,
    skills: dynamicSkills,
    education: dynamicEducation,
    projects: dynamicProjects,
    more_info: dynamicProjectsInfo,
    languages: dynamicLanguages,
    contact: dynamicContact
};

// --- Tab completion, like a real shell ---
// Every command the terminals understand ('resume' is a hidden alias of 'cv', so it is left out)
const commandNames = [...Object.keys(commands), 'cv', 'donut', 'clear', 'retro', '3d', 'exit'].sort();

// One match: the full command. Several: their longest common prefix, plus the
// list of matches so the caller can print them when Tab adds nothing new.
// `extra` adds commands only one terminal has (e.g. 'minimal' in the retro Terminal.exe).
function completeCommand(text, extra = []) {
    const typed = text.trim().toLowerCase();
    const matches = [...commandNames, ...extra].sort().filter(name => name.startsWith(typed));
    if (!matches.length) return { value: text, matches };

    let prefix = matches[0];
    for (const name of matches) {
        while (!name.startsWith(prefix)) prefix = prefix.slice(0, -1);
    }
    return { value: prefix.length > typed.length ? prefix : text, matches };
}



// --- 3. Terminal view: a shell session, one command per section ---
// Built from the minimal view above, so the content lives in one place.

// Collapse the markup's whitespace so the terminal shows clean lines
const cleanText = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');

const escapeHTML = (text) => String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Small deterministic hash: the "commit hashes" of the education log never change
function hashString(text) {
    let h = 2166136261;
    for (const ch of text) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

const ASCII_NAME = "     _\n    | | __ _  ___ ___  _ __   ___\n _  | |/ _` |/ __/ _ \\| '_ \\ / _ \\\n| |_| | (_| | (_| (_) | |_) | (_) |\n \\___/ \\__,_|\\___\\___/| .__/ \\___/\n                      |_|\n  ____  _                       _       _\n / ___|(_)_ __ ___   ___  _ __ (_)_ __ (_)\n \\___ \\| | '_ ` _ \\ / _ \\| '_ \\| | '_ \\| |\n  ___) | | | | | | | (_) | | | | | | | | |\n |____/|_|_| |_| |_|\\___/|_| |_|_|_| |_|_|";
const ASCII_LOCK = "   .-----.\n  / .---. \\\n  | |   | |\n.-'-'---'-'-.\n|    .-.    |\n|    '-'    |\n|     |     |\n'-----------'";

const termBody = document.getElementById('tw-body');
const termClock = document.getElementById('tw-clock');
const fullName = cleanText(document.querySelector('#classic-view h1'));
const firstName = fullName.split(/\s+/)[0].toLowerCase();
const roleText = cleanText(document.querySelector('.hero-role'));
const cvLink = document.getElementById('download-btn');
const cvFile = cvLink.getAttribute('download') || 'cv.pdf';
const footerText = cleanText(document.querySelector('.minimal-footer'));
const pageStart = Date.now();

// Data in the shape the terminal needs, read from the same elements as above
const aboutParagraphs = aboutDataElement.textContent.split(/\n+/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
const skillData = Array.from(skillNodes).map(cleanText);
const educationData = Array.from(educationNodes).map(li => ({
    degree: cleanText(li.querySelector('.edu-title')),
    level: cleanText(li.querySelector('.edu-level')),
    school: cleanText(li.querySelector('.edu-school')),
    when: cleanText(li.querySelector('.edu-when'))
}));
const languageData = Array.from(languageNodes).map(li => ({
    name: cleanText(li.querySelector('.lang-name')).replace(/:$/, ''),
    level: cleanText(li.querySelector('.lang-level'))
}));
// One short line per project: the tagline (a featured card can set data-tagline),
// or else the first sentence of a featured card's summary
const projectLines = Array.from(document.querySelectorAll('#featured-projects .project-card, #projects-grid .project-btn'))
    .map(el => cleanText(el.querySelector('.project-tagline')) || el.dataset.tagline || (cleanText(el.querySelector('.project-summary')).match(/^.*?[.!?](\s|$)/) || [''])[0].trim());
const termProjects = projects.map((p, i) => ({ ...p, line: projectLines[i] || '' }));

const PROMPT_HTML = `<span class="t-grn">${firstName}@portfolio</span><span class="t-dim">:</span><span class="t-cyn">~</span><span class="t-dim">$</span>`;

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const prettyUrl = (href) => href.replace(/^mailto:/, '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const commitHash = (text) => hashString(text).toString(16).padStart(8, '0').slice(0, 7);

// A command line, e.g. "➜ ls -la ./projects" (the arrow is added by CSS)
const cmdLine = (program, flags = '', args = '') =>
    `<h2 class="t-cmd"><b>${program}</b>${flags ? ` <span class="t-flag">${flags}</span>` : ''}${args ? ` ${args}` : ''}</h2>`;

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h) return `${h}h ${m}m ${s % 60}s`;
    if (m) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

// One row of the ls -la listing: a real link, so it works with the keyboard
const projectRow = (p) => `
    <li><a class="t-proj" href="${escapeHTML(p.link)}" target="_blank" rel="noopener noreferrer" title="${escapeHTML(p.desc)}">
        <span class="t-perm" aria-hidden="true">drwxr-xr-x</span>
        <span class="t-name">${escapeHTML(slug(p.title))}</span>
        <span class="t-desc">${escapeHTML(p.line)}<span class="t-repo">${escapeHTML(prettyUrl(p.link))} <span class="t-arr" aria-hidden="true">➜ open</span></span></span>
    </a></li>`;

function buildTerminal() {
    const [current] = educationData;

    const contactCards = Array.from(contactNodes).map(link => {
        const href = link.getAttribute('href');
        const isMail = href.startsWith('mailto:');
        return {
            label: (link.dataset.label || cleanText(link)).toLowerCase(),
            value: prettyUrl(href),
            attrs: isMail ? '' : ' target="_blank" rel="noopener noreferrer"',
            href
        };
    });
    contactCards.push({ label: 'resume', value: 'download (pdf)', href: cvLink.getAttribute('href'), attrs: ` download="${escapeHTML(cvFile)}"` });

    const kv = (rows) => rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const nfRow = (k, v) => `<div class="t-nf-row"><dt>${k}</dt><dd>${v}</dd></div>`;

    termBody.innerHTML = `
        <section class="t-blk">
            ${cmdLine('whoami', '--verbose')}
            <div class="t-out">
                <h1 class="sr-only">${escapeHTML(fullName)}</h1>
                <div class="t-ascii-wrap"><pre class="t-ascii" aria-hidden="true">${escapeHTML(ASCII_NAME)}</pre></div>
                <p class="t-tag"><span class="t-grn">${escapeHTML(firstName)}</span> :: <span class="t-role" id="t-role" aria-hidden="true"></span><span class="t-cursor" aria-hidden="true"></span><span class="sr-only">${escapeHTML(phrases.join(', '))}</span></p>
                <dl class="t-kv">${kv([
                    ['role', escapeHTML(roleText)],
                    ['skills', escapeHTML(skillData.slice(0, 4).join(' · ').toLowerCase()) + (skillData.length > 4 ? ` <span class="t-dim">+ more</span>` : '')],
                    ['resume', `<a href="${escapeHTML(cvLink.getAttribute('href'))}" download="${escapeHTML(cvFile)}">${escapeHTML(cvFile)}</a>`]
                ])}</dl>
            </div>
        </section>

        <section class="t-blk">
            ${cmdLine('cat', '', './about.md')}
            <div class="t-out t-prose">${aboutParagraphs.map(p => `<p>${escapeHTML(p)}</p>`).join('')}</div>
        </section>

        <section class="t-blk">
            ${cmdLine('neofetch')}
            <div class="t-out">
                <div class="t-nf">
                    <pre class="t-nf-logo" aria-hidden="true">${escapeHTML(ASCII_LOCK)}</pre>
                    <dl class="t-nf-info">
                        <div class="t-nf-title"><span class="t-grn">${escapeHTML(firstName)}</span><span class="t-dim">@</span><span class="t-grn">portfolio</span></div>
                        ${nfRow('degree', escapeHTML(`${current.degree} (${current.when.toLowerCase()})`))}
                        ${nfRow('stack', escapeHTML(skillData.slice(0, 3).join(' / ').toLowerCase()))}
                        ${nfRow('languages', escapeHTML(languageData.map(l => l.name.toLowerCase()).join(', ')))}
                        ${nfRow('shell', 'interactive, see below')}
                        <div class="t-palette" aria-hidden="true">${['fg', 'red', 'grn', 'yel', 'cyn', 'mag', 'dim', 'line'].map(c => `<span style="background: var(--t-${c})"></span>`).join('')}</div>
                    </dl>
                </div>
            </div>
        </section>

        <section class="t-blk">
            ${cmdLine('ls', '', './skills')}
            <div class="t-out">
                <ul class="t-ls">${skillData.map(skill => `<li>${escapeHTML(skill.toLowerCase())}</li>`).join('')}</ul>
                <h3 class="t-h">languages</h3>
                <dl class="t-kv">${kv(languageData.map(l => [escapeHTML(l.name.toLowerCase()), escapeHTML(l.level)]))}</dl>
            </div>
        </section>

        <section class="t-blk">
            ${cmdLine('ls', '-la', './projects')}
            <div class="t-out">
                <h3 class="t-h">projects · ${termProjects.length} entries</h3>
                <ul class="t-projects">${termProjects.map(projectRow).join('')}</ul>
                <p class="t-comment"># type <span class="t-grn">more_info</span> in the shell below for the full descriptions</p>
            </div>
        </section>

        <section class="t-blk">
            ${cmdLine('git', 'log', '--oneline ./education')}
            <div class="t-out">
                <h3 class="t-h">education · ${educationData.length} entries</h3>
                <ol class="t-log">${educationData.map(e => `
                    <li class="t-commit">
                        <span class="t-hash" aria-hidden="true">${commitHash(e.degree + e.school)}</span>
                        <span class="t-commit-title">${escapeHTML(e.degree)}</span>
                        <span class="t-meta">${escapeHTML(`${e.level.toLowerCase()} · ${e.school} · ${e.when.toLowerCase()}`)}</span>
                    </li>`).join('')}
                </ol>
            </div>
        </section>

        <section class="t-blk">
            ${cmdLine('cat', '', './contact.txt')}
            <div class="t-out">
                <h3 class="t-h">get in touch</h3>
                <p class="t-comment"># write me an email, or download the resume.</p>
                <ul class="t-cards">${contactCards.map(c => `
                    <li><a class="t-card" href="${escapeHTML(c.href)}"${c.attrs}>
                        <span class="t-card-label">${escapeHTML(c.label)}</span>
                        <span class="t-card-value">${escapeHTML(c.value)}</span>
                    </a></li>`).join('')}
                </ul>
                <p class="t-foot">${escapeHTML(footerText)}</p>

                <h3 class="t-h t-h-shell">interactive shell</h3>
                <p class="t-comment"># type <span class="t-grn">help</span> and press Enter · Tab completes · try <span class="t-yel">donut</span>, <span class="t-yel">theme</span>, <span class="t-yel">retro</span></p>
                <div class="t-console" id="t-console">
                    <div id="terminal-output" aria-live="polite"></div>
                    <div class="t-line">
                        <label class="t-ps1" for="terminal-input">${PROMPT_HTML}</label>
                        <input type="text" id="terminal-input" autocomplete="off" autocapitalize="off" spellcheck="false">
                    </div>
                </div>
            </div>
        </section>`;
}

buildTerminal();

const terminalConsole = document.getElementById('t-console');
const terminalOutput = document.getElementById('terminal-output');
const terminalInput = document.getElementById('terminal-input');


// --- 4. The interactive shell ---
// The help lists the shared commands plus the ones only this shell has
const shellHelp = buildHelp(helpRows.flatMap(row => row[0] === 'clear'
    ? [['theme', 'Switch the light / dark theme'], ['history', 'Show the commands you typed'], row]
    : [row]))
    + `<span class="t-dim">also: whoami, pwd, date, echo</span>`;

const commandHistory = [];
let historyIndex = -1;

// Commands that only exist in this shell (the retro Terminal.exe has its own)
const shellCommands = {
    help: () => shellHelp,
    whoami: () => escapeHTML(firstName),
    pwd: () => `/home/${escapeHTML(firstName)}/portfolio`,
    date: () => escapeHTML(new Date().toString()),
    echo: (args) => escapeHTML(args.join(' ')),
    history: () => commandHistory.length
        ? commandHistory.map((c, i) => `${i + 1}&nbsp; ${escapeHTML(c)}`).join('<br>')
        : '<span class="t-dim">no history yet.</span>',
    theme: () => (toggleTheme() ? 'dark mode on.' : 'light mode on.'),
    cv: () => `<a href="${escapeHTML(cvLink.getAttribute('href'))}" download="${escapeHTML(cvFile)}">download ${escapeHTML(cvFile)}</a>`,
    sudo: () => `<span class="t-red">${escapeHTML(firstName)} is not in the sudoers file. This incident will be reported.</span>`
};
shellCommands.resume = shellCommands.cv;
const shellOnly = ['theme', 'history', 'minimal', 'whoami', 'pwd', 'date', 'echo', 'sudo'];

function printToTerminal(htmlContent, className = 't-res') {
    const line = document.createElement('div');
    line.className = className;
    line.innerHTML = htmlContent; // trusted output built from the page
    terminalOutput.appendChild(line);
    return line;
}

// Plain text, never parsed as HTML (used for anything the visitor typed)
function printTextToTerminal(text, className = 't-res') {
    const line = printToTerminal('', className);
    line.textContent = text;
    return line;
}

// Echo what was typed: the prompt is markup, the command is plain text
function echoCommand(text) {
    const line = printToTerminal(PROMPT_HTML, 't-echo');
    line.append(` ${text}`);
}

function scrollShell() {
    terminalConsole.scrollTop = terminalConsole.scrollHeight;
}

const SHELL_WELCOME = `welcome. type <span class="t-grn">help</span> and press Enter.`;

function resetShell() {
    stopMainDonut();
    terminalOutput.innerHTML = '';
    printToTerminal(SHELL_WELCOME);
}

function runCommand(raw) {
    const line = raw.trim();
    echoCommand(line);
    if (!line) return;

    const [first, ...args] = line.split(/\s+/);
    const name = first.toLowerCase();

    if (name === 'clear') {
        stopMainDonut();
        terminalOutput.innerHTML = '';
    } else if (name === 'exit' || name === 'minimal') {
        setView('classic');
    } else if (name === 'retro') {
        setView('retro');
    } else if (name === '3d') {
        setView('neon');
    } else if (name === 'donut') {
        stopMainDonut();
        const frame = printToTerminal('', 'donut-frame');
        frame.setAttribute('aria-hidden', 'true');
        stopDonutFn = renderDonut(frame);
        printToTerminal(`<span class="t-dim">type clear to stop.</span>`);
    } else if (shellCommands[name]) {
        printToTerminal(shellCommands[name](args));
    } else if (commands[name]) {
        printToTerminal(commands[name]);
    } else {
        printTextToTerminal(`command not found: ${first}. Type help for the list of commands.`, 't-res t-red');
    }
}

terminalInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const value = terminalInput.value;
        if (value.trim()) commandHistory.push(value.trim());
        historyIndex = commandHistory.length;
        terminalInput.value = '';
        runCommand(value);
        scrollShell();
    } else if (event.key === 'Tab' && terminalInput.value.trim()) {
        // Complete the command; when Tab adds nothing new, list the options.
        // Tab on an empty prompt still moves the focus on, for keyboard users.
        event.preventDefault();
        const { value, matches } = completeCommand(terminalInput.value, shellOnly);
        if (value !== terminalInput.value) {
            terminalInput.value = value;
        } else if (matches.length > 1) {
            echoCommand(terminalInput.value);
            printTextToTerminal(matches.join('   ')).style.whiteSpace = 'pre-wrap'; // keep the gaps
            scrollShell();
        }
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (historyIndex > 0) terminalInput.value = commandHistory[--historyIndex];
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
            terminalInput.value = commandHistory[++historyIndex];
        } else {
            historyIndex = commandHistory.length;
            terminalInput.value = '';
        }
    }
});

// Clicking the shell focuses the prompt (unless the visitor is selecting text)
terminalConsole.addEventListener('click', () => {
    if (!window.getSelection().toString()) terminalInput.focus();
});

// Typing anywhere on the terminal page goes straight to the prompt
document.addEventListener('keydown', (event) => {
    if (currentView !== 'terminal' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1 || event.key === ' ') return;
    if (event.target.closest && event.target.closest('input, textarea, select, [contenteditable]')) return;
    terminalInput.focus({ preventScroll: true });
    terminalConsole.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
});

// First welcome line (resetShell also stops the donut, whose state is declared further down)
printToTerminal(SHELL_WELCOME);


// --- 5. Ambient life: clock, typed role, block reveal ---
let roleTimer = null;
let clockTimer = null;

function tickClock() {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const uptime = formatUptime(Date.now() - pageStart);
    termClock.innerHTML = `${time} <span class="t-dim">· up ${uptime}</span>`;
}

function typeRoles() {
    const roleElement = document.getElementById('t-role');
    if (reduceMotion()) {
        roleElement.textContent = phrases[0];
        return;
    }
    let phrase = 0, chars = 0, deleting = false;
    const step = () => {
        const word = phrases[phrase];
        roleElement.textContent = word.slice(0, chars);
        let wait;
        if (!deleting && chars < word.length) { chars++; wait = 60; }
        else if (!deleting) { deleting = true; wait = 1500; }
        else if (chars > 0) { chars--; wait = 28; }
        else { deleting = false; phrase = (phrase + 1) % phrases.length; wait = 260; }
        roleTimer = setTimeout(step, wait);
    };
    step();
}

function startTerminal() {
    const blocks = termBody.querySelectorAll('.t-blk');
    blocks.forEach(block => block.classList.remove('in'));
    blocks.forEach((block, i) => setTimeout(() => block.classList.add('in'), reduceMotion() ? 0 : 80 + i * 140));
    tickClock();
    clockTimer = setInterval(tickClock, 1000);
    typeRoles();
}

function stopTerminal() {
    clearTimeout(roleTimer);
    clearInterval(clockTimer);
    resetShell();
}


// --- 6. Style switching: minimal ('classic'), terminal, retro or 3D ('neon') ---

// The green highlight slides to the chosen style: one thumb behind the buttons (see style.css)
const styleSwitch = document.querySelector('.style-switch');

function moveSwitchThumb() {
    const active = styleSwitch.querySelector('.style-opt[aria-pressed="true"]');
    if (!active || !active.offsetWidth) return; // the dock is hidden (retro): placed when it shows again
    styleSwitch.style.setProperty('--thumb-x', `${active.offsetLeft}px`);
    styleSwitch.style.setProperty('--thumb-w', `${active.offsetWidth}px`);
}

moveSwitchThumb();
styleSwitch.classList.add('has-thumb');
requestAnimationFrame(() => requestAnimationFrame(() => styleSwitch.classList.add('thumb-animate')));
window.addEventListener('resize', moveSwitchThumb); // the buttons are smaller on narrow phones

let currentView = 'classic';

// The 3D street (neon/neon.js) is a module with Three.js and a 0.5 MB model:
// it is only downloaded the first time that style is opened
const neonView = document.getElementById('neon-view');
let neonModule = null;

// Same number as the ?v= in index.html: a new number makes browsers fetch the new 3D code
const NEON_VERSION = 14;
const loadNeon = () => (neonModule = neonModule || import(`./neon/neon.js?v=${NEON_VERSION}`));

// Start downloading as soon as the visitor points at (or tabs to) the 3D button
const neonButton = document.querySelector('.style-opt[data-view="neon"]');
['pointerenter', 'focus'].forEach(type => neonButton.addEventListener(type, () => loadNeon().catch(() => {}), { once: true }));

// The green thumb's slide in the dock lasts 0.35s (style.css); the 3D setup is heavy
// (WebGL, model, textures), so it starts right after, to keep the slide smooth
const THUMB_SLIDE_MS = 380;

function enterNeon() {
    neonView.hidden = false;
    const slideDone = new Promise(resolve => setTimeout(resolve, reduceMotion() ? 0 : THUMB_SLIDE_MS));
    Promise.all([loadNeon(), slideDone])
        .then(([m]) => { if (currentView === 'neon') m.enter(neonView); })
        .catch(err => {
            console.error(err);
            neonView.innerHTML = '<p style="padding: 2rem; color: var(--text-color);">The 3D street could not be loaded. Choose another style below.</p>';
        });
}

function exitNeon() {
    neonView.hidden = true;
    if (neonModule) neonModule.then(m => m.exit()).catch(() => {});
}

function setView(view) {
    if (view === currentView) return;
    const previous = currentView;
    currentView = view;

    // Leaving the retro desktop closes its windows; leaving the terminal resets it
    if (previous === 'retro' && window.Retro) window.Retro.exit();
    if (previous === 'terminal') stopTerminal();
    if (previous === 'neon') exitNeon();

    classicView.classList.toggle('active', view === 'classic');
    terminalView.classList.toggle('active', view === 'terminal');
    document.body.classList.toggle('terminal-active', view === 'terminal');
    document.body.classList.toggle('retro-active', view === 'retro');
    document.body.classList.toggle('neon-active', view === 'neon');
    styleButtons.forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.view === view)));
    moveSwitchThumb();

    if (view === 'retro' && window.Retro) window.Retro.enter();
    if (view === 'terminal') startTerminal();
    if (view === 'neon') enterNeon();
    if (view !== 'retro' && view !== 'neon') window.scrollTo(0, 0);
}

styleButtons.forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
});


// --- 7. Email Copy Logic ---
const copyBtn = document.getElementById('copy-btn');
const emailText = document.getElementById('email-text').innerText;

copyBtn.addEventListener('click', () => {
    const reset = () => {
        copyBtn.innerText = 'Copy';
        copyBtn.classList.remove('is-copied');
    };

    navigator.clipboard.writeText(emailText).then(() => {
        copyBtn.innerText = 'Copied';
        copyBtn.classList.add('is-copied');
        setTimeout(reset, 2000);
    }).catch(() => {
        // Clipboard is blocked (e.g. opened from a file): select the address so Ctrl+C works
        const range = document.createRange();
        range.selectNodeContents(document.getElementById('email-text'));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        copyBtn.innerText = 'Press Ctrl+C';
        setTimeout(reset, 2000);
    });
});




// --- ASCII Donut Animation Engine ---
// The main terminal keeps the stop function of its current donut here
let stopDonutFn = null;

function stopMainDonut() {
    if (stopDonutFn) stopDonutFn();
    stopDonutFn = null;
}

// Starts a donut in `element` and returns a function that stops it,
// so the terminal view and the retro Terminal.exe never fight over one timer
function renderDonut(element) {
    let A = 1, B = 1;
    
    // Run the animation frame every 50 milliseconds
    const donutInterval = setInterval(() => {
        let b = [];
        let z = [];
        A += 0.07;
        B += 0.03;
        
        let cA = Math.cos(A), sA = Math.sin(A),
            cB = Math.cos(B), sB = Math.sin(B);
            
        // Initialize the empty 80x22 grid
        for(let k=0; k<1760; k++) {
            b[k] = k % 80 === 79 ? "\n" : " ";
            z[k] = 0;
        }
        
        // The 3D math projection
        for(let j=0; j<6.28; j+=0.07) { 
            let ct = Math.cos(j), st = Math.sin(j);
            for(let i=0; i<6.28; i+=0.02) { 
                let sp = Math.sin(i), cp = Math.cos(i),
                    h = ct + 2, 
                    D = 1 / (sp * h * sA + st * cA + 5), 
                    t = sp * h * cA - st * sA; 

                let x = 0 | (40 + 30 * D * (cp * h * cB - t * sB)),
                    y = 0 | (12 + 15 * D * (cp * h * sB + t * cB)),
                    o = x + 80 * y,
                    N = 0 | (8 * ((st * sA - sp * ct * cA) * cB - sp * ct * sA - st * cA - cp * ct * sB));
                
                if(y<22 && y>=0 && x>=0 && x<79 && D>z[o]) {
                    z[o] = D;
                    // Map the luminance to ASCII characters
                    b[o] = ".,-~:;=!*#$@"[N > 0 ? N : 0];
                }
            }
        }
        // Update the HTML element with the new frame
        element.innerHTML = b.join("");
    }, 50);

    return () => clearInterval(donutInterval);
}


// --- Shared with the retro desktop style (retro/*.js) ---
window.Portfolio = {
    setView,
    commands,
    phrases,
    projects,
    completeCommand,
    helpRows,
    buildHelp,
    renderDonut
};