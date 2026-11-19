// Lenas sidepanel. Vanilla JS, ingen byggesteg.
(() => {
  'use strict';

  const panel = document.querySelector('.panel');
  const log = document.getElementById('log');
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const suggestions = document.getElementById('suggestions');
  const button = form.querySelector('button');
  const helpOrigin = panel.dataset.helpOrigin || '';
  const params = new URLSearchParams(location.search);
  const page = params.get('page') ? { url: params.get('page'), title: params.get('title') || '' } : null;

  // Enhetstokenet: 32 tilfeldige byte som base64url (43 tegn). Serveren lagrer bare en HMAC.
  const KEY = 'ca_agent_token';
  let memoryToken = null;
  function token() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored && /^[A-Za-z0-9_-]{43}$/.test(stored)) return stored;
    } catch (error) { /* lagring er sperret; bruk et token for denne visningen */ }
    if (!memoryToken) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      memoryToken = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      try { localStorage.setItem(KEY, memoryToken); } catch (error) { /* se over */ }
    }
    return memoryToken;
  }

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Alt escapes først. Deretter slipper bare fet skrift og lenker til kjente steder gjennom.
  function inline(text) {
    return escapeHtml(text)
      .replace(/\[([^\]]+)\]\((\/artikkel\/[a-z0-9-]+(?:#[a-z0-9-]+)?)\)/g,
        (match, label, path) => `<a href="${helpOrigin}${path}" target="_top">${label}</a>`)
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

  function add(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `msg msg-${role}`;
    if (role === 'visitor') {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = render(text);
    }
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  function busy(isBusy) {
    button.disabled = isBusy;
    input.disabled = isBusy;
    if (!isBusy) input.focus();
  }

  async function post(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agent-Token': token() },
      body: JSON.stringify(body),
    });
  }

  async function send(text) {
    suggestions.hidden = true;
    add('visitor', text);
    const bubble = add('lena', '');
    bubble.classList.add('msg-typing');
    busy(true);

    let answer = '';
    try {
      const response = await post('/conversation/send', { message: text, page });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure && failure.error ? failure.error.message : 'Noe gikk galt. Prøv igjen.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n\n')) !== -1) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === 'delta') {
            answer += event.text;
            bubble.classList.remove('msg-typing');
            bubble.innerHTML = render(answer);
            log.scrollTop = log.scrollHeight;
          }
        }
      }
      if (answer === '') throw new Error('Lena svarte ikke. Prøv igjen.');
    } catch (error) {
      bubble.classList.remove('msg-typing');
      bubble.classList.add('msg-error');
      bubble.textContent = error.message || 'Noe gikk galt. Prøv igjen.';
    } finally {
      busy(false);
    }
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

  // Hent samtalen denne enheten allerede har.
  post('/conversation/history', {})
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!data || !data.messages.length) return;
      suggestions.hidden = true;
      for (const message of data.messages) add(message.role === 'visitor' ? 'visitor' : 'lena', message.text);
    })
    .catch(() => { /* panelet virker uten historikk */ });

  input.focus();
})();
