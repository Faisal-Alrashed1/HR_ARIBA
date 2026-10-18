// منشئ ملفات Excel (.xlsx) بدون أي مكتبة خارجية (منقول من النظام القديم) — بلا اعتماديات = بلا ثغرات سلسلة التوريد
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const enc = (s) => new TextEncoder().encode(s);
function zip(files) {
  const chunks = [], central = []; let off = 0;
  const w16 = (a, v) => a.push(v & 255, (v >>> 8) & 255); const w32 = (a, v) => a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
  files.forEach((f) => {
    const name = enc(f.name), data = enc(f.data), crc = crc32(data), h = [];
    w32(h, 0x04034b50); w16(h, 20); w16(h, 0x0800); w16(h, 0); w16(h, 0); w16(h, 0x21); w32(h, crc); w32(h, data.length); w32(h, data.length); w16(h, name.length); w16(h, 0);
    chunks.push(new Uint8Array(h), name, data);
    const c = []; w32(c, 0x02014b50); w16(c, 20); w16(c, 20); w16(c, 0x0800); w16(c, 0); w16(c, 0); w16(c, 0x21); w32(c, crc); w32(c, data.length); w32(c, data.length); w16(c, name.length); w16(c, 0); w16(c, 0); w16(c, 0); w16(c, 0); w32(c, 0); w32(c, off);
    central.push(new Uint8Array(c), name); off += h.length + name.length + data.length;
  });
  let csz = 0; central.forEach((x) => { csz += x.length; });
  const e = []; w32(e, 0x06054b50); w16(e, 0); w16(e, 0); w16(e, files.length); w16(e, files.length); w32(e, csz); w32(e, off); w16(e, 0);
  return new Blob([...chunks, ...central, new Uint8Array(e)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const colL = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
// eslint-disable-next-line no-control-regex
const xesc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
/** حماية من حقن الصيغ (CSV/Excel injection): أي نص يبدأ بـ = + - @ يُسبق بفاصلة عليا */
const safeText = (v) => { const s = String(v); return /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? "'" + s : s; };
function sheetXml(rows, widths, rtl) {
  let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"' + (rtl ? ' rightToLeft="1"' : '') + '><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols><sheetData>';
  rows.forEach((r, ri) => {
    x += '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
      const ref = colL(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : '';
      if (typeof v === 'number' && Number.isFinite(v)) return '<c r="' + ref + '"' + st + '><v>' + v + '</v></c>';
      if (v === '' || v == null) return '<c r="' + ref + '"' + st + '/>';
      return '<c r="' + ref + '" t="inlineStr"' + st + '><is><t xml:space="preserve">' + xesc(safeText(v)) + '</t></is></c>';
    }).join('') + '</row>';
  });
  return x + '</sheetData></worksheet>';
}
/** sheets: [{name, rows:[[..]], widths:[..]}] */
export function buildXlsx(sheets, { rtl = true } = {}) {
  const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const ct = H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>';
  const rels = H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const wb = H + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => '<sheet name="' + xesc(s.name).slice(0, 31) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>';
  const wbr = H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const st = H + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF014D3D"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const files = [{ name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: rels }, { name: 'xl/workbook.xml', data: wb }, { name: 'xl/_rels/workbook.xml.rels', data: wbr }, { name: 'xl/styles.xml', data: st }];
  sheets.forEach((s, i) => files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s.rows, s.widths, rtl) }));
  return zip(files);
}
