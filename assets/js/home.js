/* ────────────────────────────────────────────────────────────
   home.js — Extracted inline scripts for the landing page.
   Loaded with `defer` so the DOM is ready when this runs.
   ──────────────────────────────────────────────────────────── */

// ─── Consent banner ───
window.consentChoice = function(choice) {
    localStorage.setItem('consent.uet.ad_storage', choice);
    window.uetq = window.uetq || [];
    window.uetq.push('consent', 'update', { ad_storage: choice });
    document.getElementById('consentBanner').style.display = 'none';
};

document.getElementById('consentDecline')?.addEventListener('click', function() { window.consentChoice('denied'); });
document.getElementById('consentAccept')?.addEventListener('click', function() { window.consentChoice('granted'); });

(function() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('resetconsent')) {
        localStorage.removeItem('consent.uet.ad_storage');
    }
    const saved = localStorage.getItem('consent.uet.ad_storage');
    const banner = document.getElementById('consentBanner');
    if (!banner) return;
    if (saved === 'granted' || saved === 'denied') {
        window.uetq = window.uetq || [];
        window.uetq.push('consent', 'update', { ad_storage: saved });
        banner.style.display = 'none';
    } else {
        banner.style.display = 'flex';
    }
})();

// ─── Footer year ───
document.getElementById('year').textContent = String(new Date().getFullYear());

// ─── Hamburger nav toggle ───
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');
navToggle?.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
});
mainNav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mainNav.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
}));

// ─── Render portal cards from Projects/data/games.json ───
const portalGrid = document.getElementById('portalGrid');
const statGames = document.getElementById('statGames');
const statCounted = document.getElementById('statCounted');
const statUpdated = document.getElementById('statUpdated');
const heroPlayLatest = document.getElementById('heroPlayLatest');
const featureCta = document.getElementById('featureCta');
const featureSpotlight = document.getElementById('featureSpotlight');
const featureShotTitle = document.getElementById('featureShotTitle');
const featureShotImage = document.getElementById('featureShotImage');
const featureShotCover = document.getElementById('featureShotCover');
const featureShotCaption = document.getElementById('featureShotCaption');
const featuredPlayCta = document.getElementById('featuredPlayCta');
const featuredStage = document.getElementById('featuredStage');
const featuredStageImage = document.getElementById('featuredStageImage');
const featuredStageCover = document.getElementById('featuredStageCover');
const featuredStageKicker = document.getElementById('featuredStageKicker');
const featuredStageStatus = document.getElementById('featuredStageStatus');
const featuredStageTitle = document.getElementById('featuredStageTitle');
const featuredStageDesc = document.getElementById('featuredStageDesc');
const featuredStageBadges = document.getElementById('featuredStageBadges');
const portalSearch = document.getElementById('portalSearch');
const portalFilters = document.getElementById('portalFilters');
const portalResults = document.getElementById('portalResults');
const archiveGrid = document.getElementById('archiveGrid');

const FEATURED_GAME_ID = 'unsupervised-3d';

let loadedGames = [];
let portalGames = [];
let archiveGames = [];
let activeFilter = 'All';
let searchQuery = '';

const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.valueOf())) return '—';
    return d.toISOString().slice(0, 10);
};

const scienceLabBaseUrl = new URL('Projects/hubs/science-lab/index.html', window.location.href);
const defaultThumbnail = 'assets/featured-science-lab-mock.svg';

const COVER_THEMES = {
    vault: {
        primary: '#16071f',
        secondary: '#05070f',
        tertiary: '#6f1131',
        accent: '#ff7fda',
        accentSoft: 'rgba(255, 127, 218, 0.26)',
        highlight: '#7fe8ff',
        frame: 'rgba(255, 207, 126, 0.18)',
        line: 'rgba(255, 142, 216, 0.28)',
    },
    science: {
        primary: '#071a2d',
        secondary: '#030812',
        tertiary: '#113d62',
        accent: '#72d7ff',
        accentSoft: 'rgba(114, 215, 255, 0.24)',
        highlight: '#ffe27a',
        frame: 'rgba(114, 215, 255, 0.18)',
        line: 'rgba(114, 215, 255, 0.3)',
    },
    strategy: {
        primary: '#0b1628',
        secondary: '#07101d',
        tertiary: '#1a3a5d',
        accent: '#6ce8ff',
        accentSoft: 'rgba(108, 232, 255, 0.24)',
        highlight: '#7ff0c5',
        frame: 'rgba(108, 232, 255, 0.18)',
        line: 'rgba(127, 240, 197, 0.28)',
    },
    arcade: {
        primary: '#1d0b16',
        secondary: '#09060e',
        tertiary: '#5f1630',
        accent: '#ff6f95',
        accentSoft: 'rgba(255, 111, 149, 0.24)',
        highlight: '#ffcf6e',
        frame: 'rgba(255, 111, 149, 0.18)',
        line: 'rgba(255, 207, 110, 0.24)',
    },
    cognitive: {
        primary: '#15101b',
        secondary: '#09070d',
        tertiary: '#49345f',
        accent: '#c89dff',
        accentSoft: 'rgba(200, 157, 255, 0.24)',
        highlight: '#ffdca3',
        frame: 'rgba(200, 157, 255, 0.18)',
        line: 'rgba(255, 220, 163, 0.24)',
    },
    gentle: {
        primary: '#14161f',
        secondary: '#0a0e15',
        tertiary: '#29465a',
        accent: '#8ad7c6',
        accentSoft: 'rgba(138, 215, 198, 0.22)',
        highlight: '#ffe5ae',
        frame: 'rgba(138, 215, 198, 0.18)',
        line: 'rgba(255, 229, 174, 0.22)',
    },
};

const COVER_LIBRARY = {
    'unsupervised-3d': {
        theme: 'vault',
        kicker: 'AGI vault pursuit',
        title: 'Neon Vault',
        hook: 'Match memory tiles, dodge hostile fire, and keep the good AGI core alive through six floors.',
        meta: '3D survival run · boss finish',
    },
    'agi-breeder': {
        theme: 'strategy',
        kicker: 'Directive lab sim',
        title: 'AGI Breeder',
        hook: 'Breed aligned lineages, manage crises, and launch before the lab turns on itself.',
        meta: 'Strategy simulation · weekly directives',
    },
    'agi-3d': {
        theme: 'vault',
        kicker: 'Living intelligence',
        title: 'AGI 3D',
        hook: 'Watch a liquid-metal AGI entity breathe, pulse, and wobble in real-time 3D space.',
        meta: '3D experience · ambient',
    },
    'protein-interactions': {
        theme: 'science',
        kicker: 'Molecular drama',
        title: 'Protein Interactions',
        hook: 'Watch antibodies dock, enzymes bind, and chemical systems react inside a 3D scene.',
        meta: 'Science simulation · 3D',
    },
    'protein-simulator': {
        theme: 'science',
        kicker: 'Interactive structure viewer',
        title: 'Protein Simulator',
        hook: 'Rotate alpha-helices, DNA, and collagen with clean render modes built for inspection.',
        meta: '3D viewer · chemistry',
    },
    'science-lab-5-2': {
        theme: 'science',
        kicker: 'Element megahub',
        title: 'Science Lab 5.2',
        hook: 'Teleport across the periodic table and inspect orbitals, shells, and room-scale science spaces.',
        meta: '118 rooms · science lab',
    },
    'attract-ion': {
        theme: 'science',
        kicker: 'Animated chemistry sandbox',
        title: 'Attract-ion',
        hook: 'Stabilize particles, shape energy, and watch hydrogen emerge from a volatile desert field.',
        meta: 'Animated cover · formation MVP',
        media: 'assets/attract-ion.gif',
    },
    'one-ai': {
        theme: 'strategy',
        kicker: 'Directive conflict board',
        title: 'Directive Grid',
        hook: 'Override bad calls, stabilize the signal, and hit the target score before the system slips.',
        meta: 'Strategy · intervention run',
    },
    'frost-signal': {
        theme: 'arcade',
        kicker: 'Trust shard sprint',
        title: 'Frost Signal',
        hook: 'Short-run arcade pressure built around shard collection, clear failure states, and rapid resets.',
        meta: 'Arcade · restart fast',
    },
    'thermal-drift': {
        theme: 'arcade',
        kicker: 'Heat survival',
        title: 'Thermal Drift',
        hook: 'Survive hostile waves, keep moving, and stay out of the enemy envelope as the arena heats up.',
        meta: 'Action prototype · dodge',
    },
    'memory-sequence': {
        theme: 'cognitive',
        kicker: 'Legacy pattern test',
        title: 'Memory Sequence',
        hook: 'Trace the expanding order precisely before the pattern outruns your recall.',
        meta: 'Cognitive · legacy lab',
    },
    'memory-mapping': {
        theme: 'cognitive',
        kicker: 'Spatial recall',
        title: 'Memory Mapping',
        hook: 'Rebuild the pattern by position and keep the map intact under increasing cognitive load.',
        meta: 'Cognitive · positional play',
    },
    'alz-jaime': {
        theme: 'gentle',
        kicker: 'Gentle legacy mode',
        title: 'Alz-Jaime',
        hook: 'A softer pacing profile for sequence play, preserved for continuity and accessibility.',
        meta: 'Gentle mode · preserved',
    },
};

const resolveHubHref = (href) => {
    try {
        if (!href) return '#';
        return new URL(href, scienceLabBaseUrl).toString();
    } catch {
        return '#';
    }
};

const resolveAssetHref = (href) => {
    try {
        if (!href) return new URL(defaultThumbnail, scienceLabBaseUrl).toString();
        return new URL(href, scienceLabBaseUrl).toString();
    } catch {
        return new URL(defaultThumbnail, scienceLabBaseUrl).toString();
    }
};

const toMs = (iso) => {
    if (!iso) return 0;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : 0;
};

const escapeHtml = (s) => String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getBadges = (game) => Array.isArray(game.badges) ? game.badges : [];

const badgesHtml = (badges, accent = 'badge') => badges
    .map((badge, index) => `<span class="${index === 0 ? 'badge blue' : accent}">${escapeHtml(badge)}</span>`)
    .join('');

const deriveCoverTheme = (game) => {
    const badges = getBadges(game);
    if (badges.some((badge) => ['Science', '3D Simulation', '3D Viewer'].includes(badge))) return 'science';
    if (badges.includes('Strategy') || game.id === 'one-ai') return 'strategy';
    if (badges.includes('Action') || badges.includes('Arcade') || badges.includes('Prototype')) return 'arcade';
    if (badges.includes('Gentle')) return 'gentle';
    return 'cognitive';
};

const getCoverConfig = (game) => {
    const override = COVER_LIBRARY[game.id] || {};
    const themeName = override.theme || deriveCoverTheme(game);
    const theme = COVER_THEMES[themeName] || COVER_THEMES.cognitive;
    const badges = getBadges(game);

    return {
        ...theme,
        theme: themeName,
        kicker: override.kicker || badges[0] || 'Playable now',
        title: override.title || game.title || 'Untitled',
        hook: override.hook || game.desc || 'Launch the build.',
        meta: override.meta || badges.slice(0, 3).join(' · ') || 'Launch game',
        media: override.media || game.thumbnail || defaultThumbnail,
    };
};

const coverStyleVars = (cover) => [
    `--cover-primary:${cover.primary}`,
    `--cover-secondary:${cover.secondary}`,
    `--cover-tertiary:${cover.tertiary}`,
    `--cover-accent:${cover.accent}`,
    `--cover-accent-soft:${cover.accentSoft}`,
    `--cover-highlight:${cover.highlight}`,
    `--cover-frame:${cover.frame}`,
    `--cover-line:${cover.line}`,
].join(';');

const coverArtHtml = (game, variant = 'card') => {
    const cover = getCoverConfig(game);

    return `
        <div class="cover-art cover-art--${variant} theme-${escapeHtml(cover.theme)}" style="${coverStyleVars(cover)}">
            <div class="cover-scene" aria-hidden="true">
                <span class="cover-orb cover-orb--major"></span>
                <span class="cover-orb cover-orb--minor"></span>
                <span class="cover-panel cover-panel--a"></span>
                <span class="cover-panel cover-panel--b"></span>
                <span class="cover-signal"></span>
            </div>
            <div class="cover-copy">
                <span class="cover-eyebrow">${escapeHtml(cover.kicker)}</span>
                <strong class="cover-display">${escapeHtml(cover.title)}</strong>
                <span class="cover-hook">${escapeHtml(cover.hook)}</span>
                <span class="cover-meta">${escapeHtml(cover.meta)}</span>
            </div>
        </div>
    `;
};

const resolveCoverMedia = (game) => resolveAssetHref(getCoverConfig(game).media);

const matchesPortalFilter = (game) => {
    const badges = getBadges(game);
    const haystack = [game.title, game.desc, ...badges].join(' ').toLowerCase();
    const searchMatch = !searchQuery || haystack.includes(searchQuery);
    const filterMatch = activeFilter === 'All' || badges.includes(activeFilter);
    return searchMatch && filterMatch;
};

const cardHtml = (g, i) => {
    const title = escapeHtml(g.title ?? 'Untitled');
    const desc = escapeHtml(g.desc ?? '');
    const href = escapeHtml(resolveHubHref(g.href));
    const image = escapeHtml(resolveCoverMedia(g));
    const badges = Array.isArray(g.badges) ? g.badges : [];
    const updatedAt = fmtDate(g.updatedAt);

    const badgeEls = [
        `<span class="badge blue">Updated ${updatedAt}</span>`,
        `<span class="badge ${g.counted ? 'good' : ''}">${g.counted ? 'Playable now' : 'Archive'}</span>`,
        ...(badges.slice(0, 3).map((b) => `<span class="badge">${escapeHtml(b)}</span>`)),
    ].join('');

    const size = i === 0 ? 'big' : i === 1 ? 'tall' : '';
    return `
        <a class="card portal-card ${size}" href="${href}">
            <div class="card-media cover-media" data-game-id="${escapeHtml(g.id ?? '')}">
                <img class="card-image" src="${image}" alt="${title} cover art" loading="lazy" decoding="async" />
                ${coverArtHtml(g, 'card')}
            </div>
            <div class="card-topline">
                <span class="card-kicker">${i === 0 ? 'Featured build' : 'Launch game'}</span>
                <span class="card-date">${updatedAt}</span>
            </div>
            <div class="card-title">${title}</div>
            <div class="card-desc">${desc}</div>
            <div class="badges">${badgeEls}</div>
            <div class="card-cta">Play now →</div>
        </a>
    `;
};

const archiveCardHtml = (g) => {
    const title = escapeHtml(g.title ?? 'Untitled');
    const desc = escapeHtml(g.desc ?? '');
    const href = escapeHtml(resolveHubHref(g.href));
    const image = escapeHtml(resolveCoverMedia(g));
    const badges = getBadges(g);
    const updatedAt = fmtDate(g.updatedAt);
    const badgeEls = [
        `<span class="badge blue">Preserved</span>`,
        `<span class="badge">Updated ${updatedAt}</span>`,
        ...(badges.slice(0, 2).map((b) => `<span class="badge">${escapeHtml(b)}</span>`)),
    ].join('');

    return `
        <a class="card portal-card archive-card" href="${href}">
            <div class="card-media cover-media" data-game-id="${escapeHtml(g.id ?? '')}">
                <img class="card-image" src="${image}" alt="${title} cover art" loading="lazy" decoding="async" />
                ${coverArtHtml(g, 'card')}
            </div>
            <div class="card-topline">
                <span class="card-kicker">Preserved build</span>
                <span class="card-date">${updatedAt}</span>
            </div>
            <div class="card-title">${title}</div>
            <div class="card-desc">${desc}</div>
            <div class="badges">${badgeEls}</div>
            <div class="card-cta">Open preserved build →</div>
        </a>
    `;
};

const renderArchive = () => {
    if (!archiveGrid) return;
    if (!archiveGames.length) {
        archiveGrid.innerHTML = '';
        return;
    }

    archiveGrid.innerHTML = archiveGames.map(archiveCardHtml).join('');
    primeCoverMedia();
};

const renderPortalFilters = () => {
    if (!portalFilters) return;

    const counts = new Map();
    counts.set('All', portalGames.length);
    portalGames.forEach((game) => {
        getBadges(game).forEach((badge) => {
            counts.set(badge, (counts.get(badge) || 0) + 1);
        });
    });

    const chips = ['All', ...[...counts.keys()].filter((key) => key !== 'All').sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b))];
    portalFilters.innerHTML = chips.map((chip) => `
        <button class="filter-chip${chip === activeFilter ? ' active' : ''}" type="button" data-filter="${escapeHtml(chip)}">
            <span>${escapeHtml(chip)}</span>
            <span class="filter-count">${counts.get(chip) || 0}</span>
        </button>
    `).join('');

    portalFilters.querySelectorAll('[data-filter]').forEach((button) => {
        button.addEventListener('click', () => {
            activeFilter = button.dataset.filter || 'All';
            renderPortalCards();
            renderPortalFilters();
        });
    });
};

const renderPortalCards = () => {
    if (!portalGrid) return;

    const filteredGames = portalGames.filter(matchesPortalFilter);
    if (portalResults) {
        const label = activeFilter === 'All' ? 'all categories' : activeFilter;
        portalResults.textContent = `${filteredGames.length} of ${portalGames.length} games shown · ${label}`;
    }

    if (!filteredGames.length) {
        portalGrid.innerHTML = `
            <div class="card portal-card big empty-card" role="status">
                <div class="card-topline">
                    <span class="card-kicker">No matches</span>
                    <span class="card-date">Refine search</span>
                </div>
                <div class="card-title">No games match this filter</div>
                <div class="card-desc">Try a different keyword or clear the current tag filter to reopen the full portal list.</div>
                <div class="badges"><span class="badge blue">Search</span><span class="badge">Filter</span></div>
            </div>
        `;
        return;
    }

    portalGrid.innerHTML = filteredGames.map(cardHtml).join('');
    primeCoverMedia();
};

const setFeaturedGame = (game) => {
    if (!game) return;

    const title = game.title ?? 'Featured game';
    const href = resolveHubHref(game.href);
    const badges = Array.isArray(game.badges) ? game.badges.slice(0, 3) : [];
    const updatedAt = fmtDate(game.updatedAt);
    const desc = game.desc ?? 'Launch the featured experience.';
    const media = resolveCoverMedia(game);

    if (heroPlayLatest) heroPlayLatest.href = href;
    if (featureCta) {
        featureCta.href = href;
        featureCta.textContent = `Play ${title}`;
    }
    if (featureSpotlight) featureSpotlight.href = href;
    if (featureShotTitle) featureShotTitle.textContent = title;
    if (featureShotImage) {
        featureShotImage.src = media;
        featureShotImage.alt = `${title} cover art`;
    }
    if (featureShotCover) featureShotCover.innerHTML = coverArtHtml(game, 'compact');
    if (featureShotCaption) {
        const badgeText = badges.length ? `${badges.join(' · ')} · ` : '';
        featureShotCaption.textContent = `${badgeText}Updated ${updatedAt}`;
    }
    if (featuredPlayCta) {
        featuredPlayCta.href = href;
        featuredPlayCta.textContent = `Launch ${title}`;
    }
    if (featuredStage) featuredStage.href = href;
    if (featuredStageImage) {
        featuredStageImage.src = media;
        featuredStageImage.alt = `${title} cover art`;
    }
    if (featuredStageCover) featuredStageCover.innerHTML = coverArtHtml(game, 'feature');
    if (featuredStageKicker) {
        featuredStageKicker.textContent = badges.length ? badges.join(' · ') : 'Featured launch';
    }
    if (featuredStageStatus) {
        featuredStageStatus.textContent = game.counted ? 'Live in portal' : 'Preserved build';
    }
    if (featuredStageTitle) {
        featuredStageTitle.textContent = title === 'Unsupervised 3D' ? 'Neon Vault — Unsupervised 3D' : title;
    }
    if (featuredStageDesc) {
        featuredStageDesc.textContent = desc;
    }
    if (featuredStageBadges) {
        featuredStageBadges.innerHTML = badgesHtml(badges);
    }

    primeCoverMedia();
};

const primeCoverMedia = () => {
    document.querySelectorAll('.cover-media img, .feature-shot-frame img, .featured-stage-visual img').forEach((img) => {
        if (img.dataset.coverBound === '1') return;
        img.dataset.coverBound = '1';

        const frame = img.closest('.cover-media, .feature-shot-frame, .featured-stage-visual');
        if (!frame) return;

        const flagError = () => frame.setAttribute('data-media-error', '1');
        const clearError = () => frame.removeAttribute('data-media-error');

        img.addEventListener('error', flagError);
        img.addEventListener('load', clearError);

        if (img.complete && img.naturalWidth === 0) flagError();
    });
};

const renderPortal = async () => {
    try {
        const res = await fetch('Projects/data/games.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const games = (Array.isArray(data.games) ? data.games.slice() : [])
            .filter((g) => g && g.href && g.title)
            .map((g) => ({ ...g, updatedAtMs: toMs(g.updatedAt) }));

        loadedGames = games;
        portalGames = games
            .filter((g) => g.counted)
            .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        archiveGames = games
            .filter((g) => !g.counted)
            .sort((a, b) => b.updatedAtMs - a.updatedAtMs);

        const latestUpdated = portalGames
            .map((g) => g.updatedAt)
            .filter(Boolean)
            .sort()
            .slice(-1)[0];

        statGames.textContent = String(portalGames.length);
        statCounted.textContent = String(games.length);
        statUpdated.textContent = fmtDate(latestUpdated);

        const preferredFeatured = games.find((game) => game.id === FEATURED_GAME_ID) || portalGames[0] || games[0];

        setFeaturedGame(preferredFeatured);
        renderPortalFilters();
        renderPortalCards();
        renderArchive();

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches === false) {
            enableTilt();
            enableSpotlight();
        }
    } catch (err) {
        if (portalGrid) {
            portalGrid.innerHTML = `
                <a class="card portal-card big" href="Projects/hubs/science-lab/index.html">
                    <div class="card-topline">
                        <span class="card-kicker">Fallback launch</span>
                        <span class="card-date">Portal offline</span>
                    </div>
                    <div class="card-title">Science Lab (Hub)</div>
                    <div class="card-desc">Could not load the game registry right now. Jump into the shared hub instead.</div>
                    <div class="badges"><span class="badge blue">Fallback</span></div>
                    <div class="card-cta">Enter lab →</div>
                </a>
            `;
        }
        if (archiveGrid) archiveGrid.innerHTML = '';
        statGames.textContent = '—';
        statCounted.textContent = '—';
        statUpdated.textContent = '—';
        if (portalResults) portalResults.textContent = 'Portal unavailable';
    }
};

renderPortal();

portalSearch?.addEventListener('input', (event) => {
    searchQuery = String(event.target.value || '').trim().toLowerCase();
    renderPortalCards();
    if (!reducedMotion) {
        enableTilt();
        enableSpotlight();
    }
});

// ─── Subtle tilt on hover (desktop only) ───
const enableTilt = () => {
    const cards = document.querySelectorAll('.card');
    cards.forEach((c) => {
        if (c.dataset.tiltReady === '1') return;
        c.dataset.tiltReady = '1';

        let raf = null;
        const onMove = (e) => {
            const r = c.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width;
            const py = (e.clientY - r.top) / r.height;
            const rx = (0.5 - py) * 6;
            const ry = (px - 0.5) * 8;
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                c.style.transform = `translateY(-4px) scale(1.015) rotateX(${rx}deg) rotateY(${ry}deg)`;
            });
        };
        const onLeave = () => {
            if (raf) cancelAnimationFrame(raf);
            c.style.transform = '';
        };
        c.addEventListener('pointermove', onMove);
        c.addEventListener('pointerleave', onLeave);
    });
};

// ─── Mouse spotlight on cards ───
const enableSpotlight = () => {
    document.querySelectorAll('.card').forEach(c => {
        if (c.dataset.spotReady === '1') return;
        c.dataset.spotReady = '1';
        c.addEventListener('pointermove', (e) => {
            const r = c.getBoundingClientRect();
            c.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
            c.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
            c.style.setProperty('--spot-opacity', '1');
        });
        c.addEventListener('pointerleave', () => {
            c.style.setProperty('--spot-opacity', '0');
        });
    });
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reducedMotion) {
    enableTilt();
    enableSpotlight();
}

// ─── Scroll progress bar ───
const scrollProgressEl = document.getElementById('scrollProgress');
if (!reducedMotion && scrollProgressEl) {
    let ticking = false;
    const updateProgress = () => {
        const scrollH = document.documentElement.scrollHeight - window.innerHeight;
        const pct = scrollH > 0 ? (window.scrollY / scrollH) * 100 : 0;
        scrollProgressEl.style.width = `${pct}%`;
        ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); } }, { passive: true });
}

// ─── Nav scroll shrink + scroll-spy active link ───
const nav = document.querySelector('.nav');
const sections = document.querySelectorAll('.section[id], .hero');
const navAnchors = document.querySelectorAll('.navlinks a[href^="#"]');
if (nav) {
    let navTicking = false;
    const onScroll = () => {
        nav.classList.toggle('scrolled', window.scrollY > 60);
        let current = '';
        sections.forEach(s => {
            const top = s.getBoundingClientRect().top;
            if (top < window.innerHeight * 0.4) current = s.id || '';
        });
        navAnchors.forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === `#${current}`);
        });
        navTicking = false;
    };
    window.addEventListener('scroll', () => { if (!navTicking) { navTicking = true; requestAnimationFrame(onScroll); } }, { passive: true });
}

// ─── Scroll-reveal via IntersectionObserver ───
if (!reducedMotion) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('revealed');
                observer.unobserve(e.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    const tagRevealTargets = () => {
        document.querySelectorAll('.section .h2, .section .sub').forEach((el, i) => {
            if (el.classList.contains('revealed')) return;
            el.classList.add('reveal');
            el.style.setProperty('--d', `${i * 0.08}s`);
            observer.observe(el);
        });
        document.querySelectorAll('.grid .card, .banner .card').forEach((el, i) => {
            if (el.classList.contains('revealed')) return;
            el.classList.add('reveal');
            el.style.setProperty('--d', `${0.06 + (i % 6) * 0.09}s`);
            observer.observe(el);
        });
        document.querySelectorAll('.quality-card').forEach((el, i) => {
            if (el.classList.contains('revealed')) return;
            el.classList.add('reveal');
            el.style.setProperty('--d', `${0.08 + i * 0.12}s`);
            observer.observe(el);
        });
        document.querySelectorAll('.featured-command, .featured-stage, .hero-rail-item').forEach((el, i) => {
            if (el.classList.contains('revealed')) return;
            el.classList.add('reveal');
            el.style.setProperty('--d', `${0.05 + i * 0.08}s`);
            observer.observe(el);
        });
        const pill = document.querySelector('.quality-pill');
        if (pill && !pill.classList.contains('revealed')) {
            pill.classList.add('reveal');
            pill.style.setProperty('--d', '0.2s');
            observer.observe(pill);
        }
    };

    tagRevealTargets();
    setTimeout(() => { tagRevealTargets(); enableTilt(); enableSpotlight(); }, 900);
}

// ─── Stat number count-up animation ───
const animateCounter = (el, end) => {
    if (reducedMotion) { el.textContent = String(end); el.classList.add('counted'); return; }
    const duration = 900;
    const start = performance.now();
    const step = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(ease * end));
        if (t < 1) requestAnimationFrame(step);
        else { el.textContent = String(end); el.classList.add('counted'); }
    };
    requestAnimationFrame(step);
};

const hookStat = (el) => {
    let fired = false;
    const obs = new MutationObserver(() => {
        if (fired) return;
        const raw = el.textContent.trim();
        const num = parseInt(raw, 10);
        if (!raw || raw === '—' || raw === '0' || isNaN(num)) return;
        fired = true;
        obs.disconnect();
        el.textContent = '0';
        animateCounter(el, num);
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
};
[statGames, statCounted].forEach(hookStat);

// ─── Blog toggle ───
const blogToggle = document.getElementById('blogToggle');
const blogBody = document.getElementById('blogBody');
if (blogToggle && blogBody) {
    blogToggle.addEventListener('click', () => {
        const expanded = blogBody.classList.toggle('blog-expanded');
        blogBody.classList.toggle('blog-collapsed', !expanded);
        blogToggle.setAttribute('aria-expanded', String(expanded));
        blogToggle.textContent = expanded ? 'Show less ▴' : 'Read more ▾';
    });
}

// ─── Matrix rain canvas ───
const canvas = document.getElementById('immersion');
const ctx = canvas.getContext('2d');
const mouse = { x: -9999, y: -9999 };
const mouseGlow = 140;

const fontSize = 15;
const glyphs = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&';
let columns = [];
let W, H, colCount;

const resize = () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    const newCount = Math.ceil(W / fontSize);
    while (columns.length < newCount) columns.push(Math.random() * H / fontSize | 0);
    columns.length = newCount;
    colCount = newCount;
};

const tick = () => {
    ctx.fillStyle = 'rgba(7, 10, 16, 0.06)';
    ctx.fillRect(0, 0, W, H);

    ctx.font = `${fontSize}px monospace`;

    for (let i = 0; i < colCount; i++) {
        const x = i * fontSize;
        const y = columns[i] * fontSize;
        const ch = glyphs[Math.random() * glyphs.length | 0];

        const dx = x - mouse.x;
        const dy = y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouseGlow) {
            const bright = 1 - dist / mouseGlow;
            ctx.fillStyle = `rgba(154, 230, 255, ${0.5 + bright * 0.5})`;
            ctx.shadowColor = 'rgba(154, 230, 255, 0.7)';
            ctx.shadowBlur = 8;
        } else {
            const hue = (i % 3 === 0) ? 160 : (i % 3 === 1) ? 190 : 220;
            ctx.fillStyle = `hsla(${hue}, 80%, 70%, 0.85)`;
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }

        ctx.fillText(ch, x, y);
        ctx.shadowBlur = 0;

        if (y > H && Math.random() > 0.975) {
            columns[i] = 0;
        } else {
            columns[i]++;
        }
    }

    requestAnimationFrame(tick);
};

window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
}, { passive: true });
window.addEventListener('pointerleave', () => { mouse.x = -9999; mouse.y = -9999; });

window.addEventListener('resize', resize);
resize();

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches === false) {
    tick();
}
