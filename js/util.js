/* Utilidades, base de datos local, cuenta Puter y sincronización */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esperar = ms => new Promise(r => setTimeout(r, ms));
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('ver');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('ver'), ms);
}
function descargar(data, nombre) {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const a = document.createElement('a'); a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const blobADataURL = b => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = mal; r.readAsDataURL(b); });
async function dataURLABlob(u) { return (await fetch(u)).blob(); }
function cargarImg(src) {
  return new Promise((ok, mal) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => mal(new Error('No cargó la imagen')); i.src = src; });
}
/* Reduce fotos grandes de la galería para no llenar la memoria */
async function archivoADataURL(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await cargarImg(url);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
  } finally { URL.revokeObjectURL(url); }
}
function escaparHTML(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function debounce(fn, ms) { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------- IndexedDB: store kv (datos) + meta (fecha de cambio para sincronizar) ---------- */
const DB = {
  _db: null,
  abrir() {
    if (this._db) return this._db;
    this._db = new Promise((ok, mal) => {
      const r = indexedDB.open('craftweb', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('meta'); };
      r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
    });
    return this._db;
  },
  async _tx(store, modo, fn) {
    const db = await this.abrir();
    return new Promise((ok, mal) => {
      const tx = db.transaction(store, modo); const st = tx.objectStore(store);
      const req = fn(st); tx.oncomplete = () => ok(req && req.result); tx.onerror = () => mal(tx.error);
    });
  },
  get(k) { return this._tx('kv', 'readonly', s => s.get(k)); },
  async set(k, v, { sync = true, t = Date.now() } = {}) {
    await this._tx('kv', 'readwrite', s => s.put(v, k));
    await this._tx('meta', 'readwrite', s => s.put({ t }, k));
    if (sync) Sync.marcar();
  },
  async del(k, { sync = true, t = Date.now() } = {}) {
    await this._tx('kv', 'readwrite', s => s.delete(k));
    await this._tx('meta', 'readwrite', s => s.put({ t, del: true }, k));
    if (sync) Sync.marcar();
  },
  async llaves(prefijo = '') { const ks = await this._tx('kv', 'readonly', s => s.getAllKeys()); return ks.filter(k => String(k).startsWith(prefijo)); },
  async metas() {
    const db = await this.abrir();
    return new Promise((ok, mal) => {
      const out = {}; const tx = db.transaction('meta'); const c = tx.objectStore('meta').openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } else ok(out); };
      tx.onerror = () => mal(tx.error);
    });
  },
};

/* ---------- Cuenta con correo (Puter: gratis, una cuenta por usuario) ---------- */
const Cuenta = {
  dentro: false, usuario: null,
  hay() { return typeof window.puter !== 'undefined' && puter.auth; },
  async iniciar() {
    if (!this.hay()) { this.pintar(); return; }
    try {
      this.dentro = !!(await puter.auth.isSignedIn());
      if (this.dentro) this.usuario = await puter.auth.getUser();
    } catch (e) { this.dentro = false; }
    this.pintar();
    if (this.dentro) Sync.ahora();
  },
  nombre() { const u = this.usuario || {}; return u.email || u.username || 'tu cuenta'; },
  async entrar() {
    if (!this.hay()) { toast('No cargó el servicio de cuentas. Revisa tu internet.'); return; }
    try {
      await puter.auth.signIn();
      this.dentro = !!(await puter.auth.isSignedIn());
      if (this.dentro) { this.usuario = await puter.auth.getUser(); toast('¡Listo! Ya entraste como ' + this.nombre()); }
    } catch (e) { toast('No se completó el inicio de sesión'); }
    this.pintar();
    if (this.dentro) Sync.ahora();
  },
  async salir() {
    try { if (this.hay()) await puter.auth.signOut(); } catch (e) {}
    this.dentro = false; this.usuario = null; this.pintar(); toast('Sesión cerrada. Lo tuyo sigue en este teléfono.');
  },
  pintar() {
    const b = $('#btnCuenta'); const t = $('#ajCuentaTxt');
    if (this.dentro) {
      b.textContent = '☁ ' + this.nombre(); b.classList.add('dentro');
      t.textContent = 'Conectado como ' + this.nombre() + '. ' + (Sync.ultima ? 'Última sincronización: ' + Sync.ultima.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Sincronizando…');
    } else {
      b.textContent = '☁ Entrar con correo'; b.classList.remove('dentro');
      t.textContent = 'Sin cuenta: todo se guarda en este teléfono. Entra para respaldarlo en la nube.';
    }
    $('#ajEntrar').hidden = this.dentro; $('#ajSalir').hidden = !this.dentro; $('#ajSync').hidden = !this.dentro;
    document.dispatchEvent(new CustomEvent('cuenta'));
  },
};

/* ---------- Sincronización IndexedDB <-> puter.fs (último cambio gana) ---------- */
const Sync = {
  dir: 'craftweb', ultima: null, _corriendo: null, _otra: false,
  marcar: debounce(() => Sync.ahora(), 3000),
  ruta(k) { return this.dir + '/d/' + encodeURIComponent(k).replace(/%/g, '_') + '.json'; },
  async serializar(v) {
    if (v instanceof Blob) return JSON.stringify({ __blob: await blobADataURL(v) });
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = x instanceof Blob ? { __blob: await blobADataURL(x) } : x;
      return JSON.stringify({ __obj: o });
    }
    return JSON.stringify({ __v: v });
  },
  async deserializar(txt) {
    const j = JSON.parse(txt);
    if (j.__blob) return dataURLABlob(j.__blob);
    if (j.__obj) { const o = {}; for (const [k, x] of Object.entries(j.__obj)) o[k] = x && x.__blob ? await dataURLABlob(x.__blob) : x; return o; }
    return j.__v;
  },
  async leerTxt(ruta) { const b = await puter.fs.read(ruta); return typeof b === 'string' ? b : await b.text(); },
  async ahora() {
    if (!Cuenta.dentro) return;
    if (this._corriendo) { this._otra = true; return this._corriendo; }
    this._corriendo = this._sync().catch(e => { console.warn('sync', e); }).finally(() => {
      this._corriendo = null; if (this._otra) { this._otra = false; this.ahora(); }
    });
    return this._corriendo;
  },
  async _sync() {
    let nube = {};
    try { nube = JSON.parse(await this.leerTxt(this.dir + '/indice.json')); } catch (e) { nube = {}; }
    const local = await DB.metas(); const traidos = [];
    let cambioNube = false;
    for (const k of new Set([...Object.keys(nube), ...Object.keys(local)])) {
      const n = nube[k] || { t: 0 }, l = local[k] || { t: 0 };
      if (n.t > l.t) {
        if (n.del) await DB.del(k, { sync: false, t: n.t });
        else await DB.set(k, await this.deserializar(await this.leerTxt(this.ruta(k))), { sync: false, t: n.t });
        traidos.push(k);
      } else if (l.t > n.t) {
        if (l.del) { try { await puter.fs.delete(this.ruta(k)); } catch (e) {} nube[k] = { t: l.t, del: true }; }
        else { const v = await DB.get(k); if (v === undefined) continue; await puter.fs.write(this.ruta(k), await this.serializar(v), { createMissingParents: true, overwrite: true }); nube[k] = { t: l.t }; }
        cambioNube = true;
      }
    }
    if (cambioNube) await puter.fs.write(this.dir + '/indice.json', JSON.stringify(nube), { createMissingParents: true, overwrite: true });
    this.ultima = new Date(); Cuenta.pintar();
    if (traidos.length) document.dispatchEvent(new CustomEvent('sync-traidos', { detail: traidos }));
  },
};

/* Historial deshacer/rehacer genérico */
class Historial {
  constructor(leer, aplicar, alGuardar) { this.leer = leer; this.aplicar = aplicar; this.alGuardar = alGuardar; this.pila = []; this.i = -1; this.bloq = false; this.t = null; }
  reiniciar() { this.pila = [this.leer()]; this.i = 0; }
  push(ms = 250) {
    if (this.bloq) return;
    if (this.t && ms === 0) { clearTimeout(this.t); this._guardarYa(); }
    clearTimeout(this.t);
    this.t = setTimeout(() => this._guardarYa(), ms);
  }
  _guardarYa() {
    this.t = null;
    {
      if (this.bloq) return;
      const s = this.leer(); if (s === this.pila[this.i]) return;
      this.pila = this.pila.slice(0, this.i + 1); this.pila.push(s);
      if (this.pila.length > 60) this.pila.shift();
      this.i = this.pila.length - 1; this.alGuardar(s);
    }
  }
  ir(d) {
    if (this.t) { clearTimeout(this.t); this._guardarYa(); }
    const j = this.i + d; if (j < 0 || j >= this.pila.length) { toast(d < 0 ? 'Nada que deshacer' : 'Nada que rehacer'); return; }
    this.i = j; this.bloq = true;
    this.aplicar(this.pila[j], () => { this.bloq = false; this.alGuardar(this.pila[j]); });
  }
}

/* Chips de progreso: muestra cada IA trabajando (⏳), lista (✓) o con falla (✕) */
function pintarProgreso(cont, provs, res, ganador) {
  if (!cont) return;
  cont.hidden = false;
  cont.innerHTML = provs.map(p => {
    const r = res.find(x => x.id === p.id);
    const cls = !r ? 'trab' : r.ok ? 'ok' : 'err';
    const ico = !r ? '<span class="giro"></span>' : r.ok ? '✓' : '✕';
    const tit = r && !r.ok ? ` title="${escaparHTML((r.error || r.info || '').slice(0, 120))}"` : '';
    return `<span class="pchip ${cls}${ganador === p.id ? ' gana' : ''}"${tit}>${ico} ${escaparHTML(p.nombre)}${r && r.ms ? ` <small>${(r.ms / 1000).toFixed(0)}s</small>` : ''}</span>`;
  }).join('');
}
