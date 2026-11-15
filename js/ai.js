/* Motor de IA: corre todas las IA disponibles al mismo tiempo y escoge la mejor */
const AI = {
  claves() { try { return JSON.parse(localStorage.getItem('cw_claves') || '{}'); } catch (e) { return {}; } },
  guardarClaves(o) { localStorage.setItem('cw_claves', JSON.stringify(o)); },
  estado: {}, // id -> 'ok' | 'err' | 'prob'

  async _json(url, opts, signal) {
    const r = await fetch(url, { ...opts, signal });
    if (!r.ok) { let t = ''; try { t = (await r.text()).slice(0, 160); } catch (e) {} throw new Error('HTTP ' + r.status + ' ' + t); }
    return r.json();
  },
  _abortable(p, signal) {
    return new Promise((ok, mal) => {
      if (signal) { if (signal.aborted) return mal(new Error('cancelado')); signal.addEventListener('abort', () => mal(new Error('cancelado'))); }
      p.then(ok, mal);
    });
  },
  _oai(url, key, modelo, extra = {}) {
    return async (msgs, signal, maxTok = 6000) => {
      const h = { 'Content-Type': 'application/json' }; if (key) h.Authorization = 'Bearer ' + key;
      if (url.includes('openrouter')) { h['HTTP-Referer'] = location.origin; h['X-Title'] = 'Craft Web'; }
      const pedir = async (mod, tok) => {
        const body = { model: mod, messages: msgs, ...extra };
        if (/gpt-oss|pollinations/.test(mod + url)) body.reasoning_effort = 'low';
        if (/qwen/.test(mod)) body.reasoning_effort = 'none'; // sin "pensar": todo el presupuesto va al HTML
        if (!url.includes('pollinations')) body.max_tokens = Math.min(tok, extra.topeTok || tok);
        delete body.topeTok; delete body.respaldo;
        return AI._json(url, { method: 'POST', headers: h, body: JSON.stringify(body) }, signal);
      };
      let j;
      try { j = await pedir(modelo, maxTok); }
      catch (e) {
        // Límite del plan gratis (429): un reintento con menos tokens o con el modelo de respaldo
        if (!/HTTP 429/.test(e.message) || (signal && signal.aborted)) throw e;
        await new Promise(r => setTimeout(r, 1200));
        j = await pedir(extra.respaldo || modelo, Math.min(maxTok, 6000));
      }
      const c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      const limpio = String(c || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (!limpio) throw new Error('Respuesta vacía'); return limpio;
    };
  },

  /* Proveedores de texto/código */
  provTexto() {
    const k = this.claves();
    return [
      { id: 'puter', nombre: 'Puter AI', disponible: () => Cuenta.dentro && Cuenta.hay(),
        llamar: async (msgs, signal) => {
          const r = await AI._abortable(puter.ai.chat(msgs, k.puterModelo ? { model: k.puterModelo } : {}), signal);
          let c = typeof r === 'string' ? r : (r && r.message && r.message.content);
          if (Array.isArray(c)) c = c.map(x => x.text || '').join('');
          if (!c && r && r.toString) c = r.toString();
          if (!c || c === '[object Object]') throw new Error('Respuesta vacía'); return c;
        } },
      { id: 'pollinations', nombre: 'Pollinations', disponible: () => true,
        llamar: async (msgs, signal) => {
          try { return await AI._oai('https://text.pollinations.ai/openai', null, 'openai')(msgs, signal); }
          catch (e) { const m = /HTTP 402[\s\S]*?Retry after (\d+)s/.exec(e.message) || (/HTTP 402/.test(e.message) && [0, 45]); if (m) AI.pausa.pollinations = Date.now() + (+m[1] + 2) * 1000; throw e; }
        } },
      ...['groq', 'groq2', 'groq3'].map((kid, i) => ({ id: kid, nombre: 'Groq ' + (i + 1), disponible: () => !!k[kid],
        llamar: (msgs, signal, mt) => AI._oai('https://api.groq.com/openai/v1/chat/completions', k[kid], k[kid + 'Modelo'] || (i === 1 ? 'qwen/qwen3.8-27b' : 'openai/gpt-oss-120b'),
          i === 1 ? { topeTok: 4000, respaldo: 'openai/gpt-oss-20b' } : { respaldo: 'openai/gpt-oss-20b' })(msgs, signal, mt) })),
      { id: 'gemini', nombre: 'Gemini', disponible: () => !!k.gemini,
        llamar: (msgs, signal, mt) => AI._oai('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', k.gemini, k.geminiModelo || 'gemini-3.1-flash-lite')(msgs, signal, mt) },
      { id: 'openrouter', nombre: 'OpenRouter', disponible: () => !!k.openrouter,
        llamar: (msgs, signal, mt) => AI._oai('https://openrouter.ai/api/v1/chat/completions', k.openrouter, k.openrouterModelo || 'google/gemma-4-31b-it:free')(msgs, signal, mt) },
    ];
  },
  pausa: {}, // id -> hasta cuándo descansa (límite gratis por IP de Pollinations: 1 respuesta cada ~45 s)
  disponibles() { return this.provTexto().filter(p => p.disponible() && !(this.pausa[p.id] > Date.now())); },

  /* Corre todas en paralelo. Espera a todas, con un margen de `ventana` ms después
     de la primera respuesta válida, y un tope total. Devuelve todos los resultados. */
  async todos(msgs, { validar = async t => ({ ok: !!t, puntos: 1 }), ventana = 25000, tope = 90000, onProgreso, provs, maxTok } = {}) {
    provs = provs || this.disponibles();
    const ctrls = provs.map(() => new AbortController());
    const res = []; let fin; const listo = new Promise(r => (fin = r));
    let pend = provs.length, primera = false; const t0 = performance.now();
    const tTope = setTimeout(() => fin(), tope);
    if (!pend) fin();
    provs.forEach((p, i) => {
      p.llamar(msgs, ctrls[i].signal, maxTok)
        .then(async texto => {
          const ms = Math.round(performance.now() - t0);
          const v = await validar(texto, p);
          res.push({ id: p.id, nombre: p.nombre, texto: v.texto || texto, ms, ok: v.ok, puntos: v.puntos || 0, info: v.info || '', errores: v.errores || [] });
          AI.estado[p.id] = 'ok';
          if (v.ok && !primera) { primera = true; setTimeout(() => fin(), ventana); }
        })
        .catch(e => { if (!/cancelado|abort/i.test(e.message)) AI.estado[p.id] = 'err'; res.push({ id: p.id, nombre: p.nombre, ok: false, error: e.message, puntos: -1 }); })
        .finally(() => { pend--; onProgreso && onProgreso(res, provs); if (!pend) fin(); });
    });
    await listo; clearTimeout(tTope); ctrls.forEach(c => c.abort());
    return res;
  },

  /* Pregunta corta a la IA más rápida que haya respondido (para el juez) */
  async rapida(msgs, preferidos = [], timeout = 20000, maxTok = 600) {
    const todos = this.disponibles();
    const orden = [...preferidos.map(id => todos.find(p => p.id === id)).filter(Boolean), ...todos.filter(p => !preferidos.includes(p.id))];
    for (const p of orden) {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), timeout);
      try { const r = await p.llamar(msgs, c.signal, maxTok); clearTimeout(t); return { texto: r, id: p.id, nombre: p.nombre }; }
      catch (e) { clearTimeout(t); }
    }
    throw new Error('Ninguna IA respondió');
  },

  /* Ordena candidatos: puntaje heurístico y, si hay 2 o más válidos, un juez IA */
  async elegirMejor(cands, { pregunta, resumir }) {
    const val = cands.filter(c => c.ok).sort((a, b) => b.puntos - a.puntos);
    if (val.length < 2) return { orden: val, juez: null };
    const letras = 'ABCDE';
    try {
      const prompt = pregunta + '\n\n' + val.slice(0, 5).map((c, i) => `=== Opción ${letras[i]} ===\n${resumir(c)}`).join('\n\n') +
        `\n\nResponde SOLO con la letra de la mejor opción (${letras.slice(0, Math.min(5, val.length)).split('').join(', ')}).`;
      const r = await this.rapida([{ role: 'system', content: 'Eres un juez experto y estricto. Respondes con una sola letra.' }, { role: 'user', content: prompt }], val.map(c => c.id), 20000);
      const m = String(r.texto).toUpperCase().match(/\b([A-E])\b/);
      const idx = m ? letras.indexOf(m[1]) : -1;
      if (idx >= 0 && idx < val.length) { const g = val.splice(idx, 1)[0]; val.unshift(g); return { orden: val, juez: r.nombre }; }
    } catch (e) { console.warn('juez', e); }
    return { orden: val, juez: null };
  },

  /* ---------- Imágenes ---------- */
  provImagen() {
    const pol = (modelo, retraso) => async (prompt, w, h, seed, mejorar, signal) => {
      if (retraso) await esperar(retraso);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&private=true&model=${modelo}&seed=${seed}${mejorar ? '&enhance=true' : ''}`;
      for (let intento = 0; intento < 2; intento++) {
        const r = await fetch(url, { signal });
        if (r.ok) { const b = await r.blob(); if (!b.type.startsWith('image/')) throw new Error('No es imagen'); return b; }
        if (r.status === 429 && intento === 0) { await esperar(4000); continue; }
        throw new Error('HTTP ' + r.status);
      }
    };
    return [
      { id: 'pol-1', nombre: 'Pollinations', disponible: () => true, generar: pol('flux', 0) },
      { id: 'pol-2', nombre: 'Pollinations (variante)', disponible: () => true, generar: pol('flux', 1500) },
      { id: 'puter-img', nombre: 'Puter AI', disponible: () => Cuenta.dentro && Cuenta.hay(),
        generar: async (prompt, w, h, seed, mejorar, signal) => {
          const img = await AI._abortable(puter.ai.txt2img(prompt), signal);
          const src = img && (img.src || img); return (await fetch(src)).blob();
        } },
    ];
  },

  /* Recorte centrado a la proporción pedida (si la IA devolvió otra) */
  async _recortar(img, ratio) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    let cw = iw, ch = Math.round(iw / ratio); if (ch > ih) { ch = ih; cw = Math.round(ih * ratio); }
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(img, (iw - cw) / 2, (ih - ch) / 2, cw, ch, 0, 0, cw, ch);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    const url = URL.createObjectURL(blob); const im = await cargarImg(url);
    return { blob, url, img: im, w: cw, h: ch };
  },

  async imagenes(prompt, w, h, seed, mejorar, { ventana = 25000, tope = 100000, onProgreso } = {}) {
    const provs = this.provImagen().filter(p => p.disponible());
    const ctrls = provs.map(() => new AbortController());
    const res = []; let fin; const listo = new Promise(r => (fin = r));
    let pend = provs.length, primera = false;
    const tTope = setTimeout(() => fin(), tope);
    provs.forEach((p, i) => {
      p.generar(prompt, w, h, seed + i, mejorar, ctrls[i].signal)
        .then(async blob => {
          const url = URL.createObjectURL(blob); const img = await cargarImg(url);
          const iw = img.naturalWidth, ih = img.naturalHeight;
          const ratioOk = Math.abs(iw / ih - w / h) < 0.03;
          const tam = Math.min(1, (iw * ih) / (w * h));
          const detalle = Math.min(1, blob.size / (iw * ih * 0.15));
          const r0 = { id: p.id, nombre: p.nombre, blob, url, img, w: iw, h: ih, ok: true, puntos: 50 + (ratioOk ? 30 : 0) + tam * 10 + detalle * 10 };
          if (!ratioOk) { try { Object.assign(r0, await AI._recortar(img, w / h)); URL.revokeObjectURL(url); } catch (e) {} }
          res.push(r0);
          AI.estado[p.id] = 'ok';
          if (!primera) { primera = true; setTimeout(() => fin(), ventana); }
        })
        .catch(e => { if (!/cancelado|abort/i.test(e.message)) AI.estado[p.id] = 'err'; res.push({ id: p.id, nombre: p.nombre, ok: false, error: e.message }); })
        .finally(() => { pend--; onProgreso && onProgreso(res, provs); if (!pend) fin(); });
    });
    await listo; clearTimeout(tTope); ctrls.forEach(c => c.abort());
    const val = res.filter(r => r.ok).sort((a, b) => b.puntos - a.puntos);
    let juez = null;
    if (val.length >= 2) {
      try { const j = await this.juezVision(prompt, val); if (j) { const g = val.splice(j.idx, 1)[0]; val.unshift(g); juez = j.nombre; } } catch (e) { console.warn('juez visión', e); }
    }
    return { orden: val, fallas: res.filter(r => !r.ok), juez };
  },

  /* Juez con visión: arma un collage numerado y pregunta cuál es mejor */
  async juezVision(prompt, val) {
    const k = this.claves(); const usarPuter = Cuenta.dentro && Cuenta.hay();
    if (!usarPuter && !k.gemini) return null;
    const n = Math.min(val.length, 4), lado = 384;
    const c = document.createElement('canvas'); c.width = lado * n; c.height = lado; const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    val.slice(0, n).forEach((v, i) => {
      const s = Math.min(lado / v.w, lado / v.h); const dw = v.w * s, dh = v.h * s;
      x.drawImage(v.img, i * lado + (lado - dw) / 2, (lado - dh) / 2, dw, dh);
      x.fillStyle = '#ff0'; x.font = 'bold 40px sans-serif'; x.fillText(String(i + 1), i * lado + 12, 48);
    });
    const dataURL = c.toDataURL('image/jpeg', 0.85);
    const pregunta = `Hay ${n} imágenes numeradas de izquierda a derecha (1 a ${n}). ¿Cuál representa mejor la petición "${prompt}" con mejor calidad, sin errores ni deformaciones? Responde SOLO con el número.`;
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
    let txt = '', nombre = '';
    try {
      if (k.gemini) {
        const j = await this._json(`https://generativelanguage.googleapis.com/v1beta/models/${k.geminiModelo || 'gemini-3.1-flash-lite'}:generateContent?key=${encodeURIComponent(k.gemini)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: pregunta }, { inline_data: { mime_type: 'image/jpeg', data: dataURL.split(',')[1] } }] }] }),
        }, ctrl.signal);
        txt = (((j.candidates || [])[0] || {}).content || {}).parts.map(p => p.text || '').join(''); nombre = 'Gemini';
      } else {
        const r = await this._abortable(puter.ai.chat(pregunta, dataURL), ctrl.signal);
        txt = typeof r === 'string' ? r : (r.message && r.message.content) || String(r); nombre = 'Puter AI';
      }
    } finally { clearTimeout(t); }
    const m = String(txt).match(/[1-4]/); if (!m) return null;
    const idx = Number(m[0]) - 1; return idx < n ? { idx, nombre } : null;
  },

  /* Prueba rápida de un proveedor desde Ajustes */
  async probar(id) {
    if (id.startsWith('pol-') || id === 'puter-img') return;
    const p = this.provTexto().find(x => x.id === id); if (!p) return;
    if (!p.disponible()) throw new Error(id === 'puter' ? 'Primero entra con tu correo' : 'Falta la llave');
    this.estado[id] = 'prob';
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000);
    try { const r = await p.llamar([{ role: 'user', content: 'Responde solo: ok' }], c.signal); this.estado[id] = 'ok'; return String(r).slice(0, 60); }
    catch (e) { this.estado[id] = 'err'; throw e; } finally { clearTimeout(t); }
  },
};
