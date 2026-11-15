/* Chat de IA: el usuario escribe lo que quiere y el chat maneja todo el sitio.
   Varias IA interpretan el pedido al mismo tiempo (JSON con acciones), se escoge la mejor
   y se ejecutan las acciones sobre Diseño, Lienzo, IA, Clonar y Ajustes. */
const SISTEMA_CHAT = `Eres el asistente de "Craft Web", una app en español de México para crear diseños, maquetas, imágenes con IA y apps web. Tú manejas TODA la app con acciones.
Responde SOLO con un objeto JSON válido, sin texto extra ni markdown:
{"respuesta":"texto breve y amable (máx. 2 frases, español MX)","acciones":[{"accion":"...", ...}]}
Acciones disponibles (usa solo estas, con estos campos):
- {"accion":"ir","tab":"chat|diseno|lienzo|ia|clonar|ajustes"}  (solo si pide abrir/ver una sección)
- {"accion":"diseno_plantilla","plantilla":"blanco|promo|frase|evento|oferta|menu","formato":"post|vertical|historia"}  (crear diseño nuevo; formato opcional)
- {"accion":"diseno_formato","formato":"post|vertical|historia"}  (post=1080x1080, vertical=1080x1350, historia=1080x1920)
- {"accion":"diseno_texto","texto":"...","color":"#hex","tamano":90,"fuente":"..."}  (agregar texto nuevo; color/tamano/fuente opcionales)
- {"accion":"diseno_editar","objetivo":"nombre o parte del texto, o #n de la lista, o 'seleccion'","texto":"nuevo texto","color":"#hex","tamano":120,"escala":1.3,"fuente":"...","negrita":true}  (cambiar un texto existente; solo incluye lo que cambia)
- {"accion":"diseno_fondo","color":"#hex"}
- {"accion":"diseno_forma","forma":"rect|circulo|triangulo|estrella|linea","color":"#hex"}
- {"accion":"diseno_deshacer"} / {"accion":"diseno_rehacer"}
- {"accion":"diseno_exportar","formato":"png|pdf"}
- {"accion":"lienzo_marco","tipo":"iphone|android|tablet|escritorio"}
- {"accion":"lienzo_agregar","elemento":"rect|texto|boton","texto":"..."}
- {"accion":"lienzo_componente","nombre":"Botón|Tarjeta|Barra|Campo|Avatar|Lista"}
- {"accion":"lienzo_exportar","formato":"png|html"}
- {"accion":"lienzo_nuevo"}
- {"accion":"imagen","prompt":"descripción visual detallada EN INGLÉS (los generadores la entienden mejor), ej. taco al pastor = mexican al pastor pork taco with pineapple, onion and cilantro","estilo":"Ninguno|Foto real|Anime|3D caricatura|Acuarela|Óleo|Cómic|Neón|Minimalista|Logo|Póster|Pixel art","tamano":"cuadrado|post|historia|horizontal","usar":"diseno|lienzo"}  (usar es opcional: mete la imagen al diseño o lienzo)
- {"accion":"clonar_url","url":"https://...","detalles":"..."}  (crear su propia versión de un sitio)
- {"accion":"clonar_idea","idea":"descripción completa de la app"}
- {"accion":"clonar_cambio","cambio":"..."}  (cambiar la app actual)
- {"accion":"proyecto_guardar"} / {"accion":"proyectos_listar"} / {"accion":"proyecto_abrir","nombre":"..."} / {"accion":"proyecto_borrar","nombre":"..."}
  (proyecto_borrar NO borra al instante: la app le pide confirmar con un botón; en "respuesta" pídele que confirme)
- {"accion":"galeria_listar"}
- {"accion":"ajustes_info"}  (qué IA están activas, cuenta, llaves; la app muestra la lista real, tú solo di algo como "Este es el estado de tus IA")
- {"accion":"cuenta_entrar"}  (entrar con correo para respaldar en la nube)
Reglas: para un post, flyer, historia o anuncio NUEVO usa primero diseno_plantilla con la plantilla más parecida (promo=promoción/producto, oferta=descuento, menu=menú/precios, evento=fiesta/fecha, frase=cita/motivación, blanco=vacío) y después diseno_editar sobre sus textos ("Título", "Descripción", "Botón", "Fecha", "Lugar", "Descuento", etc., ver la lista del estado) para poner lo que pidió. Usa diseno_texto solo para agregar un texto extra.
Ejemplos:
Usuario: haz un flyer de oferta en historia que diga 50% en tenis
{"respuesta":"¡Va! Te armé el flyer de oferta en formato historia.","acciones":[{"accion":"diseno_plantilla","plantilla":"oferta","formato":"historia"},{"accion":"diseno_editar","objetivo":"Título","texto":"50% en tenis"}]}
Usuario: genera un logo de una cafetería con un gato y ponlo en mi diseño
{"respuesta":"Genero el logo con varias IA y te dejo el mejor en tu diseño.","acciones":[{"accion":"imagen","prompt":"coffee shop logo with a cute cat, flat vector, clean background","estilo":"Logo","tamano":"cuadrado","usar":"diseno"}]}
Usuario: hola, ¿qué puedes hacer?
{"respuesta":"Puedo hacer diseños para redes, maquetas de apps, imágenes con IA y apps web completas. Dime qué necesitas.","acciones":[]}
Si es solo una pregunta o plática, deja "acciones" vacío y contesta. Puedes encadenar varias acciones en orden. Colores siempre en #hex. Si pide algo que la app no puede hacer, dilo y propone lo más parecido. No inventes acciones. En "respuesta" no describas resultados con detalles inventados (tamaños, pantallas, nombres): la app agrega el resultado real.`;

const ACCIONES_CHAT = ['ir', 'diseno_plantilla', 'diseno_formato', 'diseno_texto', 'diseno_editar', 'diseno_fondo', 'diseno_forma', 'diseno_deshacer', 'diseno_rehacer', 'diseno_exportar',
  'lienzo_marco', 'lienzo_agregar', 'lienzo_componente', 'lienzo_exportar', 'lienzo_nuevo', 'imagen', 'clonar_url', 'clonar_idea', 'clonar_cambio',
  'proyecto_guardar', 'proyectos_listar', 'proyecto_abrir', 'proyecto_borrar', 'galeria_listar', 'ajustes_info', 'cuenta_entrar'];

const SUGERENCIAS_CHAT = ['Haz un post de promoción que diga “Tacos 2x1 hoy”', 'Genera una imagen de un taco al pastor estilo póster', 'Crea una app para apuntar las ventas del día',
  'Haz mi versión de trello.com', 'Agrega un marco de iPhone al lienzo', 'Descarga mi diseño en PNG', '¿Qué IA tengo activas?', 'Muéstrame mis apps'];

const COLORES_ES = { rojo: '#ef4444', azul: '#3b82f6', verde: '#22c55e', amarillo: '#facc15', naranja: '#f97316', morado: '#8b5cf6', rosa: '#ec4899', negro: '#111111', blanco: '#ffffff', gris: '#6b7280', dorado: '#d4a017', cafe: '#8b5a2b', café: '#8b5a2b', turquesa: '#14b8a6', celeste: '#38bdf8', vino: '#7f1d1d' };

function dist(a, b) { // distancia de edición (para nombres con errores de dedo)
  const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; const d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const Chat = {
  msgs: [], ocupado: false,

  async iniciar() {
    $('#chatForm').onsubmit = e => { e.preventDefault(); this.enviar(); };
    const ta = $('#chatIn');
    ta.addEventListener('input', () => this.crecer());
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); this.enviar(); } });
    $('#chatBorrar').onclick = async () => { if (!this.msgs.length || !confirm('¿Borrar toda la conversación?')) return; this.msgs = []; await this.guardar(); this.pintar(); };
    $('#chatLista').addEventListener('click', e => this.clic(e));
    await this.cargar();
  },
  crecer() { const ta = $('#chatIn'); ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; },
  async cargar() { const d = await DB.get('chat'); this.msgs = (d && d.msgs) || []; this.pintar(); },
  async guardar() { await DB.set('chat', { msgs: this.msgs.slice(-150) }); },

  /* ---------- Pintar ---------- */
  pintar() {
    const l = $('#chatLista'); l.innerHTML = '';
    $('#chatVacio').hidden = this.msgs.length > 0;
    $('#chatSuger').innerHTML = SUGERENCIAS_CHAT.map(s => `<button type="button">${escaparHTML(s)}</button>`).join('');
    $$('#chatSuger button').forEach(b => b.onclick = () => { $('#chatIn').value = b.textContent; this.enviar(); });
    const ultApps = this.msgs.map((m, i) => (m.adj || []).some(a => a.tipo === 'app') ? i : -1).filter(i => i >= 0).slice(-2);
    this.msgs.forEach((m, i) => l.appendChild(this.burbuja(m, ultApps.includes(i))));
  },
  burbuja(m, conVista) {
    const d = document.createElement('div'); d.className = 'cm ' + (m.yo ? 'yo' : 'ia');
    if (!m.yo && m.gano) d.innerHTML = `<div class="cm-gano">${escaparHTML(m.gano)}</div>`;
    const t = document.createElement('div'); t.className = 'cm-t'; t.textContent = m.t || ''; d.appendChild(t);
    (m.adj || []).forEach(a => d.appendChild(this.adjunto(a, conVista)));
    return d;
  },
  boton(et, hacer, cls = '') { return `<button type="button" class="chico ${cls}" data-hacer='${escaparHTML(JSON.stringify(hacer))}'>${escaparHTML(et)}</button>`; },
  adjunto(a, conVista) {
    const d = document.createElement('div'); d.className = 'cm-adj';
    if (a.tipo === 'img') {
      d.innerHTML = `<img class="cm-img" alt="Imagen generada"><div class="cm-bts">${this.boton('🔍 Ver', { h: 'ver_img', gal: a.gal })}${this.boton('🎨 A Diseño', { h: 'img_usar', gal: a.gal, tab: 'diseno' })}${this.boton('🧩 A Lienzo', { h: 'img_usar', gal: a.gal, tab: 'lienzo' })}${this.boton('⬇ Bajar', { h: 'img_bajar', gal: a.gal })}</div>`;
      DB.get(a.gal).then(v => { const im = d.querySelector('img'); if (v && v.blob) im.src = URL.createObjectURL(v.blob); else { im.replaceWith(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Esta imagen ya se borró de tu galería.' })); } });
    } else if (a.tipo === 'diseno' || a.tipo === 'lienzo') {
      const bts = a.tipo === 'diseno'
        ? this.boton('🎨 Abrir Diseño', { h: 'ir', tab: 'diseno' }, 'primario') + this.boton('⬇ PNG', { h: 'diseno_exportar', formato: 'png' }) + this.boton('⬇ PDF', { h: 'diseno_exportar', formato: 'pdf' })
        : this.boton('🧩 Abrir Lienzo', { h: 'ir', tab: 'lienzo' }, 'primario') + this.boton('⬇ PNG', { h: 'lienzo_exportar', formato: 'png' }) + this.boton('⬇ HTML', { h: 'lienzo_exportar', formato: 'html' });
      d.innerHTML = `${a.src ? `<img class="cm-img" src="${a.src}" alt="Vista previa">` : ''}<div class="cm-bts">${bts}</div>`;
    } else if (a.tipo === 'app') {
      d.innerHTML = `<div class="cm-app"></div><div class="cm-bts">${this.boton('⚡ Abrir en Clonar', { h: 'app_abrir', clon: a.clon }, 'primario')}${this.boton('⛶ Grande', { h: 'app_grande', clon: a.clon })}${this.boton('⬇ .html', { h: 'app_bajar', clon: a.clon })}</div>`;
      const caja = d.querySelector('.cm-app');
      DB.get(a.clon).then(v => {
        if (!v) { caja.innerHTML = '<p class="muted">Esta app ya se borró de Mis apps.</p>'; d.querySelector('.cm-bts').hidden = true; return; }
        caja.insertAdjacentHTML('afterbegin', `<div class="cm-app-tit">⚡ ${escaparHTML(v.nombre || 'Mi app')}</div>`);
        if (conVista) { const f = document.createElement('iframe'); f.sandbox = 'allow-scripts'; f.title = 'Vista previa'; f.loading = 'lazy'; f.srcdoc = inyectarHead(v.html, SHIM_STORAGE); caja.appendChild(f); }
      });
    } else if (a.tipo === 'botones') {
      d.innerHTML = `<div class="cm-bts">${a.items.map(b => this.boton(b.t, b.hacer, b.cls || '')).join('')}</div>`;
    } else if (a.tipo === 'lista') {
      d.innerHTML = `<ul class="cm-lista">${a.items.map(b => `<li><span>${escaparHTML(b.t)}</span>${(b.bts || []).map(x => this.boton(x.t, x.hacer, x.cls || '')).join('')}</li>`).join('')}</ul>`;
    } else if (a.tipo === 'provs') {
      d.innerHTML = `<ul class="cm-lista">${a.items.map(p => `<li><span><span class="luz ${p.cls}"></span> ${escaparHTML(p.n)}</span><small class="muted">${escaparHTML(p.e)}</small></li>`).join('')}</ul>`;
    }
    return d;
  },
  async clic(e) {
    const b = e.target.closest('[data-hacer]'); if (!b) return;
    const h = JSON.parse(b.dataset.hacer);
    try {
      if (h.h === 'ir') { App.ir(h.tab); window.scrollTo(0, 0); return; }
      if (h.h === 'ver_img') { const v = await DB.get(h.gal); if (v) IA.abrir(h.gal, v, URL.createObjectURL(v.blob)); return; }
      if (h.h === 'img_usar') { const v = await DB.get(h.gal); if (v) { await IA.usarEn(h.tab, v.blob); window.scrollTo(0, 0); } return; }
      if (h.h === 'img_bajar') { const v = await DB.get(h.gal); if (v) descargar(v.blob, 'imagen-ia.jpg'); return; }
      if (h.h === 'diseno_exportar') { h.formato === 'pdf' ? Diseno.exportarPDF() : await Diseno.exportarPNG(); return; }
      if (h.h === 'lienzo_exportar') { h.formato === 'html' ? Lienzo.exportarHTML(false) : Lienzo.exportarPNG(); return; }
      if (h.h === 'app_abrir' || h.h === 'app_grande' || h.h === 'app_bajar') {
        const v = await DB.get(h.clon); if (!v) { toast('Esa app ya no existe'); return; }
        Clonar.actual = v; Clonar.ultimoPedido = { inicial: v.pedido };
        if (h.h === 'app_abrir') { App.ir('clonar'); Clonar.mostrar(''); }
        if (h.h === 'app_grande') Clonar.accion('pantalla');
        if (h.h === 'app_bajar') Clonar.accion('descargar');
        return;
      }
      if (h.h === 'cuenta_entrar') { Cuenta.entrar(); return; }
      if (h.h === 'confirmar_borrar') {
        const v = await DB.get(h.clon); if (!v) { toast('Ya estaba borrada'); return; }
        await DB.del(h.clon); if (Clonar.actual && Clonar.actual.id === h.clon) Clonar.actual.id = null; Clonar.pintarProyectos();
        b.closest('.cm-bts, li').innerHTML = '<span class="muted">🗑 Borrada</span>';
        this.msgs.push({ yo: false, t: `Listo, borré “${v.nombre}”.` }); await this.guardar(); this.pintar(); this.alFinal(); return;
      }
      if (h.h === 'cancelar') { b.closest('.cm-bts').innerHTML = '<span class="muted">Cancelado</span>'; return; }
      if (h.h === 'decir') { $('#chatIn').value = h.t; this.enviar(); return; }
    } catch (err) { toast('No se pudo: ' + err.message); }
  },
  alFinal() { const l = $('#chatLista'); const u = l.lastElementChild; if (u && App.tab === 'chat') u.scrollIntoView({ block: 'end', behavior: 'smooth' }); },

  /* ---------- Contexto para la IA ---------- */
  async contexto() {
    const textos = Diseno.c.getObjects().filter(o => o.type === 'textbox').map((o, i) => `#${i + 1} ${o.name || 'Texto'}: "${String(o.text).slice(0, 50)}" (${Math.round(o.fontSize)}px, ${o.fill})`).slice(0, 12);
    const marcos = Lienzo.c.getObjects().filter(o => o.esMarco).map(o => o.name);
    const apps = []; for (const k of await DB.llaves('clon:')) { const v = await DB.get(k); if (v) apps.push(v.nombre); }
    const gal = (await DB.llaves('gal:')).length;
    return `Estado actual de la app:
- Sección abierta: ${App.tab}
- Diseño: formato ${Diseno.fmt} (${Diseno.W}x${Diseno.H}); textos: ${textos.length ? '\n  ' + textos.join('\n  ') : 'ninguno'}
- Lienzo: marcos ${marcos.join(', ') || 'ninguno'}
- App actual en Clonar: ${Clonar.actual ? Clonar.titulo(Clonar.actual.html) : 'ninguna'}
- Mis apps guardadas: ${apps.slice(0, 15).join(', ') || 'ninguna'}
- Imágenes en galería: ${gal}
- Cuenta: ${Cuenta.dentro ? 'conectada (' + Cuenta.nombre() + ')' : 'sin cuenta (invitado)'}`;
  },

  /* ---------- Interpretar ---------- */
  parsear(texto) {
    let t = String(texto || '').replace(/```(?:json)?/gi, '').trim();
    const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i < 0 || j <= i) return null;
    try {
      const o = JSON.parse(t.slice(i, j + 1));
      if (typeof o !== 'object' || !o) return null;
      o.respuesta = String(o.respuesta || '').trim();
      o.acciones = Array.isArray(o.acciones) ? o.acciones.filter(a => a && typeof a === 'object') : [];
      return o;
    } catch (e) { return null; }
  },
  async validar(texto) {
    const o = Chat.parsear(texto);
    if (!o || (!o.respuesta && !o.acciones.length)) return { ok: false, puntos: 0, info: 'no es JSON' };
    const malas = o.acciones.filter(a => !ACCIONES_CHAT.includes(a.accion)).length;
    if (malas && malas === o.acciones.length) return { ok: false, puntos: 5, info: 'acciones inventadas' };
    const puntos = 50 + (o.respuesta ? 10 : 0) - malas * 15 + (o.respuesta.length <= 280 ? 5 : 0);
    return { ok: true, puntos, info: `${o.acciones.length} acciones`, texto: JSON.stringify(o) };
  },
  async interpretar(pedido, burb) {
    const hist = this.msgs.slice(-9, -1).map(m => ({ role: m.yo ? 'user' : 'assistant', content: m.yo ? m.t : JSON.stringify({ respuesta: (m.r != null ? m.r : (m.t || '').split('\n')[0]).slice(0, 300), acciones: m.acc || [] }) }));
    const msgs = [{ role: 'system', content: SISTEMA_CHAT + '\n\n' + await this.contexto() }, ...hist, { role: 'user', content: pedido }];
    // Pollinations solo da 1 respuesta cada ~45 s por IP: si hay otras IA, se la guardo para Clonar
    let provs = AI.disponibles(); if (provs.filter(x => x.id !== 'pollinations').length >= 2) provs = provs.filter(x => x.id !== 'pollinations');
    const res = await AI.todos(msgs, { provs, maxTok: 900, validar: this.validar, ventana: 2500, tope: 25000, onProgreso: (r, provs) => pintarProgreso(burb.querySelector('.progreso'), provs, r) });
    const val = res.filter(r => r.ok);
    if (!val.length) return { fallo: res };
    let orden = val.sort((a, b) => b.puntos - a.puntos), juez = null;
    const firma = r => (Chat.parsear(r.texto).acciones || []).map(a => a.accion).join(',');
    if (val.length >= 2 && new Set(val.map(firma)).size > 1) {
      burb.querySelector('.cm-t').textContent = '🧑‍⚖️ Las IA no coinciden; escogiendo la mejor interpretación…';
      ({ orden, juez } = await AI.elegirMejor(val, { pregunta: `El usuario de una app de diseño escribió: "${pedido.slice(0, 400)}". ¿Qué respuesta JSON interpreta mejor lo que quiere, con las acciones correctas?`, resumir: c => c.texto.slice(0, 1500) }));
    }
    const g = orden[0];
    pintarProgreso(burb.querySelector('.progreso'), provs, res, g.id);
    return { plan: this.parsear(g.texto), gano: `Interpretó: ${g.nombre}${juez ? ' · eligió ' + juez : ''} · ${res.filter(r => r.ok).length}/${res.length} IA` };
  },

  /* Plan sin IA (sin internet o si todas fallan): reconoce los pedidos más comunes */
  local(p) {
    const s = p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const comillas = (p.match(/[“"«']([^”"»']{1,120})[”"»']/) || [])[1];
    const color = Object.keys(COLORES_ES).find(c => s.includes(c.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
    const fmt = /historia|story|9:16/.test(s) ? 'historia' : /vertical|4:5/.test(s) ? 'vertical' : /cuadrad|1:1/.test(s) ? 'post' : null;
    const url = (p.match(/https?:\/\/\S+|\b[a-z0-9-]+\.(com|org|net|mx|io|app|es)(\/\S*)?/i) || [])[0];
    const A = [];
    if (/deshac/.test(s)) A.push({ accion: 'diseno_deshacer' });
    else if (/rehac/.test(s)) A.push({ accion: 'diseno_rehacer' });
    else if (/(ajustes|llaves|que ia|cuales ia|ias activ|proveedor)/.test(s)) A.push({ accion: 'ajustes_info' });
    else if (/(mis apps|proyectos|apps guardadas)/.test(s)) A.push({ accion: 'proyectos_listar' });
    else if (/galeria|mis imagenes/.test(s)) A.push({ accion: 'galeria_listar' });
    else if (/guarda/.test(s) && /app/.test(s)) A.push({ accion: 'proyecto_guardar' });
    else if (url && /(clon|version|copia|como|parecid|recrea)/.test(s)) A.push({ accion: 'clonar_url', url });
    else if (/(crea|haz|hazme|programa).*(app|aplicacion|pagina)/.test(s)) A.push({ accion: 'clonar_idea', idea: p });
    else if (/(imagen|foto|dibuj|ilustra|logo de)/.test(s) && !/(diseno|post)/.test(s)) A.push({ accion: 'imagen', prompt: p.replace(/^(genera|crea|haz|hazme|dibuja)( una?)?( imagen| foto)?( de)?/i, '').trim() || p });
    else if (/(iphone|android|tablet|escritorio|marco)/.test(s)) A.push({ accion: 'lienzo_marco', tipo: /android/.test(s) ? 'android' : /tablet/.test(s) ? 'tablet' : /escritorio|desktop/.test(s) ? 'escritorio' : 'iphone' });
    else if (/(descarga|exporta|baja|png|pdf)/.test(s)) A.push(/lienzo|maqueta|html/.test(s) ? { accion: 'lienzo_exportar', formato: /html/.test(s) ? 'html' : 'png' } : { accion: 'diseno_exportar', formato: /pdf/.test(s) ? 'pdf' : 'png' });
    else if (/fondo/.test(s) && color) A.push({ accion: 'diseno_fondo', color: COLORES_ES[color] });
    else if (/(post|flyer|diseno|historia|promo|oferta|menu|evento|frase|plantilla)/.test(s)) {
      const pl = /oferta|descuento/.test(s) ? 'oferta' : /menu/.test(s) ? 'menu' : /evento|fiesta/.test(s) ? 'evento' : /frase|cita/.test(s) ? 'frase' : /blanco|vacio/.test(s) ? 'blanco' : 'promo';
      A.push({ accion: 'diseno_plantilla', plantilla: pl, ...(fmt ? { formato: fmt } : {}) });
      if (comillas) A.push({ accion: 'diseno_editar', objetivo: 'Título', texto: comillas, ...(color ? { color: COLORES_ES[color] } : {}) });
    } else if (fmt) A.push({ accion: 'diseno_formato', formato: fmt });
    else if (/(titulo|texto)/.test(s) && (comillas || color)) A.push({ accion: 'diseno_editar', objetivo: /titulo/.test(s) ? 'Título' : 'seleccion', ...(comillas ? { texto: comillas } : {}), ...(color ? { color: COLORES_ES[color] } : {}) });
    if (!A.length) return null;
    return { respuesta: 'Va, lo hago.', acciones: A };
  },

  /* ---------- Enviar ---------- */
  async enviar() {
    const ta = $('#chatIn'); const p = ta.value.trim();
    if (!p || this.ocupado) return;
    this.ocupado = true; $('#chatEnviar').disabled = true; ta.value = ''; this.crecer();
    this.msgs.push({ yo: true, t: p, fecha: Date.now() }); await this.guardar(); this.pintar();
    const burb = document.createElement('div'); burb.className = 'cm ia trabajando';
    burb.innerHTML = '<div class="cm-t"><span class="giro"></span> Pensando con varias IA a la vez…</div><div class="progreso"></div><div class="estado"></div>';
    $('#chatLista').appendChild(burb); this.alFinal();
    const m = { yo: false, t: '', adj: [], acc: [], fecha: Date.now() };
    try {
      let plan = null;
      if (navigator.onLine && AI.disponibles().length) {
        const r = await this.interpretar(p, burb);
        if (r.plan) { plan = r.plan; m.gano = r.gano; }
        else { plan = this.local(p); if (plan) m.gano = 'Sin respuesta de las IA · lo entendí yo'; }
      } else { plan = this.local(p); if (plan) m.gano = 'Sin internet · modo básico'; }
      if (!plan) {
        m.t = navigator.onLine ? 'Ninguna IA respondió esta vez 😕. Espera unos segundos y vuelve a intentar.' : '📡 Sin internet solo entiendo pedidos sencillos (ej. “haz un post de promoción”, “descarga en PNG”, “deshacer”). Conéctate para lo demás.';
      } else {
        m.acc = plan.acciones.filter(a => ACCIONES_CHAT.includes(a.accion)); m.r = plan.respuesta;
        // Solo cambia de pestaña si eso fue lo único que pidió; si hizo algo más, se queda en el chat con botones "Abrir"
        if (m.acc.length > 1) m.acc = m.acc.filter(a => a.accion !== 'ir');
        const lineas = [];
        if (!navigator.onLine) {
          const red = m.acc.filter(a => /^(imagen|clonar_|cuenta_)/.test(a.accion));
          if (red.length) { m.acc = m.acc.filter(a => !red.includes(a)); plan.respuesta = '📡 Sin internet no puedo ' + (red[0].accion === 'imagen' ? 'generar imágenes' : red[0].accion.startsWith('clonar') ? 'programar apps' : 'entrar a tu cuenta') + '. Lo demás (diseño, lienzo, descargas) sí funciona.'; }
        }
        burb.querySelector('.cm-t').textContent = plan.respuesta || 'Va…';
        for (const a of m.acc) {
          try { const r = await this.ejecutar(a, burb); if (r) { if (r.t) lineas.push(r.t); if (r.adj) m.adj.push(...r.adj); } }
          catch (e) { console.warn('accion', a, e); lineas.push('⚠️ No pude hacer “' + a.accion + '”: ' + e.message); }
        }
        m.t = [plan.respuesta, ...lineas].filter(Boolean).join('\n');
        // Solo la última vista de Diseño/Lienzo por mensaje (las intermedias sobran)
        ['diseno', 'lienzo'].forEach(tp => { const ult = m.adj.map(x => x.tipo).lastIndexOf(tp); m.adj = m.adj.filter((x, i) => x.tipo !== tp || i === ult); });
      }
    } catch (e) { m.t = 'Algo falló: ' + e.message; }
    burb.remove();
    this.msgs.push(m); await this.guardar(); this.pintar(); this.alFinal();
    this.ocupado = false; $('#chatEnviar').disabled = false;
  },

  /* Copia el estado de un módulo (Clonar/IA) dentro de la burbuja mientras trabaja */
  espejo(burb, estadoSel, progSel) {
    const est = burb.querySelector('.estado'), prog = burb.querySelector('.progreso');
    const copiar = () => { est.textContent = $(estadoSel).textContent; est.className = $(estadoSel).className; prog.innerHTML = $(progSel).innerHTML; };
    const ob = new MutationObserver(copiar); ob.observe($(estadoSel), { childList: true, characterData: true, subtree: true }); ob.observe($(progSel), { childList: true, subtree: true });
    return () => ob.disconnect();
  },
  fotoDiseno() {
    const el = Diseno.lienzoFinal(); const k = 440 / Math.max(el.width, el.height);
    const f = document.createElement('canvas'); f.width = Math.round(el.width * k); f.height = Math.round(el.height * k);
    f.getContext('2d').drawImage(el, 0, 0, f.width, f.height); return f.toDataURL('image/jpeg', 0.82);
  },
  fotoLienzo() {
    const c = Lienzo.c, m = Lienzo.marcoActual(); if (!m) return null;
    c.discardActiveObject(); c.renderAll();
    const v = c.viewportTransform, z = v[0], w = m.width * m.scaleX, h = m.height * m.scaleY, k = 480 / Math.max(w, h);
    const el = c.toCanvasElement(k / z, { left: m.left * z + v[4], top: m.top * z + v[5], width: w * z, height: h * z });
    return el.toDataURL('image/jpeg', 0.82);
  },
  textoObjetivo(obj) {
    const ts = Diseno.c.getObjects().filter(o => o.type === 'textbox');
    if (!ts.length) return null;
    const q = String(obj || '').trim().toLowerCase();
    const sel = Diseno.c.getActiveObject();
    if (/^#\d+$/.test(q)) return ts[+q.slice(1) - 1] || null;
    if (!q || q === 'seleccion' || q === 'selección') return sel && sel.type === 'textbox' ? sel : ts.slice().sort((a, b) => b.fontSize - a.fontSize)[0];
    return ts.find(o => (o.name || '').toLowerCase() === q) || ts.find(o => (o.name || '').toLowerCase().includes(q)) || ts.find(o => String(o.text).toLowerCase().includes(q))
      || (/titul|principal|grande/.test(q) ? ts.slice().sort((a, b) => b.fontSize - a.fontSize)[0] : null);
  },
  async fuente(f) { if (!f) return null; const n = FUENTES.find(x => x.toLowerCase() === String(f).toLowerCase()) || FUENTES.find(x => x.toLowerCase().includes(String(f).toLowerCase())); if (n) await document.fonts.load(`40px "${n}"`).catch(() => {}); return n || null; },
  hex(c) { if (!c) return null; const s = String(c).trim(); if (/^#[0-9a-f]{3,8}$/i.test(s)) return s; return COLORES_ES[s.toLowerCase()] || (CSS.supports('color', s) ? s : null); },

  /* ---------- Ejecutar una acción ---------- */
  async ejecutar(a, burb) {
    // Cada pedido del chat es UN paso de Deshacer (no varios pasos sueltos)
    const h = /^diseno_(?!deshacer|rehacer|exportar)/.test(a.accion) ? Diseno.hist : /^lienzo_(?!exportar)/.test(a.accion) ? Lienzo.hist : null;
    if (!h) return this._ejecutar(a, burb);
    if (h.t) { clearTimeout(h.t); h._guardarYa(); }
    h.bloq = true;
    try { return await this._ejecutar(a, burb); }
    finally { h.bloq = false; clearTimeout(h.t); h.t = null; h._guardarYa(); }
  },
  async _proyecto(a, v) {
    if (a.accion === 'proyecto_abrir') { Clonar.actual = v; Clonar.ultimoPedido = { inicial: v.pedido }; Clonar.mostrar(''); return { t: `📂 Abrí “${v.nombre}”. Ya puedes pedirme cambios.`, adj: [{ tipo: 'app', clon: v.id }] }; }
    return { t: `¿Seguro que borro “${v.nombre}”? No se puede deshacer.`, adj: [{ tipo: 'botones', items: [{ t: '🗑 Sí, borrar', hacer: { h: 'confirmar_borrar', clon: v.id }, cls: 'peligro' }, { t: 'Cancelar', hacer: { h: 'cancelar' } }] }] };
      
  },
  async _ejecutar(a, burb) {
    const dis = (t, extra = []) => ({ t, adj: [{ tipo: 'diseno', src: this.fotoDiseno() }, ...extra] });
    switch (a.accion) {
      case 'ir': { const tab = ['chat', 'diseno', 'lienzo', 'ia', 'clonar', 'ajustes'].includes(a.tab) ? a.tab : 'chat'; if (tab !== 'chat') setTimeout(() => { App.ir(tab); window.scrollTo(0, 0); }, 900); return { t: '' }; }
      case 'diseno_plantilla': {
        if (a.formato && FORMATOS[a.formato]) await Diseno.cambiarFormato(a.formato);
        const id = ['blanco', 'promo', 'frase', 'evento', 'oferta', 'menu'].includes(a.plantilla) ? a.plantilla : 'promo';
        await Diseno.plantilla(id); return dis(`🎨 Diseño “${id}” en ${FORMATOS[Diseno.fmt].n}.`);
      }
      case 'diseno_formato': { if (!FORMATOS[a.formato]) throw new Error('formato desconocido'); await Diseno.cambiarFormato(a.formato); return dis(`📐 Ahora es ${FORMATOS[a.formato].n}.`); }
      case 'diseno_texto': {
        const f = await this.fuente(a.fuente); const o = Diseno.texto(String(a.texto || 'Tu texto'), { width: Diseno.W * 0.8 });
        const col = this.hex(a.color); if (col) o.set('fill', col); if (+a.tamano) o.set('fontSize', Math.min(400, Math.max(12, +a.tamano))); if (f) o.set('fontFamily', f);
        Diseno.agregar(o); Diseno.cambio(); return dis('✍️ Texto agregado.');
      }
      case 'diseno_editar': {
        const o = this.textoObjetivo(a.objetivo); if (!o) throw new Error('no encontré ese texto en el diseño');
        if (a.texto != null) o.set('text', String(a.texto));
        const col = this.hex(a.color); if (col) o.set('fill', col);
        if (+a.tamano) o.set('fontSize', Math.min(400, Math.max(12, +a.tamano)));
        if (+a.escala) o.set('fontSize', Math.min(400, Math.max(12, o.fontSize * +a.escala)));
        const f = await this.fuente(a.fuente); if (f) o.set('fontFamily', f);
        if (a.negrita != null) o.set('fontWeight', a.negrita ? '800' : '400');
        o.initDimensions && o.initDimensions(); o.setCoords(); Diseno.c.setActiveObject(o); Diseno.cambio(); Diseno.alSeleccionar();
        return dis(`✏️ Cambié “${o.name || 'Texto'}”.`);
      }
      case 'diseno_fondo': { const col = this.hex(a.color); if (!col) throw new Error('color no válido'); Diseno.ponerFondo(col); return dis('🖌 Fondo cambiado.'); }
      case 'diseno_forma': {
        const map = { rect: 'rect', circulo: 'circulo', triangulo: 'triangulo', estrella: 'estrella', linea: 'linea' }; const f = map[a.forma] || 'rect';
        Diseno.accion(f); const o = Diseno.c.getActiveObject(); const col = this.hex(a.color);
        if (o && col) o.set(f === 'linea' ? 'stroke' : 'fill', col); Diseno.cambio(); return dis('🔷 Forma agregada.');
      }
      case 'diseno_deshacer': Diseno.accion('undo'); await esperar(150); return dis('↶ Deshecho.');
      case 'diseno_rehacer': Diseno.accion('redo'); await esperar(150); return dis('↷ Rehecho.');
      case 'diseno_exportar': {
        if (a.formato === 'pdf') Diseno.exportarPDF(); else await Diseno.exportarPNG();
        return { t: `⬇ Descargué tu diseño en ${a.formato === 'pdf' ? 'PDF' : 'PNG'} (${Diseno.W}×${Diseno.H}).`, adj: [{ tipo: 'diseno', src: this.fotoDiseno() }] };
      }
      case 'lienzo_marco': {
        const id = { iphone: 'marco-tel', android: 'marco-and', tablet: 'marco-tab', escritorio: 'marco-esc' }[a.tipo] || 'marco-tel';
        Lienzo.accion(id); return { t: `📱 Marco ${MARCOS[id][0]} agregado al lienzo.`, adj: [{ tipo: 'lienzo', src: this.fotoLienzo() }] };
      }
      case 'lienzo_agregar': {
        const el = ['rect', 'texto', 'boton'].includes(a.elemento) ? a.elemento : 'rect';
        Lienzo.accion(el); const o = Lienzo.c.getActiveObject();
        if (o && a.texto) { const t = Lienzo.textoDe(o); if (t) { t.set('text', String(a.texto)); Lienzo.c.requestRenderAll(); Lienzo.hist.push(); } }
        return { t: '🧩 Agregado al lienzo.', adj: [{ tipo: 'lienzo', src: this.fotoLienzo() }] };
      }
      case 'lienzo_componente': {
        const pre = Lienzo.predefinidos(); const n = Object.keys(pre).find(k => k.toLowerCase() === String(a.nombre || '').toLowerCase()) || Object.keys(pre).find(k => k.toLowerCase().startsWith(String(a.nombre || '').toLowerCase().slice(0, 4))) || 'Tarjeta';
        Lienzo.colocar(pre[n]()); return { t: `🧩 Componente “${n}” agregado.`, adj: [{ tipo: 'lienzo', src: this.fotoLienzo() }] };
      }
      case 'lienzo_exportar': {
        if (a.formato === 'html') Lienzo.exportarHTML(false); else Lienzo.exportarPNG();
        return { t: `⬇ Descargué el marco en ${a.formato === 'html' ? 'HTML' : 'PNG'}.`, adj: [{ tipo: 'lienzo', src: this.fotoLienzo() }] };
      }
      case 'lienzo_nuevo': Lienzo.ejemplo(); return { t: '🧩 Lienzo nuevo con un ejemplo (puedes Deshacer en Lienzo).', adj: [{ tipo: 'lienzo', src: this.fotoLienzo() }] };
      case 'imagen': {
        const e = ESTILOS.findIndex(x => x[0].toLowerCase() === String(a.estilo || '').toLowerCase()); IA.estilo = e >= 0 ? e : 0;
        IA.tam = { cuadrado: 0, post: 1, historia: 2, horizontal: 3 }[a.tamano] ?? 0;
        $$('#iaEstilos button').forEach((b, i) => b.classList.toggle('activo', i === IA.estilo)); $$('#iaTamanos button').forEach((b, i) => b.classList.toggle('activo', i === IA.tam));
        $('#iaPrompt').value = String(a.prompt || ''); $('#iaSeed').value = '';
        const antes = IA.actual && IA.actual.id; const fin = this.espejo(burb, '#iaEstado', '#iaProgreso');
        try { await IA.generar(String(a.prompt || '')); } finally { fin(); }
        if (!IA.actual || IA.actual.id === antes) throw new Error($('#iaEstado').textContent || 'no salió la imagen');
        const out = { t: `🖼 ${$('#iaGano').textContent}.`, adj: [{ tipo: 'img', gal: IA.actual.id }] };
        if (a.usar === 'diseno' || a.usar === 'lienzo') {
          const url = await blobADataURL(IA.actual.blob);
          if (a.usar === 'diseno') { await Diseno.agregarImagen(url, 'Imagen IA'); Diseno.cambio(); out.adj.push({ tipo: 'diseno', src: this.fotoDiseno() }); out.t += ' La puse en tu diseño.'; }
          else { await Lienzo.agregarImagen(url, 'Imagen IA'); out.adj.push({ tipo: 'lienzo', src: this.fotoLienzo() }); out.t += ' La puse en tu lienzo.'; }
        }
        return out;
      }
      case 'clonar_url': case 'clonar_idea': {
        const antes = Clonar.actual;
        if (a.accion === 'clonar_url') { if (!a.url) throw new Error('falta el link'); Clonar.ponerModo('url'); $('#cUrl').value = a.url; $('#cIdea').value = a.detalles || ''; }
        else { Clonar.ponerModo('idea'); $('#cIdea').value = a.idea || ''; }
        const fin = this.espejo(burb, '#cEstado', '#cProgreso');
        try { await Clonar.crear(); } finally { fin(); }
        if (!Clonar.actual || Clonar.actual === antes) throw new Error($('#cEstado').textContent || 'no salió la app');
        await Clonar.guardar(true);
        return { t: `⚡ “${Clonar.actual.nombre}” lista y guardada en Mis apps. ${$('#cInfo').textContent}`, adj: [{ tipo: 'app', clon: Clonar.actual.id }] };
      }
      case 'clonar_cambio': {
        if (!Clonar.actual) throw new Error('primero crea o abre una app');
        const html0 = Clonar.actual.html; $('#cCambio').value = String(a.cambio || '');
        const fin = this.espejo(burb, '#cEstado', '#cProgreso');
        try { await Clonar.cambiar(); } finally { fin(); }
        if (Clonar.actual.html === html0) throw new Error('no se pudo aplicar el cambio');
        await Clonar.guardar(true);
        return { t: `✅ Cambio aplicado a “${Clonar.actual.nombre}”. ${$('#cInfo').textContent}`, adj: [{ tipo: 'app', clon: Clonar.actual.id }] };
      }
      case 'proyecto_guardar': {
        if (!Clonar.actual) throw new Error('no hay una app abierta para guardar (tus diseños y lienzo ya se guardan solos)');
        await Clonar.guardar(true); return { t: `💾 Guardé “${Clonar.actual.nombre}” en Mis apps.`, adj: [{ tipo: 'app', clon: Clonar.actual.id }] };
      }
      case 'proyectos_listar': {
        const items = []; for (const k of await DB.llaves('clon:')) { const v = await DB.get(k); if (v) items.push(v); }
        items.sort((x, y) => y.fecha - x.fecha);
        if (!items.length) return { t: '📁 Aún no tienes apps guardadas. Pídeme una, por ejemplo: “crea una app de recetas”.' };
        return { t: `📁 Tienes ${items.length} app${items.length > 1 ? 's' : ''}:`, adj: [{ tipo: 'lista', items: items.slice(0, 20).map(v => ({ t: `⚡ ${v.nombre} · ${new Date(v.fecha).toLocaleDateString('es-MX')}`, bts: [{ t: 'Abrir', hacer: { h: 'app_abrir', clon: v.id } }, { t: '🗑', hacer: { h: 'decir', t: `Borra la app ${v.nombre}` } }] })) }] };
      }
      case 'proyecto_abrir': case 'proyecto_borrar': {
        const q = String(a.nombre || '').toLowerCase(); const items = [];
        for (const k of await DB.llaves('clon:')) { const v = await DB.get(k); if (v) items.push(v); }
        // Busca por nombre, por el link o la idea con que se creó, y por palabras sueltas
        const txt = x => [(x.nombre || ''), x.pedido && x.pedido.url || '', x.pedido && x.pedido.idea || ''].join(' ').toLowerCase();
        const pal = q.split(/[^a-z0-9áéíóúñ.]+/).filter(w => w.length > 3);
        const v = items.find(x => (x.nombre || '').toLowerCase() === q) || items.find(x => txt(x).includes(q) || (q && q.includes((x.nombre || '').toLowerCase())))
          || items.map(x => [x, pal.filter(w => txt(x).includes(w)).length]).filter(z => z[1]).sort((a, b) => b[1] - a[1]).map(z => z[0])[0];
        const v2 = v || items.find(x => txt(x).split(/[^a-z0-9áéíóúñ]+/).some(t => t.length >= 5 && pal.some(w => { w = w.replace(/\..*$/, ''); return w.length >= 5 && dist(t, w) <= (Math.min(t.length, w.length) >= 7 ? 2 : 1); })));
        if (!v2) {
          if (!items.length) return { t: '📁 Aún no tienes apps guardadas.' };
          const borrar = a.accion === 'proyecto_borrar';
          return { t: `No encontré “${a.nombre}”. ¿Cuál quieres ${borrar ? 'borrar' : 'abrir'}?`, adj: [{ tipo: 'lista', items: items.slice(0, 20).map(x => ({ t: '⚡ ' + x.nombre, bts: [borrar ? { t: '🗑 Borrar', hacer: { h: 'confirmar_borrar', clon: x.id }, cls: 'peligro' } : { t: 'Abrir', hacer: { h: 'app_abrir', clon: x.id } }] })) }] };
        }
        return this._proyecto(a, v2);
      }
      case 'galeria_listar': {
        const ks = (await DB.llaves('gal:')); const vs = []; for (const k of ks) { const v = await DB.get(k); if (v) vs.push([k, v]); }
        vs.sort((x, y) => y[1].fecha - x[1].fecha);
        if (!vs.length) return { t: '🖼 Tu galería está vacía. Pídeme una imagen.' };
        return { t: `🖼 Tienes ${vs.length} imagen${vs.length > 1 ? 'es' : ''}. Las más recientes:`, adj: vs.slice(0, 3).map(([k]) => ({ tipo: 'img', gal: k })) };
      }
      case 'ajustes_info': {
        const disp = AI.disponibles().map(p => p.id);
        const items = Ajustes.PROV.map(p => { const est = AI.estado[p.id]; const on = disp.includes(p.id); return { n: p.n, cls: est || (on ? 'lista' : ''), e: est === 'ok' ? 'funciona' : est === 'err' ? 'falló hace rato' : on ? 'lista' : p.id === 'puter' ? 'entra con correo' : 'sin llave' }; });
        const llaves = localStorage.getItem('cw_llaves') === '1';
        return { t: `🤖 Trabajan ${disp.length} IA de texto al mismo tiempo. ${llaves ? 'Tus llaves están desbloqueadas con tu PIN.' : 'Tus llaves aún no están desbloqueadas (pon tu PIN en Ajustes).'} Cuenta: ${Cuenta.dentro ? Cuenta.nombre() : 'invitado, todo se guarda en este teléfono'}.`,
          adj: [{ tipo: 'provs', items }, { tipo: 'botones', items: [{ t: '⚙ Abrir Ajustes', hacer: { h: 'ir', tab: 'ajustes' } }, ...(Cuenta.dentro ? [] : [{ t: '☁ Entrar con correo', hacer: { h: 'cuenta_entrar' }, cls: 'primario' }])] }] };
      }
      case 'cuenta_entrar':
        if (Cuenta.dentro) return { t: `☁ Ya estás conectado como ${Cuenta.nombre()}.` };
        return { t: 'Toca el botón para entrar o crear tu cuenta gratis con tu correo:', adj: [{ tipo: 'botones', items: [{ t: '☁ Entrar con correo', hacer: { h: 'cuenta_entrar' }, cls: 'primario' }] }] };
    }
    return null;
  },
};
