/* Arranque, pestañas, ajustes de IA y llaves cifradas con PIN */
const App = {
  tab: 'diseno',
  ir(tab) {
    this.tab = tab;
    $$('.tab').forEach(s => s.classList.toggle('activo', s.id === 'tab-' + tab));
    $$('.tabs button').forEach(b => b.classList.toggle('activo', b.dataset.tab === tab));
    $('#btnAjustes').classList.toggle('activo', tab === 'ajustes');
    if (tab === 'diseno') Diseno.ajustar();
    if (tab === 'lienzo') { Lienzo.ajustarTam(); Lienzo.c.requestRenderAll(); }
    if (tab === 'ajustes') Ajustes.pintar();
    if (tab !== 'ajustes') localStorage.setItem('cw_tab', tab);
  },
};

const Ajustes = {
  PROV: [
    { id: 'puter', n: 'Puter AI', d: 'Gratis con tu cuenta (entra con correo). Escribe código y también hace imágenes.', campos: [] },
    { id: 'pollinations', n: 'Pollinations', d: 'Gratis y sin llave. Texto e imágenes.', campos: [] },
    { id: 'groq', n: 'Groq 1', d: 'Muy rápida. Modelo openai/gpt-oss-120b.', campos: [['groq', 'Llave'], ['groqModelo', 'Modelo', 'openai/gpt-oss-120b']] },
    { id: 'groq2', n: 'Groq 2', d: 'Modelo qwen/qwen3.8-27b.', campos: [['groq2', 'Llave'], ['groq2Modelo', 'Modelo', 'qwen/qwen3.8-27b']] },
    { id: 'groq3', n: 'Groq 3', d: 'Modelo openai/gpt-oss-120b.', campos: [['groq3', 'Llave'], ['groq3Modelo', 'Modelo', 'openai/gpt-oss-120b']] },
    { id: 'gemini', n: 'Gemini', d: 'De Google. También es el juez que escoge la mejor imagen.', campos: [['gemini', 'Llave'], ['geminiModelo', 'Modelo', 'gemini-3.1-flash-lite']] },
    { id: 'openrouter', n: 'OpenRouter', d: 'Opcional. Modelos gratis que terminan en :free.', campos: [['openrouter', 'Llave'], ['openrouterModelo', 'Modelo', 'google/gemma-4-31b-it:free']] },
  ],
  pintar() {
    const k = AI.claves(); const cont = $('#ajProveedores'); cont.innerHTML = '';
    if (localStorage.getItem('cw_llaves') !== '1' && Llaves.hay) {
      const d = document.createElement('button'); d.className = 'ancho primario'; d.id = 'ajPin'; d.textContent = '🔑 Desbloquear mis llaves con PIN'; d.onclick = () => Llaves.pedir(true); cont.appendChild(d);
    }
    const n = AI.disponibles().length;
    const res = document.createElement('p'); res.className = 'hint'; res.innerHTML = `Ahora mismo trabajan <b>${n} IA de texto</b> al mismo tiempo.`; cont.appendChild(res);
    this.PROV.forEach(p => {
      const est = AI.estado[p.id]; const disp = (AI.provTexto().find(x => x.id === p.id) || { disponible: () => false }).disponible();
      const div = document.createElement('div'); div.className = 'prov'; div.dataset.prov = p.id;
      div.innerHTML = `<div class="cab"><span class="luz ${est || (disp ? 'lista' : '')}"></span>${p.n}<span class="est">${est === 'ok' ? 'funciona' : est === 'err' ? 'falló' : est === 'prob' ? 'probando…' : disp ? 'lista' : 'sin configurar'}</span></div>
        <p class="hint">${p.d}</p>
        ${p.campos.map(([c, nm, ph]) => `<label>${nm}<input ${c.endsWith('Modelo') ? 'type="text"' : 'type="password" autocomplete="off"'} data-k="${c}" placeholder="${ph || 'pega aquí tu llave'}" value="${escaparHTML(k[c] || '')}"></label>`).join('')}
        <div class="fila-prueba">${p.id === 'puter' && !Cuenta.dentro ? '<button class="primario" data-entrar>Entrar con correo</button>' : `<button data-probar="${p.id}">Probar</button>`}<span class="estado" data-res="${p.id}"></span></div>`;
      cont.appendChild(div);
    });
    $$('#ajProveedores [data-k]').forEach(i => i.onchange = () => { const k = AI.claves(); k[i.dataset.k] = i.value.trim(); if (!k[i.dataset.k]) delete k[i.dataset.k]; AI.guardarClaves(k); delete AI.estado[i.dataset.k.replace('Modelo', '')]; toast('Guardado en este teléfono'); this.pintar(); });
    $$('#ajProveedores [data-entrar]').forEach(b => b.onclick = () => Cuenta.entrar());
    $$('#ajProveedores [data-probar]').forEach(b => b.onclick = async () => {
      const id = b.dataset.probar; const r = $(`[data-res="${id}"]`); r.textContent = 'probando…'; r.className = 'estado'; b.disabled = true;
      const caja = b.closest('.prov'); caja.querySelector('.luz').className = 'luz prob';
      try { const t = await AI.probar(id); r.textContent = '✅ respondió: ' + (t || 'ok'); r.className = 'estado ok'; }
      catch (e) { r.textContent = '❌ ' + e.message.slice(0, 90); r.className = 'estado err'; }
      b.disabled = false; caja.querySelector('.luz').className = 'luz ' + (AI.estado[id] || '');
      caja.querySelector('.est').textContent = AI.estado[id] === 'ok' ? 'funciona' : 'falló';
    });
  },
};

/* Llaves de Alfredo cifradas (AES-GCM + PBKDF2). En el repo solo está el cifrado. */
const Llaves = {
  hay: false, datos: null,
  b64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); },
  async iniciar() {
    try { const r = await fetch('keys.enc.json', { cache: 'no-store' }); if (r.ok) { this.datos = await r.json(); this.hay = true; } } catch (e) {}
    if (this.hay && localStorage.getItem('cw_llaves') !== '1' && localStorage.getItem('cw_llaves_omitir') !== '1') this.pedir(false);
  },
  async descifrar(pin) {
    const d = this.datos; const enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    const clave = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: this.b64(d.salt), iterations: d.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.b64(d.iv) }, clave, this.b64(d.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  },
  pedir(desdeAjustes) {
    if ($('#pinModal')) return;
    const m = document.createElement('div'); m.className = 'visor centrado'; m.id = 'pinModal';
    m.innerHTML = `<div class="visor-caja panel"><div class="titulo">🔑 Escribe tu PIN</div>
      <p class="hint">Con tu PIN de 6 números activo tus llaves de IA en este teléfono. Solo te lo pido una vez.</p>
      <input type="password" id="pinInput" inputmode="numeric" maxlength="6" placeholder="••••••" autocomplete="off" style="font-size:26px;text-align:center;letter-spacing:10px">
      <div class="estado" id="pinEstado"></div>
      <div class="grid2"><button class="primario" id="pinOk">Desbloquear</button><button id="pinNo">Ahora no</button></div></div>`;
    document.body.appendChild(m);
    let intentos = 0;
    const ok = async () => {
      const pin = $('#pinInput').value.trim(); const est = $('#pinEstado');
      if (!/^\d{6}$/.test(pin)) { est.textContent = 'Son 6 números'; est.className = 'estado err'; return; }
      est.textContent = 'Revisando…'; est.className = 'estado'; $('#pinOk').disabled = true;
      try {
        const j = await this.descifrar(pin); const k = AI.claves();
        (j.groq || []).forEach((g, i) => { const id = ['groq', 'groq2', 'groq3'][i]; if (id && !k[id]) k[id] = g; });
        if (j.gemini && !k.gemini) k.gemini = j.gemini;
        AI.guardarClaves(k); localStorage.setItem('cw_llaves', '1'); m.remove();
        toast(`🔓 Listo: ${(j.groq || []).length} llaves de Groq y ${j.gemini ? '1 de Gemini' : '0 de Gemini'} activadas`);
        if (App.tab === 'ajustes') Ajustes.pintar();
      } catch (e) {
        intentos++; $('#pinOk').disabled = false;
        est.textContent = intentos >= 3 ? '❌ PIN incorrecto. Revisa el número que te pasaron.' : '❌ PIN incorrecto, intenta otra vez'; est.className = 'estado err';
        $('#pinInput').select();
      }
    };
    $('#pinOk').onclick = ok; $('#pinInput').onkeydown = e => { if (e.key === 'Enter') ok(); };
    $('#pinInput').oninput = e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); if (e.target.value.length === 6) ok(); };
    $('#pinNo').onclick = () => { localStorage.setItem('cw_llaves_omitir', '1'); m.remove(); if (!desdeAjustes) toast('Puedes activarlas después en ⚙ Ajustes'); };
    setTimeout(() => $('#pinInput') && $('#pinInput').focus(), 100);
  },
};

function red() { $('#avisoRed').hidden = navigator.onLine; }

window.addEventListener('DOMContentLoaded', async () => {
  $$('.tabs button').forEach(b => b.onclick = () => { App.ir(b.dataset.tab); window.scrollTo(0, 0); });
  $('#btnAjustes').onclick = () => { App.ir(App.tab === 'ajustes' ? (localStorage.getItem('cw_tab') || 'diseno') : 'ajustes'); window.scrollTo(0, 0); };
  $('#btnCuenta').onclick = () => (Cuenta.dentro ? (App.ir('ajustes'), window.scrollTo(0, 0)) : Cuenta.entrar());
  $('#ajEntrar').onclick = () => Cuenta.entrar();
  $('#ajSalir').onclick = () => Cuenta.salir();
  $('#ajSync').onclick = async () => { toast('Sincronizando…'); await Sync.ahora(); toast('Sincronizado ☁'); };
  $('#ajVolver').onclick = () => App.ir(localStorage.getItem('cw_tab') || 'diseno');
  $$('[data-intro]').forEach(d => {
    if (localStorage.getItem('cw_intro_' + d.dataset.intro)) d.hidden = true;
    d.querySelector('.cerrar').onclick = () => { d.hidden = true; localStorage.setItem('cw_intro_' + d.dataset.intro, '1'); };
  });
  window.addEventListener('online', red); window.addEventListener('offline', red); red();
  document.addEventListener('cuenta', () => { if (App.tab === 'ajustes') Ajustes.pintar(); });
  document.addEventListener('sync-traidos', async e => {
    const ks = e.detail;
    if (ks.includes('diseno')) { const s = await DB.get('diseno'); if (s) Diseno.cargar(s, () => Diseno.hist.reiniciar()); }
    if (ks.includes('lienzo')) { const s = await DB.get('lienzo'); if (s) Lienzo.cargar(s, () => Lienzo.hist.reiniciar()); }
    if (ks.includes('comps')) { Lienzo.comps = (await DB.get('comps')) || []; Lienzo.pintarComps(); }
    if (ks.some(k => k.startsWith('gal:'))) IA.pintarGaleria();
    if (ks.some(k => k.startsWith('clon:'))) Clonar.pintarProyectos();
    toast('☁ Traje tus cosas de la nube');
  });

  Diseno.iniciar(); Lienzo.iniciar(); IA.iniciar(); Clonar.iniciar();
  Cuenta.pintar();
  const tab = localStorage.getItem('cw_tab') || 'diseno';
  App.ir('diseno');
  await Diseno.arrancar();
  App.ir('lienzo'); await Lienzo.arrancar();
  App.ir(['diseno', 'lienzo', 'ia', 'clonar'].includes(tab) ? tab : 'diseno');
  document.body.classList.add('listo');
  Cuenta.iniciar();
  Llaves.iniciar();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
});
