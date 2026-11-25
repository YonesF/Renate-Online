// Åpner Lenas panel på hjelpesiden. Rammen lastes først når kunden åpner den.
(() => {
  'use strict';

  // Statisk utgave: roten til nettstedet finnes fra adressen til dette skriptet (assets/help.js),
  // så lenkene virker også når nettstedet ligger i en undermappe på GitHub Pages.
  const SITE_ROOT = new URL('../', (document.currentScript && document.currentScript.src) || location.href);
  const siteUrl = (url) => (/^https?:/.test(url) ? url
    : new URL(url.replace(/^\//, '').replace(/^(kategori|artikkel)\/([a-z0-9-]+)(?=[#?]|$)/, '$1/$2/'), SITE_ROOT).href);

  const panel = document.getElementById('chat');
  let updateScrollTopButton = () => {};

  if (location.pathname.replace(/index\.html$/, '') !== SITE_ROOT.pathname) {
    const scrollTopButton = document.createElement('button');
    scrollTopButton.type = 'button';
    scrollTopButton.className = 'scroll-to-top';
    scrollTopButton.textContent = '↑ Til toppen';
    scrollTopButton.setAttribute('aria-label', 'Rull til toppen av siden');
    scrollTopButton.setAttribute('aria-hidden', 'true');
    scrollTopButton.tabIndex = -1;
    document.body.appendChild(scrollTopButton);

    updateScrollTopButton = () => {
      const chatIsOpen = panel instanceof HTMLElement && !panel.hidden;
      const isVisible = window.scrollY >= 320 && !chatIsOpen;
      scrollTopButton.classList.toggle('is-visible', isVisible);
      scrollTopButton.setAttribute('aria-hidden', String(!isVisible));
      scrollTopButton.tabIndex = isVisible ? 0 : -1;
    };

    scrollTopButton.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
    window.addEventListener('scroll', updateScrollTopButton, { passive: true });
    requestAnimationFrame(updateScrollTopButton);
  }

  const launcher = document.getElementById('chat-launcher');
  const OPEN = 'ca_chat_open';

  if (panel) {
    const origin = panel.dataset.origin;
    const minimizeButton = panel.querySelector('[data-chat-minimize]');
    let closeTimer;

    function setMinimized(minimized) {
      panel.classList.toggle('is-minimized', minimized);
      minimizeButton?.setAttribute('aria-label', minimized ? 'Åpne chatten' : 'Minimer chatten');
      minimizeButton?.setAttribute('aria-expanded', String(!minimized));
    }

    function open() {
      window.clearTimeout(closeTimer);
      if (!panel.querySelector('iframe')) {
        const frame = document.createElement('iframe');
        const query = new URLSearchParams({ page: location.pathname, title: document.title });
        frame.src = `${origin}/?${query}`;
        frame.title = 'Chat med Lena';
        panel.appendChild(frame);
      }
      setMinimized(false);
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('is-open'));
      updateScrollTopButton();
      if (launcher) launcher.hidden = true;
      try { sessionStorage.setItem(OPEN, '1'); } catch (error) { /* uten lagring huskes ikke tilstanden */ }
    }

    function close() {
      panel.classList.remove('is-open');
      const closeDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450;
      closeTimer = window.setTimeout(() => {
        if (!panel.classList.contains('is-open')) {
          panel.hidden = true;
          setMinimized(false);
          updateScrollTopButton();
        }
      }, closeDelay);
      updateScrollTopButton();
      if (launcher) launcher.hidden = false;
      try { sessionStorage.removeItem(OPEN); } catch (error) { /* se over */ }
    }

    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-chat-open]')) { event.preventDefault(); open(); }
      if (event.target.closest('[data-chat-minimize]')) {
        setMinimized(!panel.classList.contains('is-minimized'));
        updateScrollTopButton();
      }
      if (event.target.closest('[data-chat-close]')) close();
    });

    // Panelet følger med fra side til side.
    try { if (sessionStorage.getItem(OPEN) === '1') open(); } catch (error) { /* se over */ }
  }

  // «Se alle spørsmål» åpner alle FAQ-radene på forsiden.
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const toggle = event.target.closest('[data-faq-toggle]');
    if (!toggle) return;
    event.preventDefault();
    const items = document.querySelectorAll('.faq-item');
    const allOpen = Array.from(items).every((el) => el instanceof HTMLDetailsElement && el.open);
    for (const item of items) {
      if (item instanceof HTMLDetailsElement) item.open = !allOpen;
    }
    document.getElementById('populaere-sporsmal')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Google-aktig søkefelt med direkte forslag mens kunden skriver.
  const searchForm = document.querySelector('.hero-search');
  const searchInput = searchForm?.querySelector('.hero-search-input');
  const suggestionList = document.getElementById('search-suggestions');

  if (
    searchForm instanceof HTMLFormElement &&
    searchInput instanceof HTMLInputElement &&
    suggestionList instanceof HTMLUListElement
  ) {
    const SUGGESTIONS = [
      {
        title: 'Hvorfor fester ikke tekstilvinylen eller trykket seg?',
        desc: 'Forpress i 3–5 sek for å fjerne fukt, og sjekk temperatur, tid og trykk.',
        badge: 'Vinyl og tekstil',
        url: '/kategori/vinyl-og-tekstil#hvorfor-fester-ikke-tekstilvinylen',
        keywords: 'hvorfor fester ikke vinylen venylen tekstilvinyl htv folie trykket løsner faller av sitter ikke',
        popular: true,
      },
      {
        title: 'Hvilken varmeinnstilling, temperatur og tid skal jeg bruke?',
        desc: 'Tabell med temperatur, tid og trykk for HTV, tekstil, kopper og blanks.',
        badge: 'Varmepresser',
        url: '/kategori/varmepresser#varmeinnstillinger',
        keywords: 'hvilken varmeinnstilling varme temperatur grader tid sekunder trykk innstilling varmepresse presse',
        popular: true,
      },
      {
        title: 'Hvordan fungerer sublimering og skriveren din?',
        desc: 'Blekkflyt fra tank til dyse, og hva som skjer når skriveren står ubrukt.',
        badge: 'Sublimering',
        url: '/kategori/sublimering#slik-fungerer-sublimering',
        keywords: 'hvordan fungerer sublimering skriver printer epson blekktank dyse gassform polyester',
        popular: true,
      },
      {
        title: 'Dysesjekk og rensetrappa (hoderens og trykkrens)',
        desc: 'Steg for steg når det mangler streker eller farger i dysesjekken.',
        badge: 'Sublimering',
        url: '/kategori/sublimering#dysesjekk-og-rensetrappa',
        keywords: 'dysesjekk dysekontroll nozzle check hoderens trykkrens power cleaning tette dyser luft i slangene',
        popular: true,
      },
      {
        title: 'Blasse eller falmede farger etter pressing',
        desc: 'Sjekk belagt papirtype (coated side), forpress emnet og juster varme/tid.',
        badge: 'Varmepresser',
        url: '/kategori/varmepresser#presseproblemer',
        keywords: 'blasse falmede svake farger feil side av papiret coated etter pressing',
        popular: true,
      },
      {
        title: 'Fargeproblemer og ICC-profiler (rød blir oransje, blå blir lilla)',
        desc: 'Løsninger når fargene blir feil, matte, for mørke eller brunlige.',
        badge: 'Sublimering',
        url: '/kategori/sublimering#fargeproblemer-og-icc',
        keywords: 'fargeproblemer feil farge icc profil rød oransje blå lilla grønn svart brunlig matt mørke cmyk rgb',
        popular: true,
      },
      {
        title: 'Hvor lang leveringstid er det og hva er fraktbetingelsene?',
        desc: '1–5 dager med Bring pakke, fri frakt over 2000 kr og henting i Kristiansand.',
        badge: 'Bestilling & levering',
        url: 'https://creativeart.no/pages/fraktbetingelser',
        keywords: 'hvor lang leveringstid levering frakt bestilling pakke sporing sende søgne kristiansand fraktbetingelser',
        popular: true,
      },
      {
        title: 'Kan jeg returnere produkter? (Angrerett og retur)',
        desc: '14 dagers angrerett på ubrukte varer i original emballasje.',
        badge: 'Bestilling & levering',
        url: 'https://creativeart.no/policies/refund-policy',
        keywords: 'kan jeg returnere produkter retur bytte angrerett reklamasjon pengene tilbake refund',
        popular: true,
      },
      {
        title: 'Ghosting – skygge eller dobbeltbilde ved siden av motivet',
        desc: 'Fest papiret med varmebestandig tape og åpne pressen rolig.',
        badge: 'Varmepresser',
        url: '/kategori/varmepresser#presseproblemer',
        keywords: 'ghosting skygge dobbeltbilde uskarpt utydelig forskjøvet varmebestandig tape',
        popular: false,
      },
      {
        title: 'Striper i utskriften (banding) eller en farge mangler helt',
        desc: 'Kjør dysesjekk, følg rensetrappa og kontroller papirtype i driveren.',
        badge: 'Sublimering',
        url: '/kategori/sublimering#skriverproblemer',
        keywords: 'striper horisontale linjer banding en farge mangler helt borte skriverproblemer',
        popular: false,
      },
      {
        title: 'Kutte- og presseinnstillinger for Flexi Premium tekstilvinyl (HTV)',
        desc: 'Veiledende innstillinger for Silhouette og vaskeråd for tekstilvinyl.',
        badge: 'Vinyl og tekstil',
        url: 'https://creativeart.no/pages/kutteinstillinger',
        keywords: 'kutteinnstillinger kutteinstillinger silhouette kniv flexi premium htv tekstilvinyl',
        popular: false,
      },
      {
        title: 'Klargjøring av tekstiler og blanks (lo-rulle og forpressing)',
        desc: 'Slik unngår du fukt, støv og prikker i tekstiltrykket.',
        badge: 'Vinyl og tekstil',
        url: '/kategori/vinyl-og-tekstil#klargjoring-av-tekstil',
        keywords: 'klargjøring tekstil klær t-skjorte genser forpresse lo-rulle lorulle blanks polyester',
        popular: false,
      },
      {
        title: 'Vaskeråd og holdbarhet – fargen blekner etter vask',
        desc: 'Vent 24 timer før vask, vask på vranga og bruk 100 % polyester ved sublimering.',
        badge: 'Vinyl og tekstil',
        url: '/kategori/vinyl-og-tekstil#vask-og-holdbarhet',
        keywords: 'fargen blekner etter vask vaske vrangen kaldvask vaskeråd tørketrommel polyester bomull slites bort',
        popular: false,
      },
      {
        title: 'Små hvite eller blå prikker i trykket',
        desc: 'Skyldes fuktighet eller støv/lo – bruk lo-rulle og forpress i 10–15 sek.',
        badge: 'Vinyl og tekstil',
        url: '/kategori/vinyl-og-tekstil#problemer-pa-tekstil-og-emner',
        keywords: 'små hvite blå prikker støv lo fuktighet prikkete i trykket',
        popular: false,
      },
      {
        title: 'Firkantramme eller pressmerker rundt motivet',
        desc: 'Klipp papiret nærmere motivet, reduser trykket eller bruk beskyttelsespapir.',
        badge: 'Varmepresser',
        url: '/kategori/varmepresser#presseproblemer',
        keywords: 'firkantramme firkantmerke pressmerker ramme rundt motivet papirkant i stoffet',
        popular: false,
      },
      {
        title: 'Gulning på hvite områder etter pressing',
        desc: 'Temperaturen på varmepressen er for høy – senk med 5–10 °C.',
        badge: 'Varmepresser',
        url: '/kategori/varmepresser#presseproblemer',
        keywords: 'gulning gult svidd brent misfarging på hvite områder for høy temperatur',
        popular: false,
      },
      {
        title: 'Motivet fester seg ikke på koppen (koppepresse)',
        desc: 'Sjekk at koppen har sublimeringsbelegg (coating) og øk eventuelt temperaturen.',
        badge: 'Varmepresser',
        url: '/kategori/varmepresser#presseproblemer',
        keywords: 'motivet fester seg ikke på koppen kopp kopper krus koppepresse keramikk belegg coating',
        popular: false,
      },
      {
        title: 'Riktig lag-på-lag oppsett i varmepressen (teflonark og papir)',
        desc: 'Rekkefølge fra bunn til topp med beskyttelsespapir, emne, motiv og teflonark.',
        badge: 'Varmepresser',
        url: '/kategori/varmepresser#klargjoring-og-oppsett',
        keywords: 'lag på lag oppsett rekkefølge teflonark teflon beskyttelsespapir tegnepapir blowout',
        popular: false,
      },
      {
        title: 'Vedlikehold av varmepresse, IR-termometer og bytte av teflonark',
        desc: 'Månedlig temperatursjekk og når du bør bytte teflonarket.',
        badge: 'Varmepresser',
        url: '/kategori/varmepresser#vedlikehold-av-varmepresse',
        keywords: 'vedlikehold varmepresse ir-termometer måle temperatur bytte teflonark brennmerker',
        popular: false,
      },
      {
        title: 'Viktigste vedlikeholdsregler – ukentlig print (CMYK-chart)',
        desc: 'La skriveren stå PÅ, sjekk blekknivå og print 3–5 CMYK-chart hver uke.',
        badge: 'Sublimering',
        url: '/kategori/sublimering#viktigste-vedlikeholdsregler',
        keywords: 'vedlikehold rutine ukentlig daglig månedlig cmyk chart la skriveren stå på strøm ferie',
        popular: false,
      },
      {
        title: 'Skriveren stopper midt i print eller feillamper blinker (blekkpute)',
        desc: 'Bruk USB-kabel, full Epson-driver og sjekk om vedlikeholdstanken er full.',
        badge: 'Sublimering',
        url: '/kategori/sublimering#skriverproblemer',
        keywords: 'skriveren stopper midt i print wifi usb kabel driver airprint feillamper blinker blekkpute vedlikeholdstank avfallsblekk',
        popular: false,
      },
      {
        title: 'Oppbevaring av blekk, sublimeringspapir og luftfuktighet',
        desc: 'Romtemperatur (15–30 °C), luftfuktighet (35–65 %) og riktig side av papiret.',
        badge: 'Sublimering',
        url: '/kategori/sublimering#oppbevaring-blekk-og-papir',
        keywords: 'oppbevaring blekk flasker rulle utløpsdato sublimeringspapir belagt side luftfuktighet temperatur',
        popular: false,
      },
      {
        title: 'Produkter, blekk, papir og tilbehør – gå til nettbutikken',
        desc: 'Se hele utvalget vårt på creativeart.no.',
        badge: 'Produkter & tilbehør',
        url: 'https://creativeart.no/',
        keywords: 'produkter tilbehør nettbutikk kjøpe bestille blekk papir presse vinyl butikk',
        popular: false,
      },
    ];

    const STOP_WORDS = new Set(['hva', 'hvordan', 'hvorfor', 'hvilken', 'hvor', 'når', 'kan', 'skal', 'jeg', 'det', 'den', 'seg', 'ikke', 'er', 'på', 'i', 'og', 'til', 'for', 'med', 'av', 'en', 'et']);

    function normalizeText(str) {
      return str
        .toLowerCase()
        .replace(/venyl/g, 'vinyl')
        .replace(/sublemer|sublimir/g, 'sublimer')
        .replace(/varmpress/g, 'varmepress')
        .replace(/varmeinstill/g, 'varmeinnstill')
        .replace(/[^a-z0-9æøå\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function editDistance(a, b) {
      if (Math.abs(a.length - b.length) > 2) return 99;
      const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
      for (let j = 1; j <= b.length; j++) {
        let prev = dp[0];
        dp[0] = j;
        for (let i = 1; i <= a.length; i++) {
          const temp = dp[i];
          dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
          prev = temp;
        }
      }
      return dp[a.length];
    }

    function scoreItem(item, rawQuery) {
      const q = normalizeText(rawQuery);
      if (!q) return item.popular ? 10 : 0;

      const titleNorm = normalizeText(item.title);
      const fullNorm = `${titleNorm} ${normalizeText(item.desc)} ${normalizeText(item.keywords)} ${normalizeText(item.badge)}`;
      let score = 0;

      if (titleNorm.includes(q)) score += 60;
      else if (fullNorm.includes(q)) score += 35;

      const queryTokens = q.split(' ').filter((w) => w.length >= 2);
      const meaningfulTokens = queryTokens.filter((w) => !STOP_WORDS.has(w));
      const tokensToUse = meaningfulTokens.length > 0 ? meaningfulTokens : queryTokens;
      const targetWords = fullNorm.split(' ');

      for (const token of tokensToUse) {
        if (titleNorm.includes(token)) {
          score += 25;
        } else if (fullNorm.includes(token)) {
          score += 16;
        } else if (token.length >= 4) {
          const stem = token.slice(0, Math.max(4, token.length - 2));
          if (fullNorm.includes(stem)) {
            score += 12;
          } else {
            for (const tw of targetWords) {
              if (tw.length >= 4 && editDistance(token, tw) <= 2) {
                score += 10;
                break;
              }
            }
          }
        }
      }

      return score;
    }

    function escapeHtml(text) {
      return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
    }

    function highlightTitle(title, rawQuery) {
      const q = normalizeText(rawQuery);
      if (!q) return escapeHtml(title);
      const tokens = q.split(' ').filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
      const words = tokens.length > 0 ? tokens : q.split(' ').filter((w) => w.length >= 2);
      if (words.length === 0) return escapeHtml(title);

      const pattern = words
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
      if (!pattern) return escapeHtml(title);

      const regex = new RegExp(`(${pattern})`, 'gi');
      return escapeHtml(title).replace(regex, '<mark>$1</mark>');
    }

    let activeIndex = -1;
    let currentMatches = [];
    let selectedItem = null;

    function renderSuggestions() {
      const rawQuery = searchInput.value.trim();
      const scored = SUGGESTIONS
        .map((item) => ({ item, score: scoreItem(item, rawQuery) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score);

      currentMatches = (scored.length > 0 ? scored : SUGGESTIONS.filter((s) => s.popular).map((item) => ({ item, score: 1 })))
        .slice(0, 8)
        .map((entry) => entry.item);

      activeIndex = -1;
      suggestionList.innerHTML = '';

      currentMatches.forEach((item, index) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        const a = document.createElement('a');
        a.className = 'search-suggestion-item';
        a.href = siteUrl(item.url);
        a.innerHTML = `
          <span class="search-suggestion-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7"></circle>
              <path d="M20 20l-4.2-4.2"></path>
            </svg>
          </span>
          <span class="search-suggestion-body">
            <span class="search-suggestion-title">${highlightTitle(item.title, rawQuery)}</span>
            <span class="search-suggestion-desc">${escapeHtml(item.desc)}</span>
          </span>
          <span class="search-suggestion-badge">${escapeHtml(item.badge)}</span>
        `;
        a.addEventListener('mouseenter', () => {
          setActive(index, false);
        });
        a.addEventListener('click', (event) => {
          // Fyll inn forslaget i søkefeltet først, slik at kunden trykker Søk/Enter for å gå videre.
          event.preventDefault();
          selectedItem = item;
          searchInput.value = item.title;
          suggestionList.hidden = true;
          searchInput.focus();
        });
        li.appendChild(a);
        suggestionList.appendChild(li);
      });

      suggestionList.hidden = currentMatches.length === 0;
    }

    function setActive(index, fillInput = false) {
      const links = suggestionList.querySelectorAll('.search-suggestion-item');
      links.forEach((el, idx) => {
        el.classList.toggle('is-active', idx === index);
      });
      activeIndex = index;
      if (fillInput && currentMatches[index]) {
        selectedItem = currentMatches[index];
        searchInput.value = currentMatches[index].title;
      }
    }

    searchInput.addEventListener('focus', renderSuggestions);
    searchInput.addEventListener('click', renderSuggestions);
    searchInput.addEventListener('input', () => {
      selectedItem = null;
      renderSuggestions();
    });

    searchInput.addEventListener('keydown', (event) => {
      if (suggestionList.hidden || currentMatches.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((activeIndex + 1) % currentMatches.length, true);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((activeIndex - 1 + currentMatches.length) % currentMatches.length, true);
      } else if (event.key === 'Escape') {
        suggestionList.hidden = true;
      }
    });

    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Node)) return;
      if (!searchForm.contains(event.target)) {
        suggestionList.hidden = true;
      }
    });

    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (selectedItem) {
        location.href = siteUrl(selectedItem.url);
        return;
      }
      if (currentMatches.length === 0) {
        renderSuggestions();
      }
      const chosen = activeIndex >= 0 && currentMatches[activeIndex]
        ? currentMatches[activeIndex]
        : currentMatches[0];
      if (chosen) {
        location.href = siteUrl(chosen.url);
      }
    });
  }

  // Rullegardin (trekkspill) for Markdown-artikler med 2 eller flere H2-overskrifter.
  function labelResponsiveTables(root) {
    const tables = root.querySelectorAll('table');
    for (const table of tables) {
      const headers = Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent || '').trim());
      if (headers.length === 0) continue;
      for (const row of table.querySelectorAll('tbody tr')) {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, idx) => {
          if (!cell.hasAttribute('data-label') && headers[idx]) {
            cell.setAttribute('data-label', headers[idx]);
          }
        });
      }
    }
  }

  function createSvgIcon(pathD, size, strokeWidth) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', String(strokeWidth));
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of pathD) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }
    return svg;
  }

  function enhanceMarkdownArticles() {
    const containers = document.querySelectorAll('[data-collapsible-markdown]');
    for (const container of containers) {
      const directHeadings = Array.from(container.children).filter((el) => el.tagName === 'H2');
      if (directHeadings.length < 2) continue;

      const article = container.closest('.article');
      if (article) article.classList.add('article-guide');
      const layout = container.closest('.article-layout');
      if (layout) layout.classList.add('article-layout-collapsible');

      const introNodes = [];
      const groups = [];
      let current = null;

      for (const node of Array.from(container.childNodes)) {
        if (node instanceof Element && node.tagName === 'H2') {
          current = { heading: node, nodes: [] };
          groups.push(current);
        } else if (current === null) {
          introNodes.push(node);
        } else if (!(node instanceof Element && node.tagName === 'HR')) {
          current.nodes.push(node);
        }
      }

      container.textContent = '';

      if (introNodes.some((n) => n.nodeType === Node.ELEMENT_NODE || (n.textContent || '').trim() !== '')) {
        const introWrap = document.createElement('div');
        introWrap.className = 'guide-intro prose';
        for (const n of introNodes) introWrap.appendChild(n);
        container.appendChild(introWrap);
      }

      const controls = document.createElement('div');
      controls.className = 'guide-controls';
      const hint = document.createElement('p');
      hint.className = 'guide-hint';
      const infoIcon = createSvgIcon(['M12 16v-4', 'M12 8h.01'], 20, 2);
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '9');
      infoIcon.prepend(circle);
      const hintText = document.createElement('span');
      hintText.textContent = 'Trykk på et tema under for å åpne og lese veiledningen.';
      hint.append(infoIcon, hintText);

      const toggleAll = document.createElement('button');
      toggleAll.type = 'button';
      toggleAll.className = 'guide-toggle-all';
      toggleAll.setAttribute('data-guide-toggle-all', '');
      toggleAll.setAttribute('aria-expanded', 'false');
      toggleAll.textContent = 'Åpne alle temaer';

      controls.append(hint, toggleAll);
      container.appendChild(controls);

      const list = document.createElement('div');
      list.className = 'guide-sections';

      groups.forEach((group, index) => {
        const details = document.createElement('details');
        details.className = 'guide-section';
        if (group.heading.id) {
          details.id = group.heading.id;
          group.heading.removeAttribute('id');
        }

        const summary = document.createElement('summary');
        summary.className = 'guide-toggle';

        const step = document.createElement('span');
        step.className = 'guide-step';
        step.setAttribute('aria-hidden', 'true');
        step.textContent = String(index + 1);

        const headingWrap = document.createElement('span');
        headingWrap.className = 'guide-heading';
        group.heading.classList.add('guide-title');
        const headingText = group.heading.textContent || '';
        const cardHeading = headingText.replace(/^\d+\.\s*/, '');
        if (cardHeading !== headingText) {
          group.heading.textContent = cardHeading;
        }
        headingWrap.appendChild(group.heading);

        const action = document.createElement('span');
        action.className = 'guide-action';
        action.setAttribute('aria-hidden', 'true');
        const chevron = createSvgIcon(['M6 9l6 6 6-6'], 20, 2.4);
        chevron.classList.add('guide-chevron');
        action.append(chevron);

        summary.append(step, headingWrap, action);

        const body = document.createElement('div');
        body.className = 'guide-body prose';
        for (const n of group.nodes) body.appendChild(n);
        labelResponsiveTables(body);

        details.append(summary, body);
        list.appendChild(details);
      });

      container.appendChild(list);
    }
  }

  enhanceMarkdownArticles();

  // Felles styring for rullegardin-temaene: «Åpne alle», «Lukk dette temaet», TOC og #lenker.
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function syncGuideToggleAll() {
    const sections = Array.from(document.querySelectorAll('details.guide-section'));
    if (sections.length === 0) return;
    const allOpen = sections.every((el) => el instanceof HTMLDetailsElement && el.open);
    for (const btn of document.querySelectorAll('[data-guide-toggle-all]')) {
      btn.textContent = allOpen ? 'Lukk alle temaer' : 'Åpne alle temaer';
      btn.setAttribute('aria-expanded', allOpen ? 'true' : 'false');
    }
  }

  function highlightSection(details) {
    details.classList.remove('is-highlighted');
    void details.offsetWidth;
    details.classList.add('is-highlighted');
    window.setTimeout(() => {
      details.classList.remove('is-highlighted');
    }, 1800);
  }

  function openSectionForHash(hash, shouldScroll) {
    if (!hash || hash.length < 2) return false;
    let id;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch (error) {
      id = hash.slice(1);
    }
    const target = document.getElementById(id);
    if (!target) return false;
    const details = target.closest('details.guide-section');
    if (!(details instanceof HTMLDetailsElement)) return false;

    details.open = true;
    syncGuideToggleAll();
    highlightSection(details);

    if (shouldScroll) {
      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
      target.scrollIntoView({ behavior, block: 'start' });
    }
    return true;
  }

  document.addEventListener('toggle', (event) => {
    if (event.target instanceof HTMLDetailsElement && event.target.classList.contains('guide-section')) {
      syncGuideToggleAll();
    }
  }, true);

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;

    const toggleAllBtn = event.target.closest('[data-guide-toggle-all]');
    if (toggleAllBtn) {
      const sections = Array.from(document.querySelectorAll('details.guide-section'));
      const allOpen = sections.every((el) => el instanceof HTMLDetailsElement && el.open);
      for (const section of sections) {
        if (section instanceof HTMLDetailsElement) section.open = !allOpen;
      }
      syncGuideToggleAll();
      return;
    }

    const tocLink = event.target.closest('.toc a[href^="#"]');
    if (tocLink instanceof HTMLAnchorElement) {
      const hash = tocLink.getAttribute('href') || '';
      if (openSectionForHash(hash, true)) {
        event.preventDefault();
        try { history.replaceState(null, '', hash); } catch (error) { /* ignorer */ }
      }
    }
  });

  window.addEventListener('hashchange', () => {
    openSectionForHash(location.hash, true);
  });

  if (location.hash) {
    openSectionForHash(location.hash, true);
  }
  syncGuideToggleAll();
})();
