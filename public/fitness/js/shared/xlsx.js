// Минимальное чтение .xlsx без зависимостей: zip через DecompressionStream, XML — регулярками.
// Работает и в браузере, и в Node 22. Хватает для импорта трекера: значения ячеек
// (включая кэш формул), общие строки, даты.

const utf8 = new TextDecoder('utf-8');

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function readZip(input) {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Файл не похож на .xlsx (нет zip-каталога)');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Повреждён zip-каталог');
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = utf8.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const lNameLen = dv.getUint16(localOffset + 26, true);
    const lExtraLen = dv.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + compSize);
    files.set(name, async () => (method === 0 ? data : method === 8 ? inflateRaw(data) : null));
  }
  return files;
}

function unescapeXml(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
  });
}

function attrs(s) {
  const out = {};
  for (const m of s.matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = unescapeXml(m[2]);
  return out;
}

function textOf(xml) {
  // Склеиваем все <t>…</t> (включая rich text <r><t>), пропуская фонетику <rPh>.
  const noPh = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = '';
  for (const m of noPh.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) out += unescapeXml(m[1] || '');
  return out;
}

function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const BUILTIN_DATE_FMTS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 50, 57]);
const BUILTIN_TIME_FMTS = new Set([18, 19, 20, 21, 45, 46, 47]);

function classifyFormat(code) {
  const c = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '').toLowerCase();
  if (/[dy]/.test(c) || /(^|[^h:])m{3,}/.test(c)) return 'date';
  if (/[hs]/.test(c)) return 'time';
  return null;
}

function parseStyles(xml) {
  if (!xml) return [];
  const custom = new Map();
  for (const m of xml.matchAll(/<numFmt\b([^>]*)\/?>/g)) {
    const a = attrs(m[1]);
    custom.set(Number(a.numFmtId), classifyFormat(a.formatCode || ''));
  }
  const cellXfs = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
  if (!cellXfs) return [];
  const kinds = [];
  for (const m of cellXfs[1].matchAll(/<xf\b([^>]*?)(\/>|>)/g)) {
    const id = Number(attrs(m[1]).numFmtId || 0);
    kinds.push(BUILTIN_DATE_FMTS.has(id) ? 'date' : BUILTIN_TIME_FMTS.has(id) ? 'time' : custom.get(id) || null);
  }
  return kinds;
}

// Серийный номер Excel → 'YYYY-MM-DD'. База 1899-12-30 учитывает ошибку Excel с 29.02.1900.
export function excelSerialToIso(serial, date1904 = false) {
  const days = Math.floor(serial) + (date1904 ? 1462 : 0);
  return new Date(Date.UTC(1899, 11, 30) + days * 86400000).toISOString().slice(0, 10);
}

// Возвращает [{ name, rows }], где rows — массив строк, строка — массив значений:
// число, строка, boolean, null или { date: 'YYYY-MM-DD', serial } / { time: секунды }.
export async function readXlsx(buf) {
  const zip = readZip(buf);
  const get = async (name) => {
    const f = zip.get(name);
    const data = f && (await f());
    return data ? utf8.decode(data) : null;
  };
  const workbook = await get('xl/workbook.xml');
  if (!workbook) throw new Error('В файле нет xl/workbook.xml');
  const date1904 = /<workbookPr\b[^>]*date1904="(1|true)"/.test(workbook);
  const rels = new Map();
  for (const m of ((await get('xl/_rels/workbook.xml.rels')) || '').matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const a = attrs(m[1]);
    rels.set(a.Id, a.Target);
  }
  const shared = [];
  const sst = await get('xl/sharedStrings.xml');
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) shared.push(m[1] ? textOf(m[1]) : '');
  const styles = parseStyles(await get('xl/styles.xml'));

  const sheets = [];
  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const a = attrs(m[1]);
    let target = rels.get(a['r:id']) || '';
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const xml = await get(target);
    if (!xml) continue;
    sheets.push({ name: a.name, rows: parseSheet(xml, shared, styles, date1904) });
  }
  return sheets;
}

function parseSheet(xml, shared, styles, date1904) {
  const rows = [];
  const data = xml.match(/<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/);
  if (!data) return rows;
  let rowCursor = 0;
  for (const rm of data[1].matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const ra = attrs(rm[1]);
    const r = ra.r ? Number(ra.r) - 1 : rowCursor;
    rowCursor = r + 1;
    const row = [];
    let colCursor = 0;
    for (const cm of (rm[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ca = attrs(cm[1]);
      const c = ca.r ? colIndex(ca.r) : colCursor;
      colCursor = c + 1;
      const inner = cm[2] || '';
      const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
      const raw = vm ? unescapeXml(vm[1]) : null;
      let value = null;
      switch (ca.t) {
        case 's': value = raw === null ? null : shared[Number(raw)] ?? null; break;
        case 'inlineStr': value = textOf(inner); break;
        case 'str': value = raw; break;
        case 'b': value = raw === '1'; break;
        case 'e': value = null; break;
        default: {
          if (raw === null || raw === '') break;
          const n = Number(raw);
          const kind = styles[Number(ca.s || 0)];
          if (kind === 'date') value = { date: excelSerialToIso(n, date1904), serial: n };
          else if (kind === 'time') value = { time: Math.round((n % 1) * 86400), serial: n };
          else value = n;
        }
      }
      if (typeof value === 'string') value = value.trim() === '' ? null : value;
      row[c] = value;
    }
    rows[r] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}
