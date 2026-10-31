// The pincode file (prisma/data/india-pincodes.csv): plain CSV, pincode,area,city,state,
// with quotes only around names that hold commas.
export function parsePincodeCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur);
    const [pincode, area, city, state] = cells.map((c) => c.trim());
    if (/^[1-9]\d{5}$/.test(pincode) && city && state) rows.push({ pincode, area: area || city, city, state });
  }
  return rows;
}

