import assert from 'node:assert/strict';

// Configuración de un DOM ligero en Node.js para probar los módulos ES del frontend
class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this._innerHTML = '';
    this.textContent = '';
    this.parentElement = null;
    this.elements = {};
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = val;
    this.children = [];
    // Parse tags and class/id attributes simply
    const tagRegex = /<([a-z0-9]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-z0-9]+)([^>]*)\/?>/gi;
    let match;
    while ((match = tagRegex.exec(val)) !== null) {
      const tagName = match[1] || match[4];
      const attrsStr = match[2] || match[5] || '';
      const inner = match[3] || '';
      const child = new MockElement(tagName);
      const classMatch = attrsStr.match(/class=["']([^"']+)["']/i);
      if (classMatch) child.className = classMatch[1];
      const idMatch = attrsStr.match(/id=["']([^"']+)["']/i);
      if (idMatch) child.id = idMatch[1];
      const nameMatch = attrsStr.match(/name=["']([^"']+)["']/i);
      if (nameMatch) {
        child.name = nameMatch[1];
        this.elements[nameMatch[1]] = child;
      }
      if (inner) child.innerHTML = inner;
      this.children.push(child);
      child.parentElement = this;
    }
    const nameMatches = [...val.matchAll(/name=["']([^"']+)["']/g)];
    for (const m of nameMatches) {
      if (!this.elements[m[1]]) {
        this.elements[m[1]] = new MockElement('input');
        this.elements[m[1]].name = m[1];
      }
    }
  }

  add(opt) {
    this.children.push(opt);
  }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }

  append(...nodes) {
    for (const n of nodes) {
      if (typeof n === 'string') {
        const textNode = new MockElement('#text');
        textNode.textContent = n;
        this.children.push(textNode);
      } else {
        n.parentElement = this;
        this.children.push(n);
      }
    }
  }

  prepend(...nodes) {
    for (const n of nodes.reverse()) {
      if (typeof n === 'string') {
        const textNode = new MockElement('#text');
        textNode.textContent = n;
        this.children.unshift(textNode);
      } else {
        n.parentElement = this;
        this.children.unshift(n);
      }
    }
  }

  before(...nodes) {
    if (!this.parentElement) return;
    const idx = this.parentElement.children.indexOf(this);
    if (idx !== -1) {
      this.parentElement.children.splice(idx, 0, ...nodes);
    }
  }

  insertAdjacentHTML(pos, html) {
    this._innerHTML = (this._innerHTML || '') + html;
  }

  querySelector(sel) {
    if (sel.includes(' ')) {
      const parts = sel.split(/\s+/);
      let curr = this;
      for (const p of parts) {
        curr = curr.querySelector(p);
        if (!curr) return null;
      }
      return curr;
    }
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return this._find(el => el.className && el.className.split(' ').includes(cls));
    }
    if (sel.startsWith('#')) {
      const id = sel.slice(1);
      return this._find(el => el.id === id);
    }
    return this._find(el => el.tagName.toLowerCase() === sel.toLowerCase());
  }

  querySelectorAll(sel) {
    const res = [];
    this._findAll(el => {
      if (sel.startsWith('.')) return el.className && el.className.split(' ').includes(sel.slice(1));
      if (sel.startsWith('#')) return el.id === sel.slice(1);
      return el.tagName.toLowerCase() === sel.toLowerCase();
    }, res);
    return res;
  }

  _find(pred) {
    for (const c of this.children) {
      if (pred(c)) return c;
      const sub = c._find?.(pred);
      if (sub) return sub;
    }
    return null;
  }

  _findAll(pred, acc) {
    for (const c of this.children) {
      if (pred(c)) acc.push(c);
      c._findAll?.(pred, acc);
    }
  }
}

globalThis.Option = class Option {
  constructor(text, value) {
    this.text = text;
    this.value = value;
  }
};

globalThis.document = {
  createElement(tag) { return new MockElement(tag); }
};

console.log('--- Probando frontend/expediente.js ---');
const { crearExpediente } = await import('../frontend/expediente.js');

const mockPaciente = { id: '1', nombres: 'Mateo', apellidos: 'Gómez' };

// 1. Verificar secciones en Pediatría
const raizPed = new MockElement('div');
const expPed = crearExpediente(raizPed, mockPaciente, 'pediatria', 'historial');
assert.ok(expPed.secciones.historial, 'Pediatría debe tener sección historial');
assert.ok(expPed.secciones.atencion, 'Pediatría debe tener sección atencion');
assert.ok(expPed.secciones.datos, 'Pediatría DEBE tener sección datos');
console.log('Pediatría: secciones historial, atencion y datos presentes.');

// 2. Verificar secciones en Odontología
const raizOdo = new MockElement('div');
const expOdo = crearExpediente(raizOdo, mockPaciente, 'odontologia', 'historial');
assert.ok(expOdo.secciones.historial, 'Odontología debe tener sección historial');
assert.ok(expOdo.secciones.atencion, 'Odontología debe tener sección atencion');
assert.ok(expOdo.secciones.datos, 'Odontología DEBE tener sección datos');
console.log('Odontología: secciones historial, atencion y datos presentes.');

console.log('\n--- Probando frontend/datos-paciente.js ---');
const { mostrarDatos, mostrarSecretaria } = await import('../frontend/datos-paciente.js');

let llamadasApi = [];
const apiMock = {
  async datosPaciente(id) {
    llamadasApi.push(['datosPaciente', id]);
    return {
      id,
      nombres: 'Prueba',
      apellidos: 'Paciente',
      fecha_nacimiento: '2020-01-01',
      telefono: '5551234',
      estado: 'activo'
    };
  },
  async citasPaciente(id) {
    llamadasApi.push(['citasPaciente', id]);
    return [];
  },
  async medicos() {
    llamadasApi.push(['medicos']);
    return [{ id: '1', nombres: 'Dr. Test', apellidos: 'Doc' }];
  },
  async editarPaciente(id, datos) {
    llamadasApi.push(['editarPaciente', id, datos]);
  },
  async archivarPaciente(id, datos) {
    llamadasApi.push(['archivarPaciente', id, datos]);
  }
};

const atenderMock = (form, handler) => {
  form.submitHandler = handler;
};

// 3. Verificar mostrarSecretaria en Pediatría
llamadasApi = [];
const raizSecPed = new MockElement('div');
await mostrarSecretaria(raizSecPed, '1', apiMock, atenderMock, () => {}, 'pediatria');

assert.ok(raizSecPed.innerHTML.includes('Gestión administrativa'), 'Debe mostrar texto administrativo');
assert.ok(!raizSecPed.innerHTML.includes('agenda-secretaria'), 'NO debe incluir agenda-secretaria en Pediatría');
assert.ok(!llamadasApi.some(c => c[0] === 'citasPaciente'), 'NO debe solicitar citasPaciente en Pediatría');
console.log('Secretaría Pediatría: solo gestión administrativa, sin llamadas a agenda.');

// 4. Verificar mostrarSecretaria en Odontología
llamadasApi = [];
const raizSecOdo = new MockElement('div');
await mostrarSecretaria(raizSecOdo, 'ODO-001', apiMock, atenderMock, () => {}, 'odontologia');

assert.ok(raizSecOdo.innerHTML.includes('Gestión administrativa'), 'Debe mostrar texto administrativo');
assert.ok(!raizSecOdo.innerHTML.includes('agenda-secretaria'), 'NO debe incluir agenda-secretaria en Odontología');
assert.ok(!llamadasApi.some(c => c[0] === 'citasPaciente'), 'NO debe solicitar citasPaciente en Odontología');
console.log('Secretaría Odontología: solo gestión administrativa, sin llamadas a agenda.');

// 5. Verificar mostrarSecretaria en Hospital (Regresión)
llamadasApi = [];
const raizSecHosp = new MockElement('div');
await mostrarSecretaria(raizSecHosp, '1', apiMock, atenderMock, () => {}, 'hospital');

assert.ok(raizSecHosp.innerHTML.includes('agenda-secretaria'), 'Hospital SÍ debe incluir agenda-secretaria');
assert.ok(llamadasApi.some(c => c[0] === 'citasPaciente'), 'Hospital SÍ debe solicitar citasPaciente');
assert.ok(llamadasApi.some(c => c[0] === 'medicos'), 'Hospital SÍ debe solicitar medicos');
console.log('Secretaría Hospital: conserva agenda de citas y médicos (no regresión).');

// 6. Verificar mensajes de confirmación de archivo por institución
let mensajePromptRecibido = null;
globalThis.confirm = (msg) => {
  mensajePromptRecibido = msg;
  return true;
};

const panelDatosPed = new MockElement('div');
await mostrarDatos(panelDatosPed, '1', apiMock, atenderMock, () => {}, 'pediatria');
const formArchivoPed = panelDatosPed.querySelector('.archivo');
assert.ok(formArchivoPed, 'Debe existir form de archivo para paciente activo');
await formArchivoPed.submitHandler({ motivo: 'Prueba de baja' });
assert.equal(mensajePromptRecibido, '¿Archivar el expediente de Pediatría conservando sus controles y vacunas?');
console.log('Confirmación Pediatría:', mensajePromptRecibido);

const panelDatosOdo = new MockElement('div');
await mostrarDatos(panelDatosOdo, 'ODO-001', apiMock, atenderMock, () => {}, 'odontologia');
const formArchivoOdo = panelDatosOdo.querySelector('.archivo');
await formArchivoOdo.submitHandler({ motivo: 'Prueba de baja' });
assert.equal(mensajePromptRecibido, '¿Archivar el expediente de Odontología conservando su historial y tratamientos?');
console.log('Confirmación Odontología:', mensajePromptRecibido);

const panelDatosHosp = new MockElement('div');
await mostrarDatos(panelDatosHosp, '1', apiMock, atenderMock, () => {}, 'hospital');
const formArchivoHosp = panelDatosHosp.querySelector('.archivo');
await formArchivoHosp.submitHandler({ motivo: 'Prueba de baja' });
assert.equal(mensajePromptRecibido, '¿Archivar el expediente y cancelar sus citas pendientes?');
console.log('Confirmación Hospital:', mensajePromptRecibido);

const panelDatosLab = new MockElement('div');
await mostrarDatos(panelDatosLab, 'PAC-001', apiMock, atenderMock, () => {}, 'laboratorio');
const formArchivoLab = panelDatosLab.querySelector('.archivo');
await formArchivoLab.submitHandler({ motivo: 'Prueba de baja' });
assert.equal(mensajePromptRecibido, '¿Archivar el expediente del Laboratorio conservando sus resultados?');
console.log('Confirmación Laboratorio:', mensajePromptRecibido);

console.log('\n>>> Todas las pruebas de componentes frontend pasaron exitosamente. <<<');
process.exit(0);
