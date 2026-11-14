/* Pestaña IA: genera imágenes gratis con varias IA a la vez y muestra solo la mejor */
const ESTILOS = [
  ['Ninguno', ''], ['Foto real', 'ultra realistic photo, natural light, 50mm, high detail'], ['Anime', 'anime style illustration, vibrant colors, clean lineart'],
  ['3D caricatura', '3d cartoon render, soft lighting, cute, high quality'], ['Acuarela', 'watercolor painting, soft paper texture'], ['Óleo', 'oil painting, visible brush strokes, classic'],
  ['Cómic', 'comic book style, bold ink outlines, halftone'], ['Neón', 'cyberpunk neon lights, night, glowing, cinematic'], ['Minimalista', 'flat minimal vector illustration, simple shapes, pastel colors'],
  ['Logo', 'minimal modern logo, vector, centered, plain background'], ['Póster', 'graphic design poster, bold composition, striking'], ['Pixel art', 'pixel art, 16-bit retro game style'],
];
const TAMANOS = [['Cuadrado', 1024, 1024], ['Post 4:5', 864, 1080], ['Historia 9:16', 720, 1280], ['Horizontal', 1280, 720]];
const IDEAS_IA = ['Un taco gigante flotando en el espacio', 'Logo de cafetería con un gato', 'Atardecer en Acapulco estilo póster', 'Fondo de tienda de ropa elegante', 'Un robot mariachi tocando guitarra'];

const IA = {
  estilo: 0, tam: 0, actual: null, cands: [], idx: 0, ocupado: false,
  iniciar() {
    $('#iaEstilos').innerHTML = ESTILOS.map((e, i) => `<button data-e="${i}" class="${i === 0 ? 'activo' : ''}">${e[0]}</button>`).join('');
    $('#iaTamanos').innerHTML = TAMANOS.map((t, i) => `<button data-t="${i}" class="${i === 0 ? 'activo' : ''}">${t[0]}</button>`).join('');
    $('#iaIdeas').innerHTML = IDEAS_IA.map(t => `<button>${t}</button>`).join('');
    $$('#iaIdeas button').forEach(b => b.onclick = () => { $('#iaPrompt').value = b.textContent; $('#iaPrompt').focus(); });
    $$('#iaEstilos button').forEach(b => b.onclick = () => { this.estilo = +b.dataset.e; $$('#iaEstilos button').forEach(x => x.classList.toggle('activo', x === b)); });
    $$('#iaTamanos button').forEach(b => b.onclick = () => { this.tam = +b.dataset.t; $$('#iaTamanos button').forEach(x => x.classList.toggle('activo', x === b)); });
    $('#iaGenerar').onclick = () => this.generar();
    $('#iaOtra').onclick = () => this.otra();
    $('#iaUsarD').onclick = () => this.actual && this.usarEn('diseno', this.actual.blob);
    $('#iaUsarL').onclick = () => this.actual && this.usarEn('lienzo', this.actual.blob);
    $('#iaBajar').onclick = () => this.actual && descargar(this.actual.blob, 'imagen-ia.jpg');
    $('#vCerrar').onclick = () => { $('#visor').hidden = true; };
    $('#visor').addEventListener('click', e => { if (e.target.id === 'visor') $('#visor').hidden = true; });
    this.pintarGaleria();
  },
  estado(t, cls = '') { const e = $('#iaEstado'); e.textContent = t; e.className = 'estado ' + cls; },

  async generar(promptForzado) {
    if (this.ocupado) return;
    const p = (promptForzado || $('#iaPrompt').value).trim();
    if (!p) { toast('Escribe qué imagen quieres'); $('#iaPrompt').focus(); return; }
    if (!navigator.onLine) { this.estado('📡 Sin internet. La IA necesita conexión; tus diseños sí funcionan sin ella.', 'err'); return; }
    const [, w, h] = TAMANOS[this.tam]; const est = ESTILOS[this.estilo];
    const full = est[1] ? `${p}, ${est[1]}` : p;
    const seed = $('#iaSeed').value ? +$('#iaSeed').value : Math.floor(Math.random() * 1e9);
    this.ocupado = true; const btn = $('#iaGenerar'); btn.disabled = true; btn.textContent = '⏳ Generando…'; btn.classList.add('cargando');
    $('#iaResultado').hidden = true; $('#iaEsqueleto').hidden = false; $('#iaEsqueleto').style.aspectRatio = `${w}/${h}`;
    const t0 = Date.now(); let n = 0;
    const reloj = setInterval(() => this.estado(`Generando con ${n || 'varias'} IA a la vez… ${Math.round((Date.now() - t0) / 1000)} s`), 500);
    try {
      const r = await AI.imagenes(full, w, h, seed, $('#iaMejorar').checked, { onProgreso: (res, provs) => { n = provs.length; pintarProgreso($('#iaProgreso'), provs, res); } });
      clearInterval(reloj);
      if (!r.orden.length) {
        const f = r.fallas[0];
        const lim = f && /HTTP (402|429)/.test(f.error);
        this.estado(lim ? `${f.nombre} llegó a su límite gratis por ahora. Espera 1–2 minutos y vuelve a intentar` + (Cuenta.dentro ? '.' : ', o entra con tu correo para usar también Puter.')
          : 'No se pudo generar la imagen' + (f ? ` (${f.nombre}: ${String(f.error).slice(0, 60)})` : '') + '. Espera unos segundos y vuelve a intentar.', 'err');
        return;
      }
      this.cands = r.orden; this.idx = 0;
      const g = this.cands[0];
      pintarProgreso($('#iaProgreso'), AI.provImagen().filter(x => x.disponible()), [...r.orden, ...r.fallas], g.id);
      const id = 'gal:' + uid();
      await DB.set(id, { blob: g.blob, prompt: p, estilo: est[0], w: g.w, h: g.h, seed, prov: g.nombre, fecha: Date.now() });
      this.actual = { id, blob: g.blob };
      this.mostrar(g, r.juez);
      this.estado(`✅ Lista en ${Math.round((Date.now() - t0) / 1000)} s. Probé ${r.orden.length + r.fallas.length} opciones y te dejo la mejor.`, 'ok');
      this.pintarGaleria();
    } catch (e) { clearInterval(reloj); this.estado('Algo falló: ' + e.message, 'err'); }
    finally { this.ocupado = false; btn.disabled = false; btn.textContent = '✨ Generar gratis'; btn.classList.remove('cargando'); $('#iaEsqueleto').hidden = true; }
  },
  mostrar(g, juez) {
    $('#iaResultado').hidden = false; $('#iaGanadora').src = g.url;
    $('#iaGano').textContent = `Ganó: ${g.nombre}${juez ? ' · eligió ' + juez : ''}`;
    $('#iaOtra').hidden = this.cands.length < 2;
    $('#iaOtra').textContent = `ver otra (${this.idx + 1}/${this.cands.length}) ›`;
  },
  async otra() {
    if (this.cands.length < 2) return;
    this.idx = (this.idx + 1) % this.cands.length; const g = this.cands[this.idx];
    const v = await DB.get(this.actual.id);
    if (v) { v.blob = g.blob; v.prov = g.nombre; v.w = g.w; v.h = g.h; await DB.set(this.actual.id, v); }
    this.actual.blob = g.blob; this.mostrar(g, null); $('#iaGano').textContent = `Opción ${this.idx + 1}: ${g.nombre}`; this.pintarGaleria();
  },
  async usarEn(tab, blob) {
    const url = await blobADataURL(blob);
    $('#visor').hidden = true;
    App.ir(tab);
    if (tab === 'diseno') await Diseno.agregarImagen(url, 'Imagen IA'); else await Lienzo.agregarImagen(url, 'Imagen IA');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  async pintarGaleria() {
    const ks = await DB.llaves('gal:');
    const items = []; for (const k of ks) { const v = await DB.get(k); if (v && v.blob) items.push([k, v]); }
    items.sort((a, b) => b[1].fecha - a[1].fecha);
    $('#iaCuenta').textContent = items.length ? `(${items.length})` : '';
    const g = $('#iaGaleria'); (this._urls || []).forEach(u => URL.revokeObjectURL(u)); this._urls = [];
    g.innerHTML = items.length ? '' : '<div class="vacio"><b>Tu galería está vacía</b>Las imágenes que generes se guardan aquí solitas.</div>';
    items.forEach(([k, v]) => {
      const u = URL.createObjectURL(v.blob); this._urls.push(u);
      const im = document.createElement('img'); im.src = u; im.alt = v.prompt; im.loading = 'lazy';
      im.onclick = () => this.abrir(k, v, u); g.appendChild(im);
    });
  },
  abrir(k, v, u) {
    $('#visorImg').src = u; $('#visorTxt').textContent = `${v.prompt} · ${v.estilo} · ${v.w}×${v.h}${v.prov ? ' · ' + v.prov : ''}`;
    $('#visor').hidden = false;
    $('#vDiseno').onclick = () => this.usarEn('diseno', v.blob);
    $('#vLienzo').onclick = () => this.usarEn('lienzo', v.blob);
    $('#vDescargar').onclick = () => descargar(v.blob, `ia-${k.slice(4)}.${(v.blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`);
    $('#vOtra').onclick = () => { $('#visor').hidden = true; $('#iaPrompt').value = v.prompt; $('#iaSeed').value = ''; App.ir('ia'); window.scrollTo(0, 0); this.generar(); };
    $('#vBorrar').onclick = async () => { if (!confirm('¿Borrar esta imagen?')) return; await DB.del(k); $('#visor').hidden = true; this.pintarGaleria(); toast('Imagen borrada'); };
  },
};
