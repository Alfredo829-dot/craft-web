/* Pestaña Lienzo: maquetas de apps y webs en un lienzo infinito (estilo FigCraft) */
const MARCOS = { 'marco-tel': ['iPhone', 390, 844], 'marco-and': ['Android', 412, 915], 'marco-tab': ['Tablet', 768, 1024], 'marco-esc': ['Escritorio', 1440, 900] };

const Lienzo = {
  c: null, hist: null, multi: false, pinza: null, paneo: null, hijos: null, comps: [], selMulti: [],

  iniciar() {
    const c = this.c = new fabric.Canvas('lCanvas', { preserveObjectStacking: true, selection: false, backgroundColor: null, targetFindTolerance: 6 });
    this.hist = new Historial(() => this.serializar(), (s, cb) => this.cargar(s, cb), s => this.guardar(s));
    const ev = () => this.hist.push();
    c.on('object:added', e => e.target && e.target.set({ cornerSize: 14, touchCornerSize: 40, padding: 2 }));
    c.on('object:added', () => this.hist.push(0)); c.on('object:removed', () => this.hist.push(0)); c.on('object:modified', ev);
    ['selection:created', 'selection:updated', 'selection:cleared'].forEach(e => c.on(e, () => this.alSeleccionar()));

    /* Cuadrícula de puntos y nombres de marcos (solo en pantalla, no al exportar) */
    c.on('before:render', o => { if (o.ctx === c.contextContainer) this.cuadricula(o.ctx); });
    c.on('after:render', o => { if (o.ctx === c.contextContainer) this.etiquetas(o.ctx); });

    /* Un dedo en el fondo mueve el lienzo; mover un marco arrastra lo que tiene dentro */
    c.on('mouse:down', o => {
      if (this.pinza) return;
      if (!o.target) { const p = this.punto(o.e); this.paneo = { x: p.x, y: p.y }; return; }
      if (this.multi) this.alternarMulti(o.target);
      if (o.target.esMarco) this.hijos = { x: o.target.left, y: o.target.top, objs: this.hijosDe(o.target).map(h => ({ h, x: h.left, y: h.top })) };
    });
    c.on('mouse:move', o => {
      if (!this.paneo || this.pinza) return;
      const p = this.punto(o.e); c.relativePan({ x: p.x - this.paneo.x, y: p.y - this.paneo.y }); this.paneo = p;
    });
    c.on('mouse:up', () => { if (this.paneo) { this.paneo = null; this.guardarVista(); } if (this.hijos) this.hist.push(); this.hijos = null; });
    c.on('object:moving', o => {
      if (!this.hijos || o.target.type === 'activeSelection') return;
      const dx = o.target.left - this.hijos.x, dy = o.target.top - this.hijos.y;
      this.hijos.objs.forEach(({ h, x, y }) => { h.set({ left: x + dx, top: y + dy }); h.setCoords(); });
    });
    c.on('mouse:wheel', o => { const z = this.limZoom(c.getZoom() * 0.999 ** o.e.deltaY); c.zoomToPoint({ x: o.e.offsetX, y: o.e.offsetY }, z); o.e.preventDefault(); this.pintarZoom(); this.guardarVista(); });

    /* Pellizco con dos dedos (zoom): se intercepta antes que Fabric */
    const wrap = $('#lWrap');
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const medio = t => { const r = c.upperCanvasEl.getBoundingClientRect(); return { x: (t[0].clientX + t[1].clientX) / 2 - r.left, y: (t[0].clientY + t[1].clientY) / 2 - r.top }; };
    wrap.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        e.stopPropagation(); e.preventDefault();
        c._currentTransform = null; this.paneo = null; this.hijos = null;
        this.pinza = { d: dist(e.touches), z: c.getZoom(), m: medio(e.touches) };
      }
    }, { capture: true, passive: false });
    wrap.addEventListener('touchmove', e => {
      if (!this.pinza || e.touches.length < 2) return;
      e.stopPropagation(); e.preventDefault();
      const m = medio(e.touches); const z = this.limZoom(this.pinza.z * dist(e.touches) / this.pinza.d);
      c.zoomToPoint(m, z); c.relativePan({ x: m.x - this.pinza.m.x, y: m.y - this.pinza.m.y }); this.pinza.m = m; this.pintarZoom();
    }, { capture: true, passive: false });
    const finPinza = e => { if (this.pinza && e.touches.length < 2) { if (e.touches.length) e.stopPropagation(); else { this.pinza = null; c._currentTransform = null; this.guardarVista(); } } };
    wrap.addEventListener('touchend', finPinza, { capture: true }); wrap.addEventListener('touchcancel', finPinza, { capture: true });

    $$('[data-l]').forEach(b => b.addEventListener('click', () => this.accion(b.dataset.l)));
    $('#lImg').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) this.agregarImagen(await archivoADataURL(f, 1200)); };
    this.conectarProps();
    window.addEventListener('resize', debounce(() => { if (App.tab === 'lienzo') this.ajustarTam(); }, 150));
  },

  async arrancar() {
    this.ajustarTam();
    this.comps = (await DB.get('comps')) || [];
    const s = await DB.get('lienzo');
    if (s) await new Promise(r => this.cargar(s, r)); else this.ejemplo();
    this.hist.reiniciar(); this.pintarComps();
  },
  ajustarTam() {
    const w = $('#lWrap').clientWidth || window.innerWidth - 20;
    const h = Math.max(380, Math.round(window.innerHeight * 0.58));
    if (w < 50) return;
    this.c.setDimensions({ width: w - 2, height: h }); this.c.requestRenderAll();
  },
  punto(e) { const t = e.touches && e.touches[0] ? e.touches[0] : (e.changedTouches && e.changedTouches[0]) || e; const r = this.c.upperCanvasEl.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; },
  limZoom(z) { return Math.min(6, Math.max(0.05, z)); },
  pintarZoom() { $('#lZoom').textContent = Math.round(this.c.getZoom() * 100) + '%'; },
  centroMundo() { const v = this.c.viewportTransform; return { x: (this.c.width / 2 - v[4]) / v[0], y: (this.c.height / 2 - v[5]) / v[3] }; },

  cuadricula(ctx) {
    const v = this.c.viewportTransform, z = v[0]; let paso = 40 * z; while (paso < 18) paso *= 2;
    ctx.save(); ctx.fillStyle = '#2a2e3a';
    const ox = v[4] % paso, oy = v[5] % paso;
    for (let x = ox; x < this.c.width; x += paso) for (let y = oy; y < this.c.height; y += paso) ctx.fillRect(x - 1, y - 1, 2, 2);
    ctx.restore();
  },
  etiquetas(ctx) {
    const v = this.c.viewportTransform;
    ctx.save(); ctx.font = '600 12px Poppins, sans-serif'; ctx.fillStyle = '#a5adc4';
    this.c.getObjects().filter(o => o.esMarco).forEach(m => { const b = m.getBoundingRect(true, true); ctx.fillText(`${m.name} · ${Math.round(m.width * m.scaleX)}×${Math.round(m.height * m.scaleY)}`, b.left * v[0] + v[4], b.top * v[3] + v[5] - 6); });
    ctx.restore();
  },

  serializar() { return JSON.stringify({ json: this.c.toJSON(PROPS), vista: this.c.viewportTransform }); },
  cargar(s, cb) {
    const d = typeof s === 'string' ? JSON.parse(s) : s;
    this.c.loadFromJSON(d.json, () => {
      this.c.backgroundColor = null;
      if (d.vista) this.c.setViewportTransform(d.vista);
      this.c.renderAll(); this.pintarZoom(); this.alSeleccionar(); cb && cb();
    });
  },
  guardar: debounce(function (s) { DB.set('lienzo', s); }, 800),
  guardarVista: debounce(function () { DB.set('lienzo', Lienzo.serializar()); }, 1200),

  /* ---------- Elementos ---------- */
  marco(id, x, y) {
    const [n, w, h] = MARCOS[id];
    return new fabric.Rect({ left: x, top: y, width: w, height: h, fill: '#ffffff', name: n, esMarco: true, stroke: '#3b4152', strokeWidth: 1, strokeUniform: true, lockScalingFlip: true });
  },
  rect(o = {}) { return new fabric.Rect(Object.assign({ width: 160, height: 100, fill: '#8b5cf6', rx: 12, ry: 12, name: 'Rectángulo' }, o)); },
  texto(t, o = {}) { return new fabric.Textbox(t, Object.assign({ width: 220, fontSize: 22, fontFamily: 'Poppins', fill: '#111827', name: 'Texto' }, o)); },
  boton(t = 'Botón', o = {}) {
    const r = new fabric.Rect({ width: 200, height: 52, rx: 14, ry: 14, fill: '#7c3aed', originX: 'center', originY: 'center' });
    const tx = new fabric.Textbox(t, { width: 190, fontSize: 18, fontWeight: '600', fontFamily: 'Poppins', fill: '#ffffff', textAlign: 'center', originX: 'center', originY: 'center' });
    return new fabric.Group([r, tx], Object.assign({ name: 'Botón', ctype: 'boton' }, o));
  },
  predefinidos() {
    return {
      'Botón': () => this.boton('Comenzar'),
      'Tarjeta': () => new fabric.Group([
        new fabric.Rect({ width: 320, height: 180, rx: 18, ry: 18, fill: '#ffffff', stroke: '#e5e7eb', strokeWidth: 1, shadow: new fabric.Shadow({ color: '#0000001f', blur: 18, offsetY: 6 }) }),
        new fabric.Textbox('Título de tarjeta', { left: 20, top: 20, width: 280, fontSize: 22, fontWeight: '700', fontFamily: 'Poppins', fill: '#111827' }),
        new fabric.Textbox('Una descripción corta para explicar algo.', { left: 20, top: 62, width: 280, fontSize: 15, fontFamily: 'Poppins', fill: '#6b7280' }),
        new fabric.Rect({ left: 20, top: 122, width: 120, height: 38, rx: 10, ry: 10, fill: '#7c3aed' }),
        new fabric.Textbox('Ver más', { left: 20, top: 131, width: 120, fontSize: 15, fontWeight: '600', fontFamily: 'Poppins', fill: '#fff', textAlign: 'center' }),
      ], { name: 'Tarjeta', ctype: 'tarjeta' }),
      'Barra': () => new fabric.Group([
        new fabric.Rect({ width: 390, height: 64, fill: '#111827' }),
        new fabric.Textbox('Mi App', { left: 20, top: 18, width: 200, fontSize: 22, fontWeight: '700', fontFamily: 'Poppins', fill: '#fff' }),
        new fabric.Textbox('☰', { left: 340, top: 14, width: 34, fontSize: 26, fontFamily: 'Poppins', fill: '#fff' }),
      ], { name: 'Barra de navegación', ctype: 'barra' }),
      'Campo': () => new fabric.Group([
        new fabric.Rect({ width: 320, height: 50, rx: 12, ry: 12, fill: '#ffffff', stroke: '#d1d5db', strokeWidth: 1.5 }),
        new fabric.Textbox('Escribe aquí…', { left: 16, top: 14, width: 290, fontSize: 17, fontFamily: 'Poppins', fill: '#9ca3af' }),
      ], { name: 'Campo de texto', ctype: 'campo' }),
      'Avatar': () => new fabric.Group([
        new fabric.Circle({ radius: 32, fill: '#c4b5fd' }),
        new fabric.Textbox('AG', { left: 0, top: 18, width: 64, fontSize: 22, fontWeight: '700', fontFamily: 'Poppins', fill: '#4c1d95', textAlign: 'center' }),
      ], { name: 'Avatar' }),
      'Lista': () => new fabric.Group([0, 1, 2].flatMap(i => [
        new fabric.Rect({ top: i * 64, width: 340, height: 56, rx: 12, ry: 12, fill: '#f3f4f6' }),
        new fabric.Textbox('Elemento ' + (i + 1), { left: 16, top: i * 64 + 16, width: 300, fontSize: 17, fontFamily: 'Poppins', fill: '#111827' }),
      ]), { name: 'Lista' }),
    };
  },
  colocar(o) {
    const sel = this.c.getActiveObject(); let p = this.centroMundo();
    const m = sel && (sel.esMarco ? sel : this.marcoDe(sel));
    if (m) { const b = m.getBoundingRect(true, true); p = { x: b.left + b.width / 2, y: b.top + Math.min(b.height / 2, 160) }; }
    o.set({ left: p.x - o.getScaledWidth() / 2, top: p.y - o.getScaledHeight() / 2 }); o.setCoords();
    this.c.add(o); this.c.setActiveObject(o); this.c.requestRenderAll(); $('#lProps').open = true; return o;
  },
  async agregarImagen(url, nombre = 'Imagen') {
    const img = await new Promise(ok => fabric.Image.fromURL(url, ok, { crossOrigin: 'anonymous' }));
    if (!img || !img.width) { toast('No se pudo abrir la imagen'); return; }
    const k = Math.min(1, 340 / img.width); img.set({ scaleX: k, scaleY: k, name: nombre }); this.colocar(img); toast('Imagen agregada al lienzo');
  },
  ejemplo() {
    const c = this.c; this.hist.bloq = true; c.clear(); c.backgroundColor = null;
    const m = this.marco('marco-tel', 0, 0); c.add(m);
    const pre = this.predefinidos();
    const barra = pre['Barra'](); barra.set({ left: 0, top: 0 }); c.add(barra);
    c.add(this.texto('Bienvenido 👋', { left: 24, top: 110, width: 340, fontSize: 34, fontWeight: '800' }));
    c.add(this.texto('Diseña tu app aquí: arrastra, cambia colores y exporta a HTML.', { left: 24, top: 165, width: 340, fontSize: 17, fill: '#6b7280' }));
    const t = pre['Tarjeta'](); t.set({ left: 35, top: 260 }); c.add(t);
    const b = this.boton('Comenzar'); b.set({ left: 95, top: 720 }); c.add(b);
    c.setViewportTransform([1, 0, 0, 1, 0, 0]); this.hist.bloq = false;
    this.ajustarVista(); this.hist.push();
  },

  /* ---------- Marcos ---------- */
  dentro(o, m) { const a = o.getBoundingRect(true, true), b = m.getBoundingRect(true, true); const cx = a.left + a.width / 2, cy = a.top + a.height / 2; return cx >= b.left && cx <= b.left + b.width && cy >= b.top && cy <= b.top + b.height; },
  hijosDe(m) { const objs = this.c.getObjects(); const i = objs.indexOf(m); return objs.filter((o, j) => j > i && !o.esMarco && this.dentro(o, m)); },
  marcoDe(o) { if (!o) return null; const ms = this.c.getObjects().filter(x => x.esMarco).reverse(); return ms.find(m => m !== o && this.dentro(o, m)) || null; },
  marcoActual() {
    const o = this.c.getActiveObject();
    if (o && o.esMarco) return o;
    return this.marcoDe(o) || this.ultimoMarco || this.c.getObjects().find(x => x.esMarco) || null;
  },

  /* ---------- Acciones ---------- */
  accion(a) {
    const c = this.c, o = c.getActiveObject();
    const req = () => { if (!o) { toast('Primero toca un elemento'); return false; } return true; };
    if (MARCOS[a]) {
      const m = this.marco(a, 0, 0); const ms = c.getObjects().filter(x => x.esMarco);
      if (ms.length) { const bs = ms.map(x => x.getBoundingRect(true, true)); m.set({ left: Math.max(...bs.map(b => b.left + b.width)) + 80, top: Math.min(...bs.map(b => b.top)) }); }
      else { const p = this.centroMundo(); m.set({ left: p.x - m.width / 2, top: p.y - m.height / 2 }); }
      m.setCoords(); c.add(m); c.sendToBack(m); c.setActiveObject(m); this.ajustarVista(m); toast('Marco ' + m.name + ' agregado'); return;
    }
    switch (a) {
      case 'rect': this.colocar(this.rect()); break;
      case 'texto': this.colocar(this.texto('Texto')); break;
      case 'boton': this.colocar(this.boton()); break;
      case 'undo': this.hist.ir(-1); break;
      case 'redo': this.hist.ir(1); break;
      case 'multi': this.multi = !this.multi; $('#lMulti').textContent = (this.multi ? '☑' : '☐') + ' Multi'; $('#lMulti').classList.toggle('activo', this.multi); this.selMulti = []; toast(this.multi ? 'Toca varios elementos para seleccionarlos' : 'Selección normal'); break;
      case 'borrar': if (req()) { (o.type === 'activeSelection' ? o.getObjects() : [o]).forEach(x => c.remove(x)); c.discardActiveObject(); c.requestRenderAll(); toast('Borrado · puedes Deshacer'); } break;
      case 'duplicar': if (req()) o.clone(cl => { cl.set({ left: o.left + 24, top: o.top + 24 }); if (cl.type === 'activeSelection') { cl.canvas = c; cl.forEachObject(x => c.add(x)); cl.setCoords(); } else c.add(cl); c.setActiveObject(cl); c.requestRenderAll(); }, PROPS); break;
      case 'adelante': if (req()) { c.bringForward(o); this.hist.push(); } break;
      case 'atras': if (req()) { c.sendBackwards(o); this.hist.push(); } break;
      case 'bloquear': if (req()) { const si = !o.fijo; o.set({ fijo: si, lockMovementX: si, lockMovementY: si, lockScalingX: si, lockScalingY: si, lockRotation: si, hasControls: !si }); this.hist.push(); toast(si ? 'Fijado' : 'Ya se puede mover'); } break;
      case 'agrupar': if (req()) { if (o.type !== 'activeSelection') { toast('Activa “Multi” y toca 2 o más elementos'); return; } const g = o.toGroup(); g.set({ name: 'Grupo' }); this.selMulti = []; c.requestRenderAll(); this.hist.push(); this.alSeleccionar(); toast('Agrupado'); } break;
      case 'desagrupar': if (req()) { if (o.type !== 'group') { toast('Eso no es un grupo'); return; } o.toActiveSelection(); c.requestRenderAll(); this.hist.push(); toast('Separado'); } break;
      case 'guardar-comp': if (req()) this.guardarComp(o); break;
      case 'zoom-mas': c.zoomToPoint({ x: c.width / 2, y: c.height / 2 }, this.limZoom(c.getZoom() * 1.25)); this.pintarZoom(); this.guardarVista(); break;
      case 'zoom-menos': c.zoomToPoint({ x: c.width / 2, y: c.height / 2 }, this.limZoom(c.getZoom() / 1.25)); this.pintarZoom(); this.guardarVista(); break;
      case 'ajustar': this.ajustarVista(); break;
      case 'png': this.exportarPNG(); break;
      case 'html': this.exportarHTML(false); break;
      case 'ver-html': this.exportarHTML(true); break;
      case 'nuevo': if (confirm('¿Empezar un lienzo nuevo? (Puedes volver con Deshacer)')) this.ejemplo(); break;
    }
  },
  alternarMulti(t) {
    const act = this.c.getActiveObject();
    if (act && act.type !== 'activeSelection' && !this.selMulti.includes(act)) this.selMulti = [act];
    const i = this.selMulti.indexOf(t); if (i >= 0 && this.selMulti.length > 1) this.selMulti.splice(i, 1); else if (i < 0) this.selMulti.push(t);
    setTimeout(() => {
      if (this.selMulti.length > 1) { this.c.discardActiveObject(); this.c.setActiveObject(new fabric.ActiveSelection(this.selMulti, { canvas: this.c })); }
      else this.c.setActiveObject(this.selMulti[0]);
      this.c.requestRenderAll(); this.alSeleccionar();
    }, 0);
  },
  ajustarVista(obj) {
    const objs = obj ? [obj] : this.c.getObjects(); if (!objs.length) { this.c.setViewportTransform([1, 0, 0, 1, 0, 0]); this.pintarZoom(); return; }
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    objs.forEach(o => { const b = o.getBoundingRect(true, true); x1 = Math.min(x1, b.left); y1 = Math.min(y1, b.top); x2 = Math.max(x2, b.left + b.width); y2 = Math.max(y2, b.top + b.height); });
    const pad = 30, z = this.limZoom(Math.min((this.c.width - pad * 2) / (x2 - x1), (this.c.height - pad * 2) / (y2 - y1)));
    this.c.setViewportTransform([z, 0, 0, z, (this.c.width - (x2 - x1) * z) / 2 - x1 * z, (this.c.height - (y2 - y1) * z) / 2 - y1 * z]);
    this.pintarZoom(); this.c.requestRenderAll(); this.guardarVista();
  },

  /* ---------- Propiedades ---------- */
  alSeleccionar() {
    const o = this.c.getActiveObject();
    $('#lSelNombre').textContent = o ? '· ' + (o.type === 'activeSelection' ? o.size() + ' elementos' : o.name || o.type) : '(nada seleccionado)';
    const txt = o && this.textoDe(o), base = o && this.baseDe(o);
    $$('#lProps .l-solo-texto').forEach(e => e.hidden = !txt);
    $$('#lProps .l-solo-rect').forEach(e => e.hidden = !(base && base.type === 'rect'));
    if (o) {
      $('#lNombre').value = o.name || '';
      if (txt) { $('#lTexto').value = txt.text; $('#lTam').value = txt.fontSize; }
      const f = base ? base.fill : txt && txt.fill; if (typeof f === 'string' && f.startsWith('#')) $('#lColor').value = f.slice(0, 7);
      if (base && typeof base.stroke === 'string' && base.stroke.startsWith('#')) $('#lBorde').value = base.stroke.slice(0, 7);
      if (base && base.type === 'rect') $('#lRadio').value = base.rx || 0;
    }
    const m = this.marcoActual(); if (m) this.ultimoMarco = m; $('#lMarcoSel').textContent = m ? '· ' + m.name : '';
  },
  textoDe(o) { if (o.type === 'textbox') return o; if (o.type === 'group') return o.getObjects().find(x => x.type === 'textbox'); return null; },
  baseDe(o) { if (o.type === 'group') return o.getObjects().find(x => x.type !== 'textbox'); if (o.type === 'textbox' || o.type === 'activeSelection') return null; return o; },
  conectarProps() {
    const con = fn => () => { const o = this.c.getActiveObject(); if (!o) return; fn(o); if (o.type === 'group') o.addWithUpdate(); o.setCoords(); this.c.requestRenderAll(); this.hist.push(); };
    $('#lNombre').oninput = con(o => o.set('name', $('#lNombre').value));
    $('#lTexto').oninput = con(o => { const t = this.textoDe(o); if (t) t.set('text', $('#lTexto').value); });
    $('#lTam').oninput = con(o => { const t = this.textoDe(o); if (t) t.set('fontSize', +$('#lTam').value); });
    $('#lColor').oninput = con(o => { const b = this.baseDe(o); if (b) b.set('fill', $('#lColor').value); else { const t = this.textoDe(o); if (t) t.set('fill', $('#lColor').value); } });
    $('#lBorde').oninput = con(o => { const b = this.baseDe(o); if (b) { b.set('stroke', $('#lBorde').value); if (!b.strokeWidth) b.set('strokeWidth', 2); } });
    $('#lRadio').oninput = con(o => { const b = this.baseDe(o); if (b && b.type === 'rect') b.set({ rx: +$('#lRadio').value, ry: +$('#lRadio').value }); });
  },

  /* ---------- Componentes reutilizables ---------- */
  pintarComps() {
    const cont = $('#lComps'); cont.innerHTML = '';
    const pre = this.predefinidos();
    Object.keys(pre).forEach(n => { const b = document.createElement('button'); b.textContent = n; b.onclick = () => this.colocar(pre[n]()); cont.appendChild(b); });
    this.comps.forEach((cp, i) => {
      const b = document.createElement('button'); b.textContent = '⭐ ' + cp.nombre; b.className = 'mio';
      b.onclick = () => fabric.util.enlivenObjects([cp.json], ([o]) => { o.set({ name: cp.nombre }); this.colocar(o); });
      let t; b.addEventListener('touchstart', () => { t = setTimeout(() => this.borrarComp(i), 700); }, { passive: true });
      b.addEventListener('touchend', () => clearTimeout(t)); b.addEventListener('contextmenu', e => { e.preventDefault(); this.borrarComp(i); });
      cont.appendChild(b);
    });
  },
  guardarComp(o) {
    const nombre = prompt('Nombre del componente:', o.name || 'Mi componente'); if (!nombre) return;
    const objeto = o.type === 'activeSelection' ? (o.toGroup(), this.c.getActiveObject()) : o;
    const json = objeto.toObject(PROPS); json.left = 0; json.top = 0;
    this.comps.push({ nombre, json }); DB.set('comps', this.comps); this.pintarComps(); toast('Componente guardado ⭐');
  },
  borrarComp(i) { if (!confirm('¿Borrar el componente “' + this.comps[i].nombre + '”?')) return; this.comps.splice(i, 1); DB.set('comps', this.comps); this.pintarComps(); },

  /* ---------- Exportar ---------- */
  exportarPNG() {
    const m = this.marcoActual(); if (!m) { toast('Agrega un marco primero'); return; }
    this.c.discardActiveObject(); this.c.renderAll();
    const v = this.c.viewportTransform, z = v[0], b = { left: m.left, top: m.top, width: m.width * m.scaleX, height: m.height * m.scaleY };
    const el = this.c.toCanvasElement(2 / z, { left: b.left * z + v[4], top: b.top * z + v[5], width: b.width * z, height: b.height * z });
    const W2 = Math.round(b.width * 2), H2 = Math.round(b.height * 2);
    const f = document.createElement('canvas'); f.width = W2; f.height = H2; f.getContext('2d').drawImage(el, 0, 0, W2, H2);
    f.toBlob(bl => { descargar(bl, `${m.name}-maqueta.png`); toast('PNG del marco descargado ✅'); }, 'image/png');
  },
  htmlDeMarco(m) {
    const fx = m.left, fy = m.top, W = Math.round(m.width * m.scaleX), H = Math.round(m.height * m.scaleY);
    const col = c => (typeof c === 'string' && c ? c : 'transparent');
    const px = n => Math.round(n * 10) / 10 + 'px';
    const caja = (o, extra = '') => {
      const d = fabric.util.qrDecompose(o.calcTransformMatrix());
      const w = o.width * Math.abs(d.scaleX), h = o.height * Math.abs(d.scaleY);
      return `position:absolute;left:${px(d.translateX - w / 2 - fx)};top:${px(d.translateY - h / 2 - fy)};width:${px(w)};height:${px(h)};${d.angle ? `transform:rotate(${Math.round(d.angle)}deg);` : ''}${o.opacity < 1 ? `opacity:${o.opacity};` : ''}${extra}`;
    };
    const sombra = o => o.shadow ? `box-shadow:${o.shadow.offsetX}px ${o.shadow.offsetY}px ${o.shadow.blur}px ${o.shadow.color};` : '';
    const borde = o => o.stroke && o.strokeWidth ? `border:${o.strokeWidth}px solid ${o.stroke};box-sizing:border-box;` : '';
    const estTexto = t => `font-family:'${t.fontFamily}',sans-serif;font-size:${px(t.fontSize * Math.abs(fabric.util.qrDecompose(t.calcTransformMatrix()).scaleY))};font-weight:${t.fontWeight};font-style:${t.fontStyle};color:${col(t.fill)};text-align:${t.textAlign};line-height:${t.lineHeight};`;
    const uno = o => {
      if (o.type === 'group' && o.ctype === 'boton') {
        const r = o.getObjects().find(x => x.type === 'rect'), t = o.getObjects().find(x => x.type === 'textbox');
        return `<button style="${caja(o, `background:${col(r && r.fill)};border-radius:${px(r ? r.rx : 0)};${r ? borde(r) : 'border:0;'}${t ? estTexto(t) : ''}cursor:pointer;border:0;`)}">${escaparHTML(t ? t.text : 'Botón')}</button>`;
      }
      if (o.type === 'group') return o.getObjects().map(uno).join('\n');
      if (o.type === 'rect') return `<div style="${caja(o, `background:${col(o.fill)};border-radius:${px(o.rx || 0)};${borde(o)}${sombra(o)}`)}"></div>`;
      if (o.type === 'circle' || o.type === 'ellipse') return `<div style="${caja(o, `background:${col(o.fill)};border-radius:50%;${borde(o)}`)}"></div>`;
      if (o.type === 'textbox' || o.type === 'i-text' || o.type === 'text') return `<div style="${caja(o, estTexto(o) + 'white-space:pre-wrap;margin:0;')}">${escaparHTML(o.text)}</div>`;
      if (o.type === 'image') return `<img alt="" src="${o.getSrc()}" style="${caja(o, 'object-fit:cover;')}">`;
      return `<div style="${caja(o, `background:${col(o.fill)};`)}"></div>`;
    };
    const objs = this.hijosDe(m);
    const fuentes = [...new Set(objs.flatMap(o => (o.type === 'group' ? o.getObjects() : [o]).filter(x => x.fontFamily).map(x => x.fontFamily)))].filter(f => !['Arial', 'Georgia'].includes(f));
    return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escaparHTML(m.name)} · Craft Web</title>
${fuentes.length ? `<link href="https://fonts.googleapis.com/css2?${fuentes.map(f => 'family=' + f.replace(/ /g, '+') + ':wght@400;600;700;800').join('&')}&display=swap" rel="stylesheet">` : ''}
<style>
html,body{margin:0;background:#e5e7eb;min-height:100vh}
.marco{position:relative;width:${W}px;height:${H}px;margin:0 auto;background:${col(m.fill)};overflow:hidden;transform-origin:top left}
</style>
</head>
<body>
<div class="marco" id="marco">
${objs.map(uno).join('\n')}
</div>
<script>
// Escala el marco para que quepa en la pantalla
function ajustar(){var m=document.getElementById('marco');var k=Math.min(1,window.innerWidth/${W});m.style.transform='scale('+k+')';m.style.marginLeft=k<1?'0':'auto';document.body.style.height=(${H}*k)+'px';}
addEventListener('resize',ajustar);ajustar();
</script>
</body>
</html>`;
  },
  exportarHTML(ver) {
    const m = this.marcoActual(); if (!m) { toast('Agrega un marco primero'); return; }
    const html = this.htmlDeMarco(m); const blob = new Blob([html], { type: 'text/html' });
    if (ver) { window.open(URL.createObjectURL(blob), '_blank'); return; }
    descargar(blob, `${m.name.toLowerCase()}-maqueta.html`); toast('HTML del marco descargado ✅');
  },
};
