/*!
 * Renate Online – innbyggingsscript for CreativeArt.no
 *
 * Bruk (én linje i Shopify-temaet, f.eks. i en «Egendefinert Liquid»-seksjon eller theme.liquid):
 *   <script src="https://DIN-APP.vercel.app/embed.js" defer></script>
 *
 * Valgfrie attributter på script-taggen:
 *   data-position="left"   – plasser chatboblen nede til venstre
 *   data-label="Trenger du hjelp?" – tekst ved siden av boblen
 *
 * JavaScript-API (f.eks. fra en knapp på hjelpesiden):
 *   window.RenateOnline.open()                       – åpne chatten
 *   window.RenateOnline.open({ flyt: "tette-dyser" }) – åpne og start en feilsøkingsflyt
 *   window.RenateOnline.close()
 *
 * Designvalg: boblen ligger i Shadow DOM, så temaets CSS ikke påvirker den (og omvendt).
 * Selve chatten lastes i en iframe først når kunden klikker – den gjør ikke butikken tregere.
 */
(function () {
  "use strict";
  if (window.RenateOnline) return;

  var script = document.currentScript;
  var base = new URL(script ? script.src : "/embed.js", window.location.href).origin;
  var venstre = script && script.getAttribute("data-position") === "left";
  var etikett = (script && script.getAttribute("data-label")) || "";

  var host = document.createElement("div");
  host.id = "renate-online";
  host.style.cssText = "all: initial; position: fixed; z-index: 2147483000;";
  document.body.appendChild(host);
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  var side = venstre ? "left" : "right";
  root.innerHTML =
    "<style>" +
    ":host{all:initial}" +
    ".wrap{position:fixed;bottom:20px;" + side + ":20px;display:flex;align-items:center;gap:10px;flex-direction:" + (venstre ? "row" : "row-reverse") + ";font-family:Cabin,system-ui,sans-serif}" +
    ".knapp{width:58px;height:58px;border-radius:50%;border:0;background:#a61000;color:#fff;cursor:pointer;display:grid;place-items:center;box-shadow:0 6px 20px rgba(0,0,0,.22);transition:transform .15s ease,background .15s ease}" +
    ".knapp:hover{background:#8a0d00;transform:translateY(-2px)}" +
    ".knapp:focus-visible{outline:3px solid #fff;box-shadow:0 0 0 5px #a61000}" +
    ".knapp svg{width:27px;height:27px}" +
    ".etikett{background:#fff;color:#212326;border-radius:3px;padding:8px 12px;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,.14);white-space:nowrap}" +
    ".panel{position:fixed;bottom:92px;" + side + ":20px;width:400px;height:min(680px,calc(100vh - 120px));border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.25);opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .18s ease,transform .18s ease}" +
    ".panel.apen{opacity:1;transform:none;pointer-events:auto}" +
    ".panel.apen~.wrap .etikett{display:none}" +
    ".panel iframe{width:100%;height:100%;border:0;display:block}" +
    "@media (max-width:520px){.panel{inset:0;width:100%;height:100%;border-radius:0}.panel.apen~.wrap{display:none}}" +
    "@media (prefers-reduced-motion:reduce){.panel,.knapp{transition:none}}" +
    "</style>" +
    '<div class="panel" role="dialog" aria-label="Chat med Creative Art" aria-hidden="true"></div>' +
    '<div class="wrap">' +
    '<button class="knapp" type="button" aria-label="Åpne chat med Creative Art" aria-expanded="false">' +
    ikonChat() +
    "</button>" +
    (etikett ? '<span class="etikett">' + etikett.replace(/[<>&"]/g, "") + "</span>" : "") +
    "</div>";

  var panel = root.querySelector(".panel");
  var knapp = root.querySelector(".knapp");
  var iframe = null;
  var apen = false;

  function ikonChat() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12Z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width="2.6"/></svg>';
  }
  function ikonLukk() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  }

  function open(valg) {
    valg = valg || {};
    if (!iframe) {
      iframe = document.createElement("iframe");
      var url = new URL("/widget", base);
      url.searchParams.set("fra", window.location.pathname);
      if (valg.flyt) url.searchParams.set("flyt", valg.flyt);
      iframe.src = url.toString();
      iframe.title = "Chat med Creative Art";
      iframe.allow = "clipboard-write";
      panel.appendChild(iframe);
    } else if (valg.flyt) {
      iframe.contentWindow.postMessage({ type: "renate:start-flyt", id: valg.flyt }, base);
    }
    apen = true;
    panel.classList.add("apen");
    panel.setAttribute("aria-hidden", "false");
    knapp.setAttribute("aria-expanded", "true");
    knapp.setAttribute("aria-label", "Lukk chatten");
    knapp.innerHTML = ikonLukk();
    setTimeout(function () {
      if (iframe) iframe.focus();
    }, 200);
  }

  function close() {
    apen = false;
    panel.classList.remove("apen");
    panel.setAttribute("aria-hidden", "true");
    knapp.setAttribute("aria-expanded", "false");
    knapp.setAttribute("aria-label", "Åpne chat med Creative Art");
    knapp.innerHTML = ikonChat();
    knapp.focus();
  }

  knapp.addEventListener("click", function () {
    apen ? close() : open();
  });
  // Last chatten i forkant når musen nærmer seg, så den åpnes raskere.
  knapp.addEventListener(
    "pointerenter",
    function () {
      var l = document.createElement("link");
      l.rel = "prefetch";
      l.href = new URL("/widget", base).toString();
      document.head.appendChild(l);
    },
    { once: true }
  );
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && apen) close();
  });
  window.addEventListener("message", function (e) {
    if (e.origin !== base) return;
    if (e.data && e.data.type === "renate:lukk") close();
  });

  window.RenateOnline = { open: open, close: close, toggle: function () { apen ? close() : open(); } };
})();
