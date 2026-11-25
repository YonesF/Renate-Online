// Tar opp ekte svar fra Lena i prototypen til demo-chatten på GitHub Pages.
//
// Krever at prototypen kjører lokalt (docker compose up, port 8080). Hvert spørsmål
// sendes som en ny samtale (nytt enhetstoken) til Lenas eget endepunkt, akkurat som
// panelet i nettleseren gjør, og svaret lagres i lena/answers.js.
//
//   node tools/record-lena.mjs            alle spørsmål
//   node tools/record-lena.mjs hei pakke  bare disse (resten beholdes)
//
// Hvert spørsmål er ett kall til Claude med API-nøkkelen i prosjektets .env.

import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';

const SITE = path.resolve(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname.slice(1))), '..');
const OUT = path.join(SITE, 'lena', 'answers.js');
const AGENT_HOST = process.env.AGENT_HOST || 'agent.localhost:8080';
const ADDRESS = process.env.ADDRESS || '127.0.0.1';
const PORT = Number(process.env.PORT || 8080);

// Spørsmålene demoen kan svare på. «aliases» brukes bare til å kjenne igjen
// spørsmål med andre ord i demoen; de sendes ikke til Lena.
export const QUESTIONS = [
  { id: 'farge-mangler', q: 'Dysesjekken mangler en farge. Hva gjør jeg?', chip: true,
    aliases: ['mangler en farge', 'farge mangler', 'dysesjekken mangler', 'cyan mangler', 'magenta mangler', 'gul mangler', 'svart mangler', 'tette dyser', 'dysene er tette'] },
  { id: 'hvor-ofte-printe', q: 'Hvor ofte bør jeg printe?', chip: true,
    aliases: ['hvor ofte printe', 'hvor ofte skrive ut', 'printe hver uke', 'skrive ut jevnlig', 'står ubrukt'] },
  { id: 'ferie', q: 'Hva gjør jeg før ferien?', chip: true,
    aliases: ['ferie', 'reise bort', 'lang pause', 'ikke bruke skriveren', 'står stille lenge'] },
  { id: 'striper-etter-rens', q: 'Jeg har kjørt hoderens to ganger, men stripene er der fortsatt. Hva gjør jeg nå?',
    aliases: ['stripene er der fortsatt', 'striper etter rens', 'hoderens to ganger', 'fortsatt striper', 'rens hjelper ikke'] },
  { id: 'striper', q: 'Det kommer striper i utskriften. Hva gjør jeg?',
    aliases: ['striper', 'stripete', 'banding', 'linjer i utskriften', 'lyse striper', 'streker i trykket'] },
  { id: 'lese-dysesjekk', q: 'Hvordan leser jeg en dysesjekk?',
    aliases: ['lese dysesjekk', 'tolke dysesjekk', 'hva betyr dysesjekken', 'dysesjekk', 'nozzle check'] },
  { id: 'hoderens-trykkrens', q: 'Hva er forskjellen på hoderens og trykkrens?',
    aliases: ['hoderens', 'trykkrens', 'power clean', 'rensetrappa', 'forskjell rens'] },
  { id: 'feillamper', q: 'Skriveren stopper midt i utskriften og lampene blinker. Hva betyr det?',
    aliases: ['lampene blinker', 'stopper midt i', 'feillampe', 'blinker', 'skriveren stopper'] },
  { id: 'feil-farger', q: 'Rødt blir oransje og blått blir lilla. Hva er galt?',
    aliases: ['feil farger', 'rødt blir oransje', 'blått blir lilla', 'fargene blir feil', 'icc', 'fargeprofil'] },
  { id: 'blekkpute', q: 'Hvordan bytter jeg blekkpute eller vedlikeholdstank?',
    aliases: ['blekkpute', 'vedlikeholdstank', 'bytte tank', 'puten er full', 'maintenance box'] },
  { id: 'oppbevaring', q: 'Hvordan bør jeg oppbevare blekk og sublimeringspapir?',
    aliases: ['oppbevare', 'oppbevaring', 'lagre blekk', 'fuktig papir', 'luftfuktighet', 'holdbarhet'] },
  { id: 'slik-fungerer', q: 'Hvordan fungerer en sublimeringsskriver?',
    aliases: ['hvordan fungerer', 'hva er sublimering', 'konvertert skriver', 'sublimeringsskriver'] },
  { id: 'pakke', q: 'Hvor er pakken min?',
    aliases: ['pakke', 'pakken', 'bestilling', 'ordre', 'levering', 'sporing', 'når kommer', 'frakt'] },
  { id: 'retur', q: 'Kan jeg returnere en vare jeg har kjøpt?',
    aliases: ['retur', 'returnere', 'angrerett', 'bytte en vare', 'reklamasjon', 'pengene tilbake'] },
  { id: 'hei', q: 'Hei!',
    aliases: ['hei', 'hallo', 'heisann', 'god dag'] },
  { id: 'menneske', q: 'Er du et menneske?',
    aliases: ['menneske', 'robot', 'ekte person', 'kunstig intelligens', 'chatbot'] },
];

function send(message) {
  const token = crypto.randomBytes(32).toString('base64url');
  const body = JSON.stringify({ message, page: { url: '/', title: 'Hjelp – CreativeArt' } });
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: ADDRESS, port: PORT, path: '/conversation/send', method: 'POST',
      // Panelet kaller endepunktet fra sitt eget opphav; nettleseren merker det med Sec-Fetch-Site.
      headers: {
        Host: AGENT_HOST,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Agent-Token': token,
        'Sec-Fetch-Site': 'same-origin',
      },
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
        let answer = '';
        let status = 'open';
        for (const chunk of raw.split('\n\n')) {
          if (!chunk.startsWith('data: ')) continue;
          const event = JSON.parse(chunk.slice(6));
          if (event.type === 'delta') answer += event.text;
          if (event.type === 'done') status = event.status;
        }
        resolve({ answer: answer.trim(), handover: status === 'waiting' });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

async function existing() {
  try {
    const src = await fs.readFile(OUT, 'utf8');
    return JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1)).answers;
  } catch {
    return [];
  }
}

const only = process.argv.slice(2);
const before = await existing();
const answers = [];
for (const item of QUESTIONS) {
  const kept = before.find((a) => a.id === item.id);
  if (only.length && !only.includes(item.id)) {
    // Ikke valgt denne gangen: behold et tidligere opptak, ellers hopp over.
    if (kept) answers.push({ ...kept, q: item.q, chip: !!item.chip, aliases: item.aliases });
    continue;
  }
  const started = Date.now();
  const { answer, handover } = await send(item.q);
  if (!answer) throw new Error(`Tomt svar på «${item.q}»`);
  answers.push({ id: item.id, q: item.q, chip: !!item.chip, aliases: item.aliases, answer, handover });
  console.log(`${item.id.padEnd(20)} ${((Date.now() - started) / 1000).toFixed(1)} s  ${answer.length} tegn${handover ? '  (overlevering)' : ''}`);
}

const data = { recorded: new Date().toISOString().slice(0, 10), answers };
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, `// Ekte svar fra Lena i prototypen, tatt opp med tools/record-lena.mjs.\nwindow.LENA_DEMO = ${JSON.stringify(data, null, 2)};\n`, 'utf8');
console.log(`Lagret ${answers.length} svar i ${OUT}`);
