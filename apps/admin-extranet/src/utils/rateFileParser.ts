// Client-side parser for CSV and PDF text → normalized RateLines

export interface ParsedRateLine {
  groupName?: string;
  fromDate: string;
  toDate: string;
  season?: string;
  rateCode?: string;
  discountPct?: number;
  roomLabel: string;
  mealLabel: string;
  occupancyKey: string;
  amount: number;
  minStay?: number;
}

interface TextItem {
  x: number;
  y: number;
  text: string;
}

type TextRow = TextItem[];

interface ColumnDef {
  roomLabel: string;
  occupancyKey: string;
  x: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeDate(raw: string): string {
  const s = raw.trim();
  const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotMatch) {
    const [, d, m, y] = dotMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return s;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(',', '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function cleanRoomLabel(parts: string[]): string {
  return parts
    .join(' ')
    .replace(/\([^)]*\)/g, '')           // remove parenthetical
    .replace(/waterpark\s*access/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function detectMealPlan(text: string): string | null {
  if (/bed.*breakfast|bb basis/i.test(text)) return 'BB';
  if (/hb\+|half.?board\+|hb plus/i.test(text)) return 'HB+';
  if (/full.?board/i.test(text)) return 'FB';
  if (/all.?inclusive/i.test(text)) return 'AI';
  if (/half.?board/i.test(text)) return 'HB';
  if (/room.?only/i.test(text)) return 'RO';
  return null;
}

const DATE_RE = /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/;
const OCC_RE = /sgl|dbl/i;
const TPL_RE = /^tpl$/i;
const QUAD_RE = /^quad$/i;
const SKIP_WORDS = /^(from|to|season|rate|code|%|discount|free|unlimited|waterpark|access|benefits|hb|bb|fb|ai|ro|high|low|peak|shoulder|standard|resort|grand|suite|family|room|type|view|downtown|superior|deluxe)$/i;

// ─── PDF.js loader ────────────────────────────────────────────────────────────

async function loadPDFJS(): Promise<any> {
  return new Promise((resolve, reject) => {
    const win = window as any;
    if (win.pdfjsLib) { resolve(win.pdfjsLib); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjs = win.pdfjsLib;
      if (!pdfjs) { reject(new Error('PDF.js failed to load')); return; }
      pdfjs.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjs);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'));
    document.head.appendChild(script);
  });
}

// ─── Row grouping ─────────────────────────────────────────────────────────────

function groupIntoRows(items: TextItem[]): TextRow[] {
  const rowMap = new Map<number, TextItem[]>();
  for (const item of items) {
    const y = Math.round(item.y);
    let rowKey = y;
    for (const k of rowMap.keys()) {
      if (Math.abs(k - y) <= 4) { rowKey = k; break; }
    }
    if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
    rowMap.get(rowKey)!.push(item);
  }
  return Array.from(rowMap.entries())
    .sort(([ya], [yb]) => yb - ya) // PDF y is bottom-up → sort descending = top-to-bottom
    .map(([, its]) => its.sort((a, b) => a.x - b.x));
}

// ─── Column definition builder ────────────────────────────────────────────────

function buildColumnDefs(rows: TextRow[], occHeaderIdx: number): ColumnDef[] {
  const occRow = rows[occHeaderIdx];

  // Collect occupancy column positions
  const occCols: { key: string; x: number }[] = [];
  for (const item of occRow) {
    const t = item.text;
    if (OCC_RE.test(t)) occCols.push({ key: 'SGL', x: item.x });
    else if (TPL_RE.test(t)) occCols.push({ key: 'TPL', x: item.x });
    else if (QUAD_RE.test(t)) occCols.push({ key: 'QUAD', x: item.x });
  }
  if (occCols.length === 0) return [];

  // Group into room type groups (new group starts when we see another SGL after TPL/QUAD)
  const groups: { key: string; x: number }[][] = [];
  let cur: { key: string; x: number }[] = [occCols[0]];
  for (let i = 1; i < occCols.length; i++) {
    if (occCols[i].key === 'SGL' && cur.some(c => c.key !== 'SGL')) {
      groups.push(cur); cur = [occCols[i]];
    } else {
      cur.push(occCols[i]);
    }
  }
  groups.push(cur);

  // Collect room type names from header rows above the occupancy row
  const headerRows = rows.slice(Math.max(0, occHeaderIdx - 12), occHeaderIdx);

  const columnDefs: ColumnDef[] = [];

  for (let gIdx = 0; gIdx < groups.length; gIdx++) {
    const group = groups[gIdx];
    const xStart = group[0].x;
    const xEnd = gIdx < groups.length - 1
      ? groups[gIdx + 1][0].x - 5
      : group[group.length - 1].x + 100;

    // Collect label parts from header rows within this x-range
    const labelParts: string[] = [];
    for (const hRow of headerRows) {
      for (const item of hRow) {
        if (item.x < xStart - 20 || item.x > xEnd) continue;
        const t = item.text.trim();
        if (!t || t.length < 2) continue;
        if (/^[()%*]/.test(t) || t.endsWith(')')) continue;
        if (SKIP_WORDS.test(t)) continue;
        if (OCC_RE.test(t) || TPL_RE.test(t) || QUAD_RE.test(t)) continue;
        labelParts.push(t);
      }
    }

    const roomLabel = cleanRoomLabel(labelParts) || `Room Type ${gIdx + 1}`;

    for (const col of group) {
      columnDefs.push({ roomLabel, occupancyKey: col.key, x: col.x });
    }
  }

  return columnDefs;
}

// ─── Page parser ──────────────────────────────────────────────────────────────

function parseRatePage(rows: TextRow[]): { lines: ParsedRateLine[]; terms: string[] } {
  const lines: ParsedRateLine[] = [];
  const terms: string[] = [];
  let mealPlan = 'BB';
  let columnDefs: ColumnDef[] = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const rowText = row.map(i => i.text).join(' ');

    // Detect meal plan section header
    const mp = detectMealPlan(rowText);
    if (mp) {
      mealPlan = mp;
      columnDefs = []; // reset columns for new section
      continue;
    }

    // Detect occupancy header row (has ≥2 SGL/DBL or TPL items)
    const occItems = row.filter(i => OCC_RE.test(i.text) || TPL_RE.test(i.text) || QUAD_RE.test(i.text));
    if (occItems.length >= 2) {
      const defs = buildColumnDefs(rows, rowIdx);
      if (defs.length > 0) { columnDefs = defs; continue; }
    }

    if (columnDefs.length === 0) continue;

    // Detect terms lines
    if (/booking|free sale|subject to|condition|policy|market/i.test(rowText) && row.length > 2) {
      terms.push(rowText);
      continue;
    }

    // Parse data rows: must have ≥2 date items
    const dateItems = row.filter(i => DATE_RE.test(i.text));
    if (dateItems.length < 2) continue;

    const fromDate = normalizeDate(dateItems[0].text);
    const toDate = normalizeDate(dateItems[1].text);
    const season = row.find(i => /^(high|low|peak|shoulder)$/i.test(i.text))?.text;
    const rateCodeItem = row.find(i => /^[A-Z]{2,5}[A-Z0-9]{0,4}$/.test(i.text) && i.text.length >= 4 && !DATE_RE.test(i.text) && !/^(FROM|TO|HIGH|LOW|PEAK|SEASON|RATE|CODE|SGL|DBL|TPL|QUAD)$/i.test(i.text));
    const rateCode = rateCodeItem?.text;
    const discountItem = row.find(i => i.text.endsWith('%'));
    const discountPct = discountItem ? parseInt(discountItem.text) : undefined;

    // Match amounts to column defs by x-position (closest match, ≤45px tolerance)
    const usedItemIndices = new Set<number>();
    const colDefsSorted = [...columnDefs].sort((a, b) => a.x - b.x);

    for (const colDef of colDefsSorted) {
      // Find best matching item for this column
      let bestIdx = -1;
      let bestDist = 46;
      for (let i = 0; i < row.length; i++) {
        if (usedItemIndices.has(i)) continue;
        const item = row[i];
        const dist = Math.abs(item.x - colDef.x);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      if (bestIdx === -1) continue;

      const item = row[bestIdx];
      usedItemIndices.add(bestIdx);

      if (/^n\/a$/i.test(item.text)) continue; // N/A = skip
      if (item.text.endsWith('%')) continue;
      if (DATE_RE.test(item.text)) continue;
      if (/^(high|low|peak|shoulder)$/i.test(item.text)) continue;

      const amount = parseAmount(item.text);
      if (amount === null || amount < 100) continue;

      lines.push({
        fromDate, toDate, season, rateCode, discountPct,
        roomLabel: colDef.roomLabel,
        mealLabel: mealPlan,
        occupancyKey: colDef.occupancyKey,
        amount,
      });
    }
  }

  return { lines, terms };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Main PDF parsing entry point — uses PDF.js for accurate text + position extraction */
export async function parsePDFFile(buffer: ArrayBuffer): Promise<{ lines: ParsedRateLine[]; termsText: string }> {
  const pdfjs = await loadPDFJS();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  const allLines: ParsedRateLine[] = [];
  const allTerms: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const items: TextItem[] = (content.items as any[])
      .filter(item => item.str?.trim())
      .map(item => ({
        x: item.transform[4],
        y: item.transform[5],
        text: item.str.trim(),
      }));

    if (items.length === 0) continue;

    const rows = groupIntoRows(items);
    const { lines, terms } = parseRatePage(rows);
    allLines.push(...lines);
    allTerms.push(...terms);
  }

  return { lines: allLines, termsText: allTerms.join('\n') };
}

/** Simple text extraction (kept for fallback / plain-text use) */
export async function extractPDFText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await loadPDFJS();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
  }
  return fullText;
}

/** Legacy text-based PDF parser (fallback) */
export function parsePDFText(rawText: string): { lines: ParsedRateLine[]; termsText: string } {
  const results: ParsedRateLine[] = [];
  const textLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  let currentMeal = 'BB';
  const termsLines: string[] = [];
  const datePattern = /\b(\d{1,2}[./]\d{1,2}[./]\d{2,4})\b/g;
  const amountPattern = /\b(\d{3,6}(?:\.\d{1,2})?)\b/g;

  for (const line of textLines) {
    const mp = detectMealPlan(line);
    if (mp) { currentMeal = mp; continue; }
    if (/booking|market|valid|condition|policy|free sale|subject to/i.test(line)) {
      termsLines.push(line); continue;
    }
    const dates = [...line.matchAll(datePattern)].map(m => normalizeDate(m[1]));
    if (dates.length < 2) continue;
    const amounts = [...line.matchAll(amountPattern)].map(m => parseFloat(m[1])).filter(n => n >= 100 && n <= 99999);
    if (amounts.length === 0) continue;
    const roomMatch = line.match(/\b(standard|deluxe|suite|studio|villa|bungalow|room|1br|2br|3br)\b/i);
    const roomLabel = roomMatch ? roomMatch[1] : 'Standard';
    const codeMatch = line.match(/\b([A-Z]{2,4}\d{2,4})\b/);
    const rateCode = codeMatch ? codeMatch[1] : undefined;
    const occKeys = ['SGL', 'TPL', 'QUAD'];
    amounts.slice(0, 3).forEach((amount, idx) => {
      results.push({ fromDate: dates[0], toDate: dates[1], roomLabel, mealLabel: currentMeal, occupancyKey: occKeys[idx] ?? 'SGL', amount, rateCode });
    });
  }
  return { lines: results, termsText: termsLines.join('\n') };
}

/** Parse CSV/TSV text into rate lines */
export function parseCSV(text: string): ParsedRateLine[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const splitRow = (row: string): string[] => {
    const result: string[] = [];
    let cur = '', inQuote = false;
    for (const ch of row) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === delimiter && !inQuote) { result.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    result.push(cur.trim());
    return result;
  };

  const headers = splitRow(lines[0]).map(h => h.toLowerCase().trim());
  const idx = (names: string[]) => names.map(n => headers.findIndex(h => h.includes(n))).find(i => i >= 0) ?? -1;

  const fromIdx = idx(['from', 'start', 'check in', 'date from']);
  const toIdx = idx(['to', 'end', 'check out', 'date to']);
  const roomIdx = idx(['room type', 'room', 'category']);
  const mealIdx = idx(['meal', 'board', 'plan']);
  const sglIdx = idx(['sgl', 'single', 'adult 1', 'adult1', '1 adult', 'pax1']);
  const dblIdx = idx(['dbl', 'double', 'adult 2', 'adult2', '2 adult', 'pax2']);
  const tplIdx = idx(['tpl', 'triple', 'adult 3', 'adult3', '3 adult', 'pax3']);
  const rateCodeIdx = idx(['rate code', 'code', 'ratecode']);
  const seasonIdx = idx(['season']);
  const minStayIdx = idx(['min stay', 'minstay', 'minimum stay']);

  const results: ParsedRateLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    if (cols.every(c => !c)) continue;
    const fromRaw = fromIdx >= 0 ? cols[fromIdx] : '';
    const toRaw = toIdx >= 0 ? cols[toIdx] : '';
    const roomLabel = roomIdx >= 0 ? cols[roomIdx] : '';
    const mealLabel = mealIdx >= 0 ? cols[mealIdx] : 'RO';
    if (!fromRaw || !toRaw || !roomLabel) continue;

    const fromDate = normalizeDate(fromRaw);
    const toDate = normalizeDate(toRaw);
    const season = seasonIdx >= 0 ? cols[seasonIdx] : undefined;
    const rateCode = rateCodeIdx >= 0 ? cols[rateCodeIdx] : undefined;
    const minStay = minStayIdx >= 0 ? parseAmount(cols[minStayIdx] ?? '') ?? undefined : undefined;

    const occupancies: { key: string; colIdx: number }[] = [];
    if (sglIdx >= 0) occupancies.push({ key: 'SGL', colIdx: sglIdx });
    if (dblIdx >= 0) occupancies.push({ key: 'DBL', colIdx: dblIdx });
    if (tplIdx >= 0) occupancies.push({ key: 'TPL', colIdx: tplIdx });
    if (occupancies.length === 0) {
      const rateIdx = idx(['rate', 'price', 'amount', 'net rate']);
      if (rateIdx >= 0) occupancies.push({ key: 'SGL', colIdx: rateIdx });
    }

    for (const occ of occupancies) {
      const raw = cols[occ.colIdx] ?? '';
      if (!raw || raw.toLowerCase() === 'n/a' || raw === '-') continue;
      const amount = parseAmount(raw);
      if (amount === null) continue;
      results.push({ fromDate, toDate, roomLabel: roomLabel.trim(), mealLabel: mealLabel.trim() || 'RO', occupancyKey: occ.key, amount, season, rateCode, minStay });
    }
  }
  return results;
}
