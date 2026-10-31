// The text a PDF prints (PDFKit: compressed streams, text as hex or literal strings).
import zlib from 'node:zlib';

export function pdfText(buffer) {
  const raw = buffer.toString('latin1');
  let out = '';
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    let body;
    try { body = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch { continue; }
    for (const t of body.matchAll(/<([0-9a-fA-F]+)>|\(((?:\\.|[^\\)])*)\)/g)) {
      out += t[1] ? Buffer.from(t[1], 'hex').toString('latin1') : t[2];
    }
    out += '\n';
  }
  return out;
}
