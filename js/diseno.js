/* Pestaña Diseño: posts, flyers e historias (estilo DesignCraft) */
const FORMATOS = {
  post: { w: 1080, h: 1080, n: 'Post 1:1' },
  vertical: { w: 1080, h: 1350, n: 'Post 4:5' },
  historia: { w: 1080, h: 1920, n: 'Historia 9:16' },
};
const FUENTES = ['Poppins', 'Montserrat', 'Bebas Neue', 'Anton', 'Oswald', 'Playfair Display', 'Pacifico', 'Lobster', 'Caveat', 'Roboto Mono', 'Arial', 'Georgia'];
const PROPS = ['name', 'esFondo', 'selectable', 'evented', 'lockMovementX', 'lockMovementY', 'lockScalingX', 'lockScalingY', 'lockRotation', 'hasControls', 'fijo', 'ctype', 'esMarco'];

const Diseno = {
  c: null, fmt: 'post', W: 1080, H: 1080, hist: null,

  iniciar() {
    fabric.Object.prototype.set({ transparentCorners: false, cornerColor: '#8b5cf6', cornerStrokeColor: '#fff', borderColor: '#8b5cf6', cornerSize: 26, touchCornerSize: 44, cornerStyle: 'circle', padding: 4 });
    this.c = new fabric.Canvas('dCanvas', { preserveObjectStacking: true, backgroundColor: '#ffffff', enableRetinaScaling: true });
    this.hist = new Historial(() => this.serializar(), (s, cb) => this.cargar(s, cb), s => this.guardar(s));
    const ev = () => { this.hist.push(); this.pintarCapas(); };
    const evYa = () => { this.hist.push(0); this.pintarCapas(); };
    this.c.on('object:added', evYa); this.c.on('object:removed', evYa); this.c.on('object:modified', ev);
    this.c.on('selection:created', () => this.alSeleccionar()); this.c.on('selection:updated', () => this.alSeleccionar());
    this.c.on('selection:cleared', () => this.alSeleccionar());
    this.c.on('text:changed', e => { if (e.target === this.c.getActiveObject()) $('#pTexto').value = e.target.text; });

    $('#dFormatos').innerHTML = Object.entries(FORMATOS).map(([k, f]) => `<button data-fmt="${k}">${f.n}</button>`).join('');
    $$('#dFormatos button').forEach(b => b.onclick = () => this.cambiarFormato(b.dataset.fmt));
    $('#pFuente').innerHTML = FUENTES.map(f => `<option style="font-family:'${f}'">${f}</option>`).join('');
    $$('[data-d]').forEach(b => b.addEventListener('click', () => this.accion(b.dataset.d)));
    $$('[data-alinear]').forEach(b => b.onclick = () => this.alinear(b.dataset.alinear));
    $('#dImg').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) this.agregarImagen(await archivoADataURL(f)); };
    $('#dFondo').oninput = e => this.ponerFondo(e.target.value);
    this.conectarProps();
    window.addEventListener('resize', debounce(() => this.ajustar(), 150));
  },

  async arrancar() {
    const s = await DB.get('diseno');
    if (s) await new Promise(r => this.cargar(s, r));
    else { this.fmt = 'post'; this.W = 1080; this.H = 1080; this.ajustar(); await this.plantilla('promo'); }
    this.hist.reiniciar(); this.marcarFormato(); this.pintarPlantillas(); this.pintarCapas();
  },

  serializar() { return JSON.stringify({ fmt: this.fmt, W: this.W, H: this.H, json: this.c.toJSON(PROPS) }); },
  cargar(s, cb) {
    const d = typeof s === 'string' ? JSON.parse(s) : s;
    this.fmt = d.fmt; this.W = d.W; this.H = d.H; this.ajustar(); this.marcarFormato();
    const fuentes = new Set((d.json.objects || []).filter(o => o.fontFamily).map(o => o.fontFamily));
    Promise.all([...fuentes].map(f => document.fonts.load(`40px "${f}"`).catch(() => {}))).finally(() => {
      this.c.loadFromJSON(d.json, () => { this.c.renderAll(); this.pintarCapas(); this.alSeleccionar(); cb && cb(); });
    });
  },
  guardar: debounce(function (s) { DB.set('diseno', s); }, 800),

  ajustar() {
    const wrap = $('#dWrap'); const anchoDisp = (wrap.clientWidth || window.innerWidth - 20) - 16;
    const altoDisp = window.innerHeight * 0.62;
    const k = Math.min(anchoDisp / this.W, altoDisp / this.H);
    this.c.setDimensions({ width: Math.round(this.W * k), height: Math.round(this.H * k) });
    this.c.setZoom(k); this.c.requestRenderAll();
  },
  marcarFormato() { $$('#dFormatos button').forEach(b => b.classList.toggle('activo', b.dataset.fmt === this.fmt)); },

  async cambiarFormato(fmt) {
    if (fmt === this.fmt) return;
    const f = FORMATOS[fmt]; const kx = f.w / this.W, ky = f.h / this.H;
    this.c.getObjects().forEach(o => {
      if (o.esFondo) o.set({ left: 0, top: 0, width: f.w / (o.scaleX || 1), height: f.h / (o.scaleY || 1) });
      else o.set({ left: o.left * kx, top: o.top * ky });
      o.setCoords();
    });
    this.fmt = fmt; this.W = f.w; this.H = f.h; this.ajustar(); this.marcarFormato(); this.pintarPlantillas();
    this.hist.push(); toast('Formato: ' + f.n);
  },

  /* ---------- Agregar elementos ---------- */
  centro() { return { x: this.W / 2, y: this.H / 2 }; },
  agregar(o, centrar = true) {
    if (!o.name) o.name = this.nombreTipo(o);
    if (centrar) { const c = this.centro(); o.set({ originX: 'center', originY: 'center', left: c.x, top: c.y }); }
    this.c.add(o); this.c.setActiveObject(o); this.c.requestRenderAll();
    $('#dProps').open = true; return o;
  },
  nombreTipo(o) { return { textbox: 'Texto', 'i-text': 'Texto', rect: 'Rectángulo', circle: 'Círculo', triangle: 'Triángulo', polygon: 'Estrella', line: 'Línea', image: 'Imagen', group: 'Grupo' }[o.type] || o.type; },
  estrella(r, n = 5) { const p = []; for (let i = 0; i < n * 2; i++) { const a = Math.PI / n * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; p.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr }); } return p; },
  texto(t, o = {}) { return new fabric.Textbox(t, Object.assign({ width: 800, fontSize: 90, fontFamily: 'Poppins', fontWeight: '800', fill: '#111111', textAlign: 'center', lineHeight: 1.1, splitByGrapheme: false }, o)); },

  async agregarImagen(url, nombre = 'Imagen') {
    const img = await new Promise(ok => fabric.Image.fromURL(url, ok, { crossOrigin: 'anonymous' }));
    if (!img || !img.width) { toast('No se pudo abrir la imagen'); return; }
    const k = Math.min((this.W * 0.8) / img.width, (this.H * 0.8) / img.height);
    img.set({ scaleX: k, scaleY: k, name: nombre });
    this.agregar(img); toast('Imagen agregada');
  },

  accion(a) {
    const c = this.c, o = c.getActiveObject();
    const req = () => { if (!o) { toast('Primero toca un elemento'); return false; } return true; };
    switch (a) {
      case 'texto': this.agregar(this.texto('Tu texto aquí', { width: 800 })); break;
      case 'rect': this.agregar(new fabric.Rect({ width: 500, height: 300, fill: '#8b5cf6', rx: 30, ry: 30 })); break;
      case 'circulo': this.agregar(new fabric.Circle({ radius: 200, fill: '#ec4899' })); break;
      case 'triangulo': this.agregar(new fabric.Triangle({ width: 400, height: 360, fill: '#f59e0b' })); break;
      case 'estrella': this.agregar(new fabric.Polygon(this.estrella(220), { fill: '#facc15' })); break;
      case 'linea': this.agregar(new fabric.Line([0, 0, 600, 0], { stroke: '#111111', strokeWidth: 12, strokeLineCap: 'round' })); break;
      case 'undo': this.hist.ir(-1); break;
      case 'redo': this.hist.ir(1); break;
      case 'duplicar': if (req()) o.clone(cl => { cl.set({ left: o.left + 40, top: o.top + 40, name: (o.name || 'Copia') + ' copia' }); if (cl.type === 'activeSelection') { cl.canvas = c; cl.forEachObject(x => c.add(x)); cl.setCoords(); } else c.add(cl); c.setActiveObject(cl); c.requestRenderAll(); }, PROPS); break;
      case 'borrar': if (req()) { (o.type === 'activeSelection' ? o.getObjects() : [o]).forEach(x => c.remove(x)); c.discardActiveObject(); c.requestRenderAll(); } break;
      case 'adelante': if (req()) { c.bringForward(o); this.cambio(); } break;
      case 'atras': if (req()) { c.sendBackwards(o); this.mantenerFondo(); this.cambio(); } break;
      case 'bloquear': if (req()) this.fijar(o, !o.fijo); break;
      case 'voltear': if (req()) { o.set('flipX', !o.flipX); this.cambio(); } break;
      case 'png': this.exportarPNG(); break;
      case 'pdf': this.exportarPDF(); break;
      case 'compartir': this.compartir(); break;
      case 'nuevo': if (confirm('¿Empezar un diseño en blanco? (El actual se puede recuperar con Deshacer)')) this.plantilla('blanco'); break;
    }
  },
  cambio() { this.c.requestRenderAll(); this.hist.push(); this.pintarCapas(); },
  fijar(o, si) {
    o.set({ fijo: si, lockMovementX: si, lockMovementY: si, lockScalingX: si, lockScalingY: si, lockRotation: si, hasControls: !si });
    this.cambio(); toast(si ? 'Fijado: ya no se mueve' : 'Ya se puede mover');
  },
  mantenerFondo() { const f = this.c.getObjects().find(o => o.esFondo); if (f) this.c.sendToBack(f); },
  ponerFondo(color) {
    const f = this.c.getObjects().find(o => o.esFondo);
    if (f) f.set('fill', color); else this.c.setBackgroundColor(color);
    this.cambio();
  },

  alinear(dir) {
    const o = this.c.getActiveObject(); if (!o) { toast('Primero toca un elemento'); return; }
    const b = o.getBoundingRect(true, true);
    const dx = { izq: -b.left, ch: this.W / 2 - (b.left + b.width / 2), der: this.W - (b.left + b.width) }[dir];
    const dy = { arr: -b.top, cv: this.H / 2 - (b.top + b.height / 2), aba: this.H - (b.top + b.height) }[dir];
    if (dx !== undefined) o.set('left', o.left + dx);
    if (dy !== undefined) o.set('top', o.top + dy);
    o.setCoords(); this.cambio();
  },

  /* ---------- Panel de propiedades ---------- */
  alSeleccionar() {
    const o = this.c.getActiveObject();
    $('#dSelNombre').textContent = o ? '· ' + (o.type === 'activeSelection' ? 'Varios' : o.name || this.nombreTipo(o)) : '(nada seleccionado)';
    const esT = o && (o.type === 'textbox' || o.type === 'i-text');
    $$('#dProps .solo-texto').forEach(e => e.hidden = !esT);
    $$('#dProps .solo-rect').forEach(e => e.hidden = !(o && o.type === 'rect'));
    if (o) {
      if (esT) {
        $('#pTexto').value = o.text; $('#pFuente').value = o.fontFamily; $('#pTam').value = o.fontSize; $('#pTamV').textContent = Math.round(o.fontSize);
        $('#pInter').value = o.lineHeight;
        $('#pNegrita').classList.toggle('activo', String(o.fontWeight) >= '600' || o.fontWeight === 'bold');
        $('#pCursiva').classList.toggle('activo', o.fontStyle === 'italic');
        $$('#dProps [data-al]').forEach(b => b.classList.toggle('activo', b.dataset.al === o.textAlign));
      }
      const col = o.type === 'line' ? o.stroke : o.fill;
      if (typeof col === 'string' && col.startsWith('#')) $('#pColor').value = col.slice(0, 7);
      if (typeof o.stroke === 'string' && o.stroke.startsWith('#')) $('#pBorde').value = o.stroke.slice(0, 7);
      $('#pBordeAncho').value = o.type === 'line' ? o.strokeWidth : (o.strokeWidth || 0) * (o.stroke ? 1 : 0);
      $('#pRadio').value = o.rx || 0; $('#pOpac').value = o.opacity;
      $('#pSombra').checked = !!o.shadow; if (o.shadow) $('#pSombraC').value = (o.shadow.color || '#000000').slice(0, 7);
    }
    this.pintarCapas();
  },
  conectarProps() {
    const act = fn => () => { const o = this.c.getActiveObject(); if (!o) return; (o.type === 'activeSelection' ? o.getObjects() : [o]).forEach(fn); o.setCoords && o.setCoords(); this.cambio(); };
    const esT = x => x.type === 'textbox' || x.type === 'i-text';
    $('#pTexto').oninput = act(x => { if (esT(x)) x.set('text', $('#pTexto').value); });
    $('#pFuente').onchange = () => { const f = $('#pFuente').value; document.fonts.load(`40px "${f}"`).finally(act(x => { if (esT(x)) { x.set('fontFamily', f); x.initDimensions(); } })); };
    $('#pTam').oninput = act(x => { if (esT(x)) { x.set('fontSize', +$('#pTam').value); $('#pTamV').textContent = $('#pTam').value; } });
    $('#pInter').oninput = act(x => { if (esT(x)) x.set('lineHeight', +$('#pInter').value); });
    $('#pNegrita').onclick = act(x => { if (esT(x)) x.set('fontWeight', String(x.fontWeight) >= '600' || x.fontWeight === 'bold' ? '400' : '800'); });
    $('#pCursiva').onclick = act(x => { if (esT(x)) x.set('fontStyle', x.fontStyle === 'italic' ? 'normal' : 'italic'); });
    $$('#dProps [data-al]').forEach(b => b.onclick = act(x => { if (esT(x)) x.set('textAlign', b.dataset.al); }));
    $('#pColor').oninput = act(x => { if (x.type === 'line') x.set('stroke', $('#pColor').value); else x.set('fill', $('#pColor').value); });
    $('#pBorde').oninput = act(x => { if (x.type === 'line') return; x.set('stroke', $('#pBorde').value); if (!x.strokeWidth) x.set('strokeWidth', 6); });
    $('#pBordeAncho').oninput = act(x => { const v = +$('#pBordeAncho').value; if (x.type !== 'line' && !x.stroke) x.set('stroke', $('#pBorde').value); x.set('strokeWidth', x.type === 'line' ? Math.max(1, v) : v); });
    $('#pRadio').oninput = act(x => { if (x.type === 'rect') x.set({ rx: +$('#pRadio').value, ry: +$('#pRadio').value }); });
    $('#pOpac').oninput = act(x => x.set('opacity', +$('#pOpac').value));
    const sombra = act(x => x.set('shadow', $('#pSombra').checked ? new fabric.Shadow({ color: $('#pSombraC').value + 'aa', blur: 25, offsetX: 8, offsetY: 10 }) : null));
    $('#pSombra').onchange = sombra; $('#pSombraC').oninput = () => { if ($('#pSombra').checked) sombra(); };
  },

  /* ---------- Capas ---------- */
  pintarCapas: debounce(function () {
    const ul = $('#dCapas'); const objs = this.c.getObjects().slice().reverse(); const act = this.c.getActiveObject();
    const sel = act ? (act.type === 'activeSelection' ? act.getObjects() : [act]) : [];
    ul.innerHTML = objs.length ? '' : '<li class="muted" style="padding:10px">Sin elementos todavía</li>';
    objs.forEach(o => {
      const li = document.createElement('li'); if (sel.includes(o)) li.className = 'sel';
      li.innerHTML = `<button class="n">${o.visible === false ? '🙈 ' : ''}${o.fijo ? '🔒 ' : ''}${escaparHTML(o.name || this.nombreTipo(o))}</button><button data-a="sube" aria-label="Subir">▲</button><button data-a="baja" aria-label="Bajar">▼</button><button data-a="ver" aria-label="Ocultar">${o.visible === false ? '🙈' : '👁'}</button><button data-a="fijar" aria-label="Fijar">${o.fijo ? '🔓' : '🔒'}</button>`;
      li.querySelector('.n').onclick = () => { if (o.selectable === false) { toast('Este elemento está bloqueado'); return; } this.c.setActiveObject(o); this.c.requestRenderAll(); this.alSeleccionar(); };
      li.querySelector('[data-a=sube]').onclick = () => { this.c.bringForward(o); this.cambio(); };
      li.querySelector('[data-a=baja]').onclick = () => { this.c.sendBackwards(o); this.mantenerFondo(); this.cambio(); };
      li.querySelector('[data-a=ver]').onclick = () => { o.set('visible', o.visible === false); if (o.visible === false) this.c.discardActiveObject(); this.cambio(); };
      li.querySelector('[data-a=fijar]').onclick = () => this.fijar(o, !o.fijo);
      ul.appendChild(li);
    });
  }, 60),

  /* ---------- Plantillas ---------- */
  PLANTILLAS: {
    blanco: { n: 'En blanco' }, promo: { n: 'Promoción' }, frase: { n: 'Frase' }, evento: { n: 'Evento' }, oferta: { n: 'Oferta' }, menu: { n: 'Menú / lista' },
  },
  objetosPlantilla(id, W, H) {
    const u = W / 1080, out = []; const T = (t, o) => this.texto(t, Object.assign({ width: W - 160 * u, left: 80 * u, originX: 'left', originY: 'top' }, o));
    const fondo = fill => new fabric.Rect({ left: 0, top: 0, width: W, height: H, fill, name: 'Fondo', esFondo: true, selectable: true, lockMovementX: true, lockMovementY: true, hasControls: false, hoverCursor: 'default' });
    const grad = (a, b) => new fabric.Gradient({ type: 'linear', coords: { x1: 0, y1: 0, x2: W, y2: H }, colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }] });
    const cy = f => H * f;
    if (id === 'blanco') out.push(fondo('#ffffff'));
    if (id === 'promo') {
      out.push(fondo(grad('#7c3aed', '#ec4899')));
      out.push(new fabric.Circle({ radius: 300 * u, left: W - 260 * u, top: -180 * u, fill: '#ffffff', opacity: 0.12, name: 'Burbuja' }));
      out.push(T('NUEVO', { top: cy(0.18), fontSize: 60 * u, fill: '#fde68a', fontFamily: 'Montserrat', fontWeight: '900', charSpacing: 400, name: 'Etiqueta' }));
      out.push(T('Tu producto estrella', { top: cy(0.26), fontSize: 130 * u, fill: '#ffffff', fontFamily: 'Bebas Neue', fontWeight: '400', lineHeight: 0.95, name: 'Título', shadow: new fabric.Shadow({ color: '#00000066', blur: 20 * u, offsetY: 8 * u }) }));
      out.push(T('Calidad que se nota. Escríbenos y pide el tuyo hoy.', { top: cy(0.55), fontSize: 46 * u, fill: '#f5f3ff', fontWeight: '400', name: 'Descripción' }));
      out.push(new fabric.Rect({ left: W / 2, top: cy(0.78), originX: 'center', originY: 'center', width: 520 * u, height: 120 * u, rx: 60 * u, ry: 60 * u, fill: '#ffffff', name: 'Botón' }));
      out.push(this.texto('Pide el tuyo', { left: W / 2, top: cy(0.78), originX: 'center', originY: 'center', width: 500 * u, fontSize: 52 * u, fill: '#7c3aed', fontWeight: '800', name: 'Texto botón' }));
    }
    if (id === 'frase') {
      out.push(fondo('#111827'));
      out.push(this.texto('“', { left: W / 2, top: cy(0.2), originX: 'center', originY: 'center', fontSize: 300 * u, fill: '#a78bfa', fontFamily: 'Playfair Display', name: 'Comillas' }));
      out.push(T('Los sueños no funcionan si tú no trabajas.', { top: cy(0.32), fontSize: 92 * u, fill: '#ffffff', fontFamily: 'Playfair Display', fontWeight: '700', fontStyle: 'italic', name: 'Frase' }));
      out.push(T('— Tu nombre', { top: cy(0.72), fontSize: 44 * u, fill: '#c4b5fd', fontWeight: '400', name: 'Autor' }));
    }
    if (id === 'evento') {
      out.push(fondo(grad('#0ea5e9', '#1e3a8a')));
      out.push(new fabric.Rect({ left: 60 * u, top: 60 * u, width: W - 120 * u, height: H - 120 * u, fill: '', stroke: '#ffffff', strokeWidth: 6 * u, rx: 30 * u, ry: 30 * u, name: 'Marco', selectable: true }));
      out.push(T('GRAN EVENTO', { top: cy(0.2), fontSize: 140 * u, fill: '#ffffff', fontFamily: 'Anton', fontWeight: '400', name: 'Título' }));
      out.push(T('SÁBADO 20 · 8:00 PM', { top: cy(0.45), fontSize: 64 * u, fill: '#fde047', fontFamily: 'Oswald', fontWeight: '700', name: 'Fecha' }));
      out.push(T('📍 Lugar del evento, Ciudad', { top: cy(0.57), fontSize: 46 * u, fill: '#e0f2fe', fontWeight: '400', name: 'Lugar' }));
      out.push(T('Entrada libre', { top: cy(0.78), fontSize: 56 * u, fill: '#ffffff', fontFamily: 'Pacifico', fontWeight: '400', name: 'Extra' }));
    }
    if (id === 'oferta') {
      out.push(fondo('#fef3c7'));
      out.push(new fabric.Polygon(this.estrella(330 * u, 12), { left: W / 2, top: cy(0.36), originX: 'center', originY: 'center', fill: '#ef4444', name: 'Estrella' }));
      out.push(this.texto('-50%', { left: W / 2, top: cy(0.36), originX: 'center', originY: 'center', width: 600 * u, fontSize: 170 * u, fill: '#ffffff', fontFamily: 'Anton', fontWeight: '400', name: 'Descuento' }));
      out.push(T('SOLO ESTE FIN DE SEMANA', { top: cy(0.68), fontSize: 64 * u, fill: '#7c2d12', fontFamily: 'Montserrat', fontWeight: '900', name: 'Título' }));
      out.push(T('En toda la tienda · Hasta agotar existencias', { top: cy(0.8), fontSize: 38 * u, fill: '#9a3412', fontWeight: '400', name: 'Detalle' }));
    }
    if (id === 'menu') {
      out.push(fondo('#1c1917'));
      out.push(T('MENÚ DEL DÍA', { top: cy(0.08), fontSize: 110 * u, fill: '#fbbf24', fontFamily: 'Bebas Neue', fontWeight: '400', name: 'Título' }));
      ['Tacos al pastor ........ $25', 'Quesadillas ............. $35', 'Agua fresca ............. $20', 'Postre del día .......... $30'].forEach((t, i) =>
        out.push(T(t, { top: cy(0.3 + i * 0.13), fontSize: 50 * u, fill: '#fafaf9', fontFamily: 'Roboto Mono', fontWeight: '400', textAlign: 'left', name: 'Platillo ' + (i + 1) })));
      out.push(T('Pide por WhatsApp', { top: cy(0.86), fontSize: 50 * u, fill: '#fbbf24', fontFamily: 'Pacifico', fontWeight: '400', name: 'Contacto' }));
    }
    return out;
  },
  async plantilla(id) {
    await Promise.all(FUENTES.slice(0, 10).map(f => document.fonts.load(`40px "${f}"`).catch(() => {})));
    this.hist.bloq = true;
    this.c.clear(); this.c.setBackgroundColor('#ffffff');
    this.objetosPlantilla(id, this.W, this.H).forEach(o => this.c.add(o));
    this.c.discardActiveObject(); this.c.requestRenderAll();
    this.hist.bloq = false; this.hist.push(); this.pintarCapas(); this.alSeleccionar();
  },
  async pintarPlantillas() {
    const cont = $('#dPlantillas'); cont.innerHTML = '';
    await Promise.all(FUENTES.slice(0, 10).map(f => document.fonts.load(`40px "${f}"`).catch(() => {})));
    const sc = new fabric.StaticCanvas(null, { width: this.W, height: this.H, backgroundColor: '#fff' });
    for (const [id, p] of Object.entries(this.PLANTILLAS)) {
      sc.clear(); sc.setBackgroundColor('#fff'); this.objetosPlantilla(id, this.W, this.H).forEach(o => sc.add(o)); sc.renderAll();
      const b = document.createElement('button');
      b.innerHTML = `<img alt="" src="${sc.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 240 / this.W })}"><span>${p.n}</span>`;
      b.onclick = () => { this.plantilla(id); toast('Plantilla: ' + p.n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
      cont.appendChild(b);
    }
    sc.dispose();
  },

  /* ---------- Exportar ---------- */
  lienzoFinal() {
    this.c.discardActiveObject(); this.c.renderAll();
    const el = this.c.toCanvasElement(this.W / this.c.getWidth());
    if (el.width === this.W && el.height === this.H) return el;
    const f = document.createElement('canvas'); f.width = this.W; f.height = this.H; f.getContext('2d').drawImage(el, 0, 0, this.W, this.H); return f;
  },
  nombreArchivo(ext) { return `diseno-${this.fmt}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`; },
  async pngBlob() { const el = this.lienzoFinal(); return new Promise(r => el.toBlob(r, 'image/png')); },
  async exportarPNG() { descargar(await this.pngBlob(), this.nombreArchivo('png')); toast('PNG descargado ✅'); },
  exportarPDF() {
    const el = this.lienzoFinal(); const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: this.W > this.H ? 'l' : 'p', unit: 'px', format: [this.W, this.H], hotfixes: ['px_scaling'] });
    pdf.addImage(el.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, this.W, this.H);
    descargar(pdf.output('blob'), this.nombreArchivo('pdf')); toast('PDF descargado ✅');
  },
  async compartir() {
    const b = await this.pngBlob(); const f = new File([b], this.nombreArchivo('png'), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'Mi diseño' }); } catch (e) {} }
    else { descargar(b, f.name); toast('Tu navegador no permite compartir; lo descargué'); }
  },
};
