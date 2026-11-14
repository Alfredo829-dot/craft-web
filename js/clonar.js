/* Pestaña Clonar: crea una primera versión propia de un sitio o app (estilo Craft Anything) */
const SISTEMA_CLON = `Eres un desarrollador front-end experto. Creas apps web de UNA sola página en UN solo archivo HTML con el CSS y el JavaScript dentro.
Reglas:
- Pensada primero para celular (pantalla de 390px), se ve moderna y bonita, y también se adapta a escritorio.
- Textos en español de México.
- Debe FUNCIONAR de verdad, no solo verse: botones, formularios, listas y navegación con JavaScript. Guarda datos en localStorage cuando tenga sentido.
- Sin dependencias obligatorias. No uses imágenes externas: usa emojis, SVG en línea o degradados.
- Marca PROPIA y original: inventa un nombre y un logo SVG simple. No copies logos, marcas, textos legales ni contenido con derechos.
- Responde SOLO con el código HTML completo, desde <!DOCTYPE html> hasta </html>. Nada de explicaciones ni bloques markdown.`;

/* El iframe de vista previa no tiene acceso a localStorage (sandbox); le damos uno en memoria */
const SHIM_STORAGE = `<script>(function(){try{window.localStorage.getItem('x')}catch(e){var mk=function(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}};try{Object.defineProperty(window,'localStorage',{value:mk(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:mk(),configurable:true})}catch(_){}}})();<\/script>`;
function inyectarHead(html, codigo) { return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + codigo) : codigo + html; }
const EJEMPLOS_CLON = { url: ['wikipedia.org', 'duolingo.com', 'trello.com', 'spotify.com'], idea: ['Lista de tareas con categorías', 'Calculadora de propinas', 'Menú digital para taquería', 'Control de gastos con gráfica'] };
const CAMBIOS_RAPIDOS = ['Ponle modo oscuro', 'Hazla más colorida', 'Agrega sección de contacto', 'Agrega botón de WhatsApp'];

const Clonar = {
  modo: 'url', actual: null, ultimoPedido: null, ocupado: false,

  iniciar() {
    $$('#cModo button').forEach(b => b.onclick = () => this.ponerModo(b.dataset.modo));
    $('#cGenerar').onclick = () => this.crear();
    $('#cEnviar').onclick = () => this.cambiar();
    $$('[data-c]').forEach(b => b.onclick = () => this.accion(b.dataset.c));
    $('#cPantallaCerrar').onclick = () => { $('#cPantalla').hidden = true; $('#cFrameGrande').srcdoc = ''; };
    $('#cRapidos').innerHTML = CAMBIOS_RAPIDOS.map(t => `<button>${t}</button>`).join('');
    $$('#cRapidos button').forEach(b => b.onclick = () => { $('#cCambio').value = b.textContent; });
    this.ponerModo('url');
    this.pintarProyectos();
  },
  ponerModo(m) {
    this.modo = m;
    $$('#cModo button').forEach(x => x.classList.toggle('activo', x.dataset.modo === m));
    $$('.c-url').forEach(e => e.hidden = m !== 'url');
    $('#cIdeaTit').innerHTML = m === 'url' ? 'Detalles <span class="muted">(opcional)</span>' : '¿Qué app quieres?';
    $('#cEjemplos').innerHTML = EJEMPLOS_CLON[m].map(t => `<button>${t}</button>`).join('');
    $$('#cEjemplos button').forEach(b => b.onclick = () => { if (m === 'url') $('#cUrl').value = b.textContent; else $('#cIdea').value = b.textContent; });
  },
  estado(t, cls = '') { const e = $('#cEstado'); e.textContent = t; e.className = 'estado ' + cls; },

  /* ---------- Leer un sitio (Jina Reader y, si falla, dos proxys públicos) ---------- */
  async leerSitio(url) {
    const intentos = [
      async s => { const r = await fetch('https://r.jina.ai/' + url, { headers: { Accept: 'text/plain' }, signal: s }); if (!r.ok) throw new Error(r.status); return (await r.text()).slice(0, 9000); },
      async s => { const r = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url), { signal: s }); if (!r.ok) throw new Error(r.status); return this.extraer(await r.text()); },
      async s => { const r = await fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url), { signal: s }); if (!r.ok) throw new Error(r.status); return this.extraer(await r.text()); },
    ];
    for (const f of intentos) {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
      try { const txt = await f(c.signal); if (txt && txt.replace(/\s+/g, ' ').trim().length > 120) return txt; } catch (e) {} finally { clearTimeout(t); }
    }
    return null;
  },
  extraer(html) {
    const d = new DOMParser().parseFromString(html, 'text/html');
    d.querySelectorAll('script,style,noscript,svg,iframe').forEach(e => e.remove());
    const q = (s, n = 30) => [...d.querySelectorAll(s)].map(e => e.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, n);
    const meta = (d.querySelector('meta[name=description]') || {}).content || '';
    return [`Título: ${d.title}`, `Descripción: ${meta}`, `Menú: ${q('nav a, header a').join(' | ')}`, `Encabezados: ${q('h1,h2,h3').join(' | ')}`,
      `Botones: ${q('button, a.btn, [role=button], input[type=submit]').join(' | ')}`, `Formularios: ${q('label, input[placeholder]').join(' | ')}`,
      `Texto: ${(d.body ? d.body.textContent : '').replace(/\s+/g, ' ').slice(0, 5000)}`].join('\n');
  },

  /* ---------- Validar el HTML que regresa cada IA ---------- */
  limpiar(t) {
    let s = String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
    const m = s.match(/```(?:html|HTML|htm)?[ \t]*\n([\s\S]*?)(?:```|$)/);
    if (m && /<html|<!doctype/i.test(m[1])) s = m[1];
    const i = s.search(/<!doctype html|<html/i); if (i > 0) s = s.slice(i);
    const f = s.toLowerCase().lastIndexOf('</html>'); if (f >= 0) s = s.slice(0, f + 7);
    return s.trim();
  },
  probarEnIframe(html) {
    return new Promise(ok => {
      const id = uid(); const errores = []; let listo = false, txt = 0;
      const sonda = `<script>(function(){var I="${id}";function e(m){parent.postMessage({cwSonda:I,err:String(m).slice(0,200)},"*")}window.onerror=function(m){e(m)};window.addEventListener("unhandledrejection",function(x){e(x.reason)});window.addEventListener("load",function(){setTimeout(function(){parent.postMessage({cwSonda:I,ok:1,txt:(document.body?document.body.innerText.length:0)},"*")},400)})})();<\/script>`;
      const fr = document.createElement('iframe'); fr.setAttribute('sandbox', 'allow-scripts');
      fr.style.cssText = 'position:fixed;left:-9999px;top:0;width:390px;height:844px;border:0';
      const fin = () => { if (listo) return; listo = true; window.removeEventListener('message', oir); fr.remove(); ok({ errores, txt }); };
      const oir = ev => { const d = ev.data || {}; if (d.cwSonda !== id) return; if (d.err) errores.push(d.err); if (d.ok) { txt = d.txt; setTimeout(fin, 300); } };
      window.addEventListener('message', oir); document.body.appendChild(fr); fr.srcdoc = inyectarHead(html, SHIM_STORAGE + sonda); setTimeout(fin, 4500);
    });
  },
  async validar(texto) {
    const html = Clonar.limpiar(texto);
    const tieneHtml = /<html/i.test(html), body = /<body/i.test(html), cierra = /<\/html>\s*$/i.test(html);
    if (!tieneHtml || html.length < 200) return { ok: false, puntos: 0, texto: html, info: 'no regresó HTML' };
    const p = await Clonar.probarEnIframe(html);
    const puntos = (cierra ? 40 : 0) + (body ? 10 : 0) + (p.errores.length ? 0 : 30) + Math.min(html.length / 15000, 1) * 15 + (/<script/i.test(html) ? 5 : 0) + (p.txt > 50 ? 5 : 0);
    return { ok: cierra, puntos, texto: html, info: `${cierra ? 'completo' : 'cortado'}, ${p.errores.length} errores`, errores: p.errores };
  },

  /* ---------- Generar con todas las IA y quedarse con la mejor ---------- */
  async correr(msgs, pregunta) {
    if (this.ocupado) return null;
    if (!navigator.onLine) { this.estado('📡 Sin internet. Conéctate para usar la IA.', 'err'); return null; }
    this.ocupado = true; const btns = [$('#cGenerar'), $('#cEnviar')]; btns.forEach(b => { b.disabled = true; b.classList.add('cargando'); });
    const t0 = Date.now(); let n = AI.disponibles().length;
    const reloj = setInterval(() => this.estado(`✍️ ${n} IA escribiendo tu app al mismo tiempo… ${Math.round((Date.now() - t0) / 1000)} s`), 500);
    try {
      const res = await AI.todos(msgs, { validar: this.validar, ventana: 25000, tope: 150000, onProgreso: (r, provs) => { n = provs.length; pintarProgreso($('#cProgreso'), provs, r); } });
      clearInterval(reloj);
      if (res.some(r => r.ok && !(r.errores && r.errores.length))) res.forEach(r => { if (r.errores && r.errores.length) r.ok = false; });
      this.estado('🧑‍⚖️ Comparando las respuestas para escoger la mejor…');
      const { orden, juez } = await AI.elegirMejor(res, { pregunta, resumir: c => `(${c.texto.length} caracteres, ${c.info})\n${c.texto.slice(0, 3500)}` });
      let g = orden[0], aviso = '';
      if (!g) { g = res.filter(r => r.texto && r.texto.length > 200).sort((a, b) => b.puntos - a.puntos)[0]; aviso = ' ⚠️ Puede estar incompleta; prueba Regenerar.'; }
      if (!g) { this.estado('Ninguna IA respondió bien esta vez. Espera unos segundos y toca otra vez el botón.', 'err'); return null; }
      pintarProgreso($('#cProgreso'), AI.disponibles(), res, g.id);
      this.estado(`✅ Lista en ${Math.round((Date.now() - t0) / 1000)} s · respondieron ${res.filter(r => r.texto).length} de ${res.length} IA.${aviso}`, aviso ? 'err' : 'ok');
      return { html: g.texto, gano: g.nombre + (juez ? ' · eligió ' + juez : '') };
    } catch (e) { clearInterval(reloj); this.estado('Algo falló: ' + e.message, 'err'); return null; }
    finally { clearInterval(reloj); this.ocupado = false; btns.forEach(b => { b.disabled = false; b.classList.remove('cargando'); }); }
  },

  async crear(repetir) {
    let pedido = repetir;
    if (!pedido) {
      const idea = $('#cIdea').value.trim(); let url = $('#cUrl').value.trim();
      if (this.modo === 'url') {
        if (!url) { toast('Pega el link del sitio'); $('#cUrl').focus(); return; }
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        try { new URL(url); } catch (e) { toast('Ese link no se ve bien'); return; }
        this.estado('🔎 Leyendo el sitio…');
        const contenido = await this.leerSitio(url);
        pedido = { tipo: 'url', url, idea, leido: !!contenido, texto: `Crea una primera versión PROPIA y original de una app parecida a este sitio: ${url}\n` +
          (contenido ? `Esto es lo que contiene (estructura y textos):\n"""\n${contenido.slice(0, 7000)}\n"""\n` : 'No pude leer el sitio; básate en lo que sabes de él por su dirección.\n') +
          `Recrea sus secciones y funciones principales con diseño y marca propios.${idea ? '\nDetalles extra: ' + idea : ''}` };
        if (!contenido) toast('No pude leer el sitio; la IA lo hará con lo que sabe de él');
      } else {
        if (!idea) { toast('Describe la app que quieres'); $('#cIdea').focus(); return; }
        pedido = { tipo: 'idea', idea, texto: `Crea esta app: ${idea}` };
      }
    }
    this.ultimoPedido = { inicial: pedido };
    const r = await this.correr([{ role: 'system', content: SISTEMA_CLON }, { role: 'user', content: pedido.texto }],
      `¿Cuál de estas apps HTML cumple mejor esta petición: "${(pedido.idea || pedido.url || '').slice(0, 300)}"? Valora que esté completa, que funcione y que se vea bien en celular.`);
    if (!r) return;
    const mismoId = this.actual && repetir ? this.actual.id : null;
    this.actual = { id: mismoId, html: r.html, pedido, chat: [{ yo: false, t: `Primera versión lista (ganó ${r.gano}).${pedido.tipo === 'url' && !pedido.leido ? ' No pude leer el sitio, así que me basé en lo que sé de él.' : ''}` }], fecha: Date.now() };
    this.mostrar(r.gano);
  },
  async cambiar(repetirCambio) {
    if (!this.actual) { toast('Primero crea una app'); return; }
    const cambio = repetirCambio || $('#cCambio').value.trim(); if (!cambio) { toast('Escribe qué quieres cambiar'); $('#cCambio').focus(); return; }
    if (!repetirCambio) { this.actual.chat.push({ yo: true, t: cambio }); this.pintarChat(); }
    this.ultimoPedido = { cambio };
    const r = await this.correr([{ role: 'system', content: SISTEMA_CLON },
      { role: 'user', content: `Este es el código actual de la app:\n\n${this.actual.html}\n\nAplica este cambio: ${cambio}\n\nConserva todo lo demás que funciona. Devuelve el archivo HTML COMPLETO actualizado.` }],
      `¿Cuál versión aplica mejor el cambio "${cambio.slice(0, 300)}" sin romper lo demás y está completa?`);
    if (!r) { this.actual.chat.push({ yo: false, t: 'No se pudo aplicar. Toca Regenerar para intentar otra vez.' }); this.pintarChat(); return; }
    $('#cCambio').value = '';
    this.actual.html = r.html; this.actual.chat.push({ yo: false, t: `Listo, cambio aplicado (ganó ${r.gano}).` });
    this.mostrar(r.gano); if (this.actual.id) this.guardar(true);
  },
  mostrar(gano) {
    $('#cResultado').hidden = false; $('#cFrame').srcdoc = inyectarHead(this.actual.html, SHIM_STORAGE);
    $('#cInfo').textContent = gano ? 'Ganó: ' + gano : '';
    $('#cCodigo').textContent = this.actual.html; this.pintarChat();
    $('#cResultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  pintarChat() { $('#cChat').innerHTML = (this.actual ? this.actual.chat : []).map(m => `<div class="m ${m.yo ? 'yo' : 'ia'}">${escaparHTML(m.t)}</div>`).join(''); },
  titulo(html) { const m = html.match(/<title>([^<]{1,80})<\/title>/i); return m ? m[1].trim() : 'Mi app'; },
  accion(a) {
    if (!this.actual) return;
    if (a === 'regenerar') { if (this.ultimoPedido && this.ultimoPedido.cambio) this.cambiar(this.ultimoPedido.cambio); else this.crear(this.actual.pedido); }
    if (a === 'codigo') { const p = $('#cCodigo'); p.hidden = !p.hidden; $('[data-c=codigo]').classList.toggle('activo', !p.hidden); }
    if (a === 'descargar') { descargar(new Blob([this.actual.html], { type: 'text/html' }), this.titulo(this.actual.html).toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '') + '.html'); toast('Archivo .html descargado ✅'); }
    if (a === 'guardar') this.guardar();
    if (a === 'abrir') window.open(URL.createObjectURL(new Blob([this.actual.html], { type: 'text/html' })), '_blank');
    if (a === 'pantalla') { $('#cFrameGrande').srcdoc = inyectarHead(this.actual.html, SHIM_STORAGE); $('#cPantalla').hidden = false; }
  },
  async guardar(silencio) {
    if (!this.actual.id) this.actual.id = 'clon:' + uid();
    this.actual.nombre = this.titulo(this.actual.html); this.actual.fecha = Date.now();
    await DB.set(this.actual.id, JSON.parse(JSON.stringify(this.actual)));
    if (!silencio) toast('Guardado en Mis apps 💾'); this.pintarProyectos();
  },
  async pintarProyectos() {
    const ks = await DB.llaves('clon:'); const items = [];
    for (const k of ks) { const v = await DB.get(k); if (v) items.push(v); }
    items.sort((a, b) => b.fecha - a.fecha);
    $('#cCuenta').textContent = items.length ? `(${items.length})` : '';
    const ul = $('#cProyectos'); ul.innerHTML = items.length ? '' : '<li class="vacio"><b>Aún no guardas apps</b>Crea una y toca 💾 Guardar.</li>';
    items.forEach(v => {
      const li = document.createElement('li');
      li.innerHTML = `<button class="n">⚡ ${escaparHTML(v.nombre)} <span class="muted">· ${new Date(v.fecha).toLocaleDateString('es-MX')}</span></button><button aria-label="Borrar">🗑</button>`;
      li.querySelector('.n').onclick = () => { this.actual = v; this.ultimoPedido = { inicial: v.pedido }; this.mostrar(''); toast('Abierta: ' + v.nombre); };
      li.querySelector('[aria-label=Borrar]').onclick = async () => { if (!confirm('¿Borrar “' + v.nombre + '”?')) return; await DB.del(v.id); if (this.actual && this.actual.id === v.id) this.actual.id = null; this.pintarProyectos(); toast('App borrada'); };
      ul.appendChild(li);
    });
  },
};
