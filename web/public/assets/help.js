// Åpner Lenas panel på hjelpesiden. Rammen lastes først når kunden åpner den.
(() => {
  'use strict';

  const panel = document.getElementById('chat');
  if (!panel) return;

  const origin = panel.dataset.origin;
  const launcher = document.getElementById('chat-launcher');
  const OPEN = 'ca_chat_open';

  function open() {
    if (!panel.querySelector('iframe')) {
      const frame = document.createElement('iframe');
      const query = new URLSearchParams({ page: location.pathname, title: document.title });
      frame.src = `${origin}/?${query}`;
      frame.title = 'Chat med Lena';
      panel.appendChild(frame);
    }
    panel.hidden = false;
    launcher.hidden = true;
    try { sessionStorage.setItem(OPEN, '1'); } catch (error) { /* uten lagring huskes ikke tilstanden */ }
  }

  function close() {
    panel.hidden = true;
    launcher.hidden = false;
    try { sessionStorage.removeItem(OPEN); } catch (error) { /* se over */ }
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-chat-open]')) { event.preventDefault(); open(); }
    if (event.target.closest('[data-chat-close]')) close();
  });

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
        a.href = item.url;
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
        location.href = selectedItem.url;
        return;
      }
      if (currentMatches.length === 0) {
        renderSuggestions();
      }
      const chosen = activeIndex >= 0 && currentMatches[activeIndex]
        ? currentMatches[activeIndex]
        : currentMatches[0];
      if (chosen) {
        location.href = chosen.url;
      }
    });
  }

  // Panelet følger med fra side til side.
  try { if (sessionStorage.getItem(OPEN) === '1') open(); } catch (error) { /* se over */ }
})();
