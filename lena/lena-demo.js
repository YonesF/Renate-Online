// Lenas panel uten server, for den statiske utgaven av hjelpesenteret på GitHub Pages.
//
// Ligner spørsmålet et av spørsmålene som er tatt opp fra den ekte Lena i prototypen
// (answers.js), vises det ekte svaret, strømmet som i prototypen. Ellers søker demoen i
// hjelpesenterets egne tekster (search-index.js) og viser det beste avsnittet, tydelig
// merket som søk. Ingenting av det kunden skriver, sendes noe sted.
(() => {
  'use strict';

  const panel = document.querySelector('.panel');
  const log = document.getElementById('log');
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const suggestions = document.getElementById('suggestions');
  const button = form.querySelector('button');
  const helpOrigin = panel.dataset.helpOrigin || '..';
  const ANSWERS = (window.LENA_DEMO && window.LENA_DEMO.answers) || [];
  const SECTIONS = window.LENA_SEARCH || [];
  const STORE = 'ca_demo_chat';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------ visning (som i panel.js)
  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Lenker til artikler og temaer peker inn i den statiske utgaven, med skråstrek til slutt.
  function siteLink(path) {
    const m = path.match(/^\/(artikkel|kategori)\/([a-z0-9-]+)(#[a-z0-9-]+)?$/);
    return m ? `${helpOrigin}/${m[1]}/${m[2]}/${m[3] || ''}` : `${helpOrigin}${path}`;
  }

  function inline(text) {
    return escapeHtml(text)
      .replace(/\[([^\]]+)\]\((\/(?:artikkel|kategori)\/[a-z0-9-]+(?:#[a-z0-9-]+)?)\)/g,
        (match, label, path) => `<a href="${siteLink(path)}" target="_top">${label}</a>`)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function render(text) {
    const html = [];
    let list = null;
    let paragraph = [];
    const closeParagraph = () => {
      if (paragraph.length) html.push(`<p>${paragraph.join('<br>')}</p>`);
      paragraph = [];
    };
    const closeList = () => {
      if (list) html.push(`</${list}>`);
      list = null;
    };
    for (const raw of text.split('\n')) {
      const line = raw.trimEnd();
      const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      if (ordered || bullet) {
        closeParagraph();
        const type = ordered ? 'ol' : 'ul';
        if (list !== type) { closeList(); html.push(`<${type}>`); list = type; }
        html.push(`<li>${inline((ordered || bullet)[1])}</li>`);
      } else if (line.trim() === '') {
        closeParagraph();
        closeList();
      } else {
        closeList();
        paragraph.push(inline(line.replace(/^#{1,6}\s+/, '')));
      }
    }
    closeParagraph();
    closeList();
    return html.join('');
  }

  function bubbleHtml(text, note) {
    return (note ? `<p class="msg-demo-note">${escapeHtml(note)}</p>` : '') + render(text);
  }

  function add(role, text, note) {
    const bubble = document.createElement('div');
    bubble.className = `msg msg-${role}`;
    if (role === 'visitor') bubble.textContent = text;
    else bubble.innerHTML = bubbleHtml(text, note);
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  function busy(isBusy) {
    button.disabled = isBusy;
    input.disabled = isBusy;
    if (!isBusy) input.focus();
  }

  // ------------------------------------------------------------------ samtalen følger med mellom sidene
  function load() {
    try { return JSON.parse(sessionStorage.getItem(STORE) || '[]'); } catch (error) { return []; }
  }
  function save(messages) {
    try { sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-40))); } catch (error) { /* uten lagring glemmes samtalen */ }
  }
  const history = load();

  // ------------------------------------------------------------------ gjenkjenning av spørsmål
  const STOP = new Set(('jeg du er en et ei det den de dette disse hva hvordan hvorfor hvor når kan skal bør må vil ' +
    'har hadde ha på i til av for fra med og eller om at som min mitt mine din ditt dine seg sin sitt meg deg oss ' +
    'dere nå så da også bare litt noen noe ikke ved etter før enn mer mest helt gjør gjøre gjorde få får fikk ' +
    'hjelp hjelpe trenger lurer the').split(' '));
  const normalize = (s) => s.toLowerCase().normalize('NFC').replace(/[^a-zæøå0-9]+/g, ' ').trim();
  function stem(word) {
    let w = word;
    for (let pass = 0; pass < 2; pass++) {
      const m = w.match(/^(.{3,}?)(ene|ane|ete|ende|heten|het|er|en|et|a|e)$/);
      if (!m) break;
      w = m[1];
    }
    return w;
  }
  const tokens = (s) => normalize(s).split(' ').filter((w) => w && !STOP.has(w)).map(stem);
  const same = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

  const entries = ANSWERS.map((a) => ({
    answer: a,
    phrases: [a.q, ...(a.aliases || [])].map(normalize).filter((p) => p.length >= 3),
    words: [...new Set([a.q, ...(a.aliases || [])].flatMap(tokens))],
  }));
  const df = new Map();
  for (const e of entries) for (const w of e.words) df.set(w, (df.get(w) || 0) + 1);
  // Ord som ikke finnes i noe innspilt spørsmål («tre uker»), skal ikke veie mer enn nøkkelordene.
  const idf = (w) => (df.has(w) ? Math.log(1 + entries.length / df.get(w)) : 1);

  function bestRecorded(text) {
    const query = normalize(text);
    const words = [...new Set(tokens(text))];
    if (!words.length && !query) return null;
    let best = null;
    for (const e of entries) {
      const phrase = e.phrases.some((p) => ` ${query} `.includes(` ${p} `));
      let hit = 0;
      let total = 0;
      let matched = 0;
      for (const w of words) {
        const weight = idf(w);
        total += weight;
        if (e.words.some((k) => same(w, k))) {
          hit += weight;
          matched += 1;
        }
      }
      const coverage = total ? hit / total : 0;
      const score = (phrase ? 1 : 0) + coverage;
      if (!best || score > best.score) best = { e, score, coverage, phrase, matched };
    }
    if (!best) return null;
    // Et innspilt svar brukes bare når det tydelig gjelder samme spørsmål:
    // en kjent formulering, eller minst to nøkkelord som dekker det meste av spørsmålet.
    if (best.phrase && best.coverage >= 0.4) return best.e.answer;
    if (best.matched >= 2 && best.coverage >= 0.75) return best.e.answer;
    return null;
  }

  // ------------------------------------------------------------------ søk i hjelpesenteret
  const docs = SECTIONS.map((s) => ({ s, title: tokens(s.title), body: tokens(`${s.page} ${s.text}`) }));
  const avgLen = docs.reduce((n, d) => n + d.body.length, 0) / Math.max(1, docs.length);
  const docFreq = new Map();
  for (const d of docs) for (const w of new Set([...d.title, ...d.body])) docFreq.set(w, (docFreq.get(w) || 0) + 1);

  function search(text) {
    const words = [...new Set(tokens(text))];
    if (!words.length) return [];
    const scored = docs.map((d) => {
      let score = 0;
      for (const w of words) {
        const n = docFreq.get(w) || 0;
        const weight = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
        const tf = d.body.filter((k) => same(w, k)).length;
        const inTitle = d.title.some((k) => same(w, k)) ? 1 : 0;
        // Sammensatte ord: «rens» skal også treffe «hoderens».
        const inside = tf === 0 && w.length >= 4 && d.body.some((k) => k.length > w.length && k.includes(w)) ? 0.4 : 0;
        score += weight * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * d.body.length / avgLen)) + inTitle * 1.5 + inside);
      }
      return { s: d.s, score };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
    return scored.length && scored[0].score >= 2 ? scored : [];
  }

  function excerpt(text, max = 320) {
    const clean = text.replace(/\n{2,}/g, '\n').trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
    return `${(end > max * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '')).trim()} …`;
  }

  const linkTo = (s) => `/${s.url.replace(/\/(#|$)/, '$1')}`;

  function reply(text) {
    const recorded = bestRecorded(text);
    if (recorded) return { text: recorded.answer };
    const hits = search(text);
    if (hits.length) {
      const [first, second] = hits;
      let answer = 'Lena har ikke et innspilt svar på akkurat dette i demoen, men dette står i hjelpesenteret:\n\n'
        + `**${first.s.title}** (${first.s.page})\n${excerpt(first.s.text)}\n\n`
        + `Les hele avsnittet: [${first.s.title}](${linkTo(first.s)})`;
      if (second && second.score >= first.score * 0.6 && second.s.url.split('#')[0] !== first.s.url.split('#')[0]) {
        answer += `\n\nSe også: [${second.s.title}](${linkTo(second.s)})`;
      }
      return { text: answer, note: 'Demo – søk i hjelpesenteret' };
    }
    return {
      text: 'Lena har ikke et innspilt svar på dette i demoen, og jeg fant ikke noe som passer i hjelpesenteret. '
        + 'Prøv et av spørsmålene under, eller ta kontakt via [creativeart.no](https://creativeart.no/pages/kontakt).',
      note: 'Demo',
      chips: true,
    };
  }

  // ------------------------------------------------------------------ sending og strømming
  function showChips() {
    const picks = ANSWERS.filter((a) => a.chip).concat(ANSWERS.filter((a) => ['striper', 'lese-dysesjekk', 'pakke'].includes(a.id)));
    suggestions.innerHTML = '';
    for (const a of picks) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = a.q;
      suggestions.appendChild(chip);
    }
    log.appendChild(suggestions);
    suggestions.hidden = false;
    log.scrollTop = log.scrollHeight;
  }

  function stream(bubble, text, note) {
    return new Promise((resolve) => {
      if (reduceMotion) {
        bubble.innerHTML = bubbleHtml(text, note);
        resolve();
        return;
      }
      let shown = 0;
      const step = () => {
        shown = Math.min(text.length, shown + 7 + Math.floor(Math.random() * 9));
        bubble.innerHTML = bubbleHtml(text.slice(0, shown), note);
        log.scrollTop = log.scrollHeight;
        if (shown < text.length) window.setTimeout(step, 28);
        else resolve();
      };
      step();
    });
  }

  async function send(text) {
    suggestions.hidden = true;
    add('visitor', text);
    history.push({ role: 'visitor', text });
    save(history);
    const bubble = add('lena', '');
    bubble.classList.add('msg-typing');
    busy(true);
    const result = reply(text);
    await new Promise((r) => window.setTimeout(r, reduceMotion ? 0 : 650 + Math.random() * 450));
    bubble.classList.remove('msg-typing');
    await stream(bubble, result.text, result.note);
    history.push({ role: 'lena', text: result.text, note: result.note || null });
    save(history);
    busy(false);
    if (result.chips) showChips();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || button.disabled) return;
    input.value = '';
    input.style.height = '';
    send(text);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  });

  suggestions.addEventListener('click', (event) => {
    if (event.target instanceof HTMLButtonElement && !button.disabled) send(event.target.textContent.trim());
  });

  // For testing: hvilket svar demoen ville gitt, uten å vise det.
  window.lenaDemoReply = reply;

  // Samtalen fra forrige side vises igjen.
  if (history.length) {
    suggestions.hidden = true;
    for (const m of history) add(m.role, m.text, m.note);
  }

  input.focus();
})();
