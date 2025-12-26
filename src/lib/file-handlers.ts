import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import type { DelimiterType, AnalysisData, Segment } from '@/types';
import { segmentText } from './utils';

/**
 * Handle XLSX file and extract text
 * - If file has headers (Content, Source, Text, etc.), extract from that column
 * - Otherwise, extract from second column if multi-column, or all text if single column
 */
export async function handleXlsxFile(file: File): Promise<string[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(
    firstSheet,
    { header: 1 }
  );

  if (jsonData.length === 0) return [];

  const texts: string[] = [];
  const firstRow = jsonData[0];

  // Check if first row looks like headers
  const headerKeywords = ['content', 'source', 'text', 'segment', 'original', '원문', '소스'];
  let contentColumnIndex = -1;

  // Find content column by header name
  if (Array.isArray(firstRow)) {
    firstRow.forEach((cell, idx) => {
      if (typeof cell === 'string') {
        const cellLower = cell.toLowerCase().trim();
        if (headerKeywords.includes(cellLower)) {
          contentColumnIndex = idx;
        }
      }
    });
  }

  // If we found a content column header, extract from that column (skip header row)
  if (contentColumnIndex !== -1) {
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (Array.isArray(row) && row[contentColumnIndex]) {
        const cell = row[contentColumnIndex];
        if (typeof cell === 'string' && cell.trim()) {
          texts.push(cell.trim());
        } else if (typeof cell === 'number') {
          texts.push(String(cell));
        }
      }
    }
    return texts;
  }

  // If multi-column without recognized header, use second column (assuming first is ID/key)
  const hasMultipleColumns = firstRow && firstRow.length > 1;
  if (hasMultipleColumns) {
    // Check if first row looks like header (non-sentence text)
    const firstCellIsHeader = typeof firstRow[0] === 'string' &&
      !firstRow[0].includes(' ') &&
      firstRow[0].length < 30;

    const startIdx = firstCellIsHeader ? 1 : 0;
    const colIdx = 1; // Use second column

    for (let i = startIdx; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (Array.isArray(row) && row[colIdx]) {
        const cell = row[colIdx];
        if (typeof cell === 'string' && cell.trim()) {
          texts.push(cell.trim());
        } else if (typeof cell === 'number') {
          texts.push(String(cell));
        }
      }
    }
    return texts;
  }

  // Single column - extract all text
  jsonData.forEach((row) => {
    if (Array.isArray(row)) {
      row.forEach((cell) => {
        if (cell && typeof cell === 'string' && cell.trim()) {
          texts.push(cell.trim());
        }
      });
    }
  });

  return texts;
}

/**
 * Handle DOCX file and extract segmented text
 */
export async function handleDocxFile(
  file: File,
  delimiter: DelimiterType
): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return segmentText(result.value, delimiter);
}

/**
 * Handle plain text file
 */
export async function handleTextFile(
  file: File,
  delimiter: DelimiterType
): Promise<string[]> {
  const text = await file.text();
  return segmentText(text, delimiter);
}

/**
 * Process uploaded file based on extension
 */
export async function processFile(
  file: File,
  delimiter: DelimiterType
): Promise<string[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'xlsx':
    case 'xls':
      return handleXlsxFile(file);
    case 'docx':
      return handleDocxFile(file, delimiter);
    case 'txt':
    default:
      return handleTextFile(file, delimiter);
  }
}

/**
 * Export translations to XLSX file
 */
export function exportToXlsx(
  segments: { source: string; target: string; status: string }[],
  fileName: string
): void {
  const data = segments.map((s, idx) => ({
    '#': idx + 1,
    Source: s.source,
    Target: s.target || '',
    Status: s.status,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Translations');

  const outputName = fileName.replace(/\.[^/.]+$/, '');
  XLSX.writeFile(wb, `translated_${outputName}.xlsx`);
}

/**
 * Generate TMX content from TM entries
 */
export function generateTmxContent(
  tm: { source: string; target: string }[],
  sourceLang: string,
  targetLang: string
): string {
  const entries = tm
    .map(
      (entry) => `    <tu>
      <tuv xml:lang="${sourceLang}">
        <seg>${escapeXml(entry.source)}</seg>
      </tuv>
      <tuv xml:lang="${targetLang}">
        <seg>${escapeXml(entry.target)}</seg>
      </tuv>
    </tu>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<tmx version="1.4">
  <header creationtool="CAT Tool" srclang="${sourceLang}" adminlang="en" datatype="plaintext"/>
  <body>
${entries}
  </body>
</tmx>`;
}

/**
 * Export TM to TMX file
 */
export function exportToTmx(
  tm: { source: string; target: string }[],
  sourceLang: string,
  targetLang: string
): void {
  const tmxContent = generateTmxContent(tm, sourceLang, targetLang);
  const blob = new Blob([tmxContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'translation_memory.tmx';
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Parse TMX file and extract TM entries
 */
export function parseTmxFile(
  content: string
): { source: string; target: string }[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/xml');
  const tus = doc.querySelectorAll('tu');

  const imported: { source: string; target: string }[] = [];

  tus.forEach((tu) => {
    const tuvs = tu.querySelectorAll('tuv');
    if (tuvs.length >= 2) {
      const source = tuvs[0].querySelector('seg')?.textContent || '';
      const target = tuvs[1].querySelector('seg')?.textContent || '';
      if (source && target) {
        imported.push({ source, target });
      }
    }
  });

  return imported;
}

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Export analysis data to XLSX file
 */
export function exportAnalysisToXlsx(
  analysisData: AnalysisData,
  wordRate: number,
  fileName: string
): void {
  const data = [
    ['Match Rate', 'Segments', 'Words', 'Rate (%)', 'Cost (원)'],
    ...analysisData.tiers.map((t) => [
      t.name,
      t.segments,
      t.words,
      t.rate,
      Math.round(t.cost),
    ]),
    [],
    ['Summary', '', '', '', ''],
    ['Total Segments', analysisData.totalSegments, '', '', ''],
    ['Total Words', analysisData.totalWords, '', '', ''],
    ['Word Rate', wordRate, '원/word', '', ''],
    ['Full Cost (No TM)', '', '', '', analysisData.fullCost],
    ['Actual Cost', '', '', '', Math.round(analysisData.totalCost)],
    ['Savings', '', '', '', Math.round(analysisData.savings)],
    ['Savings %', '', '', '', `${analysisData.savingsPercent}%`],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Analysis');

  const outputName = fileName.replace(/\.[^/.]+$/, '');
  XLSX.writeFile(wb, `analysis_${outputName}.xlsx`);
}

/**
 * Generate XLIFF content from segments
 */
export function generateXliffContent(
  segments: Segment[],
  sourceLang: string,
  targetLang: string,
  fileName: string
): string {
  const transUnits = segments
    .map(
      (seg) => `      <trans-unit id="${seg.id + 1}" ${seg.status === 'confirmed' ? 'approved="yes"' : ''}>
        <source>${escapeXml(seg.source)}</source>
        <target${seg.status === 'confirmed' ? ' state="final"' : seg.status === 'translated' ? ' state="translated"' : ' state="new"'}>${escapeXml(seg.target)}</target>
      </trans-unit>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="${sourceLang}" target-language="${targetLang}" datatype="plaintext" original="${escapeXml(fileName)}">
    <body>
${transUnits}
    </body>
  </file>
</xliff>`;
}

/**
 * Export translations to XLIFF file
 */
export function exportToXliff(
  segments: Segment[],
  sourceLang: string,
  targetLang: string,
  fileName: string
): void {
  const xliffContent = generateXliffContent(segments, sourceLang, targetLang, fileName);
  const blob = new Blob([xliffContent], { type: 'application/xliff+xml' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const outputName = fileName.replace(/\.[^/.]+$/, '');
  a.download = `${outputName}.xliff`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Parse XLIFF file and extract segments
 */
export function parseXliffFile(content: string): Segment[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/xml');
  const transUnits = doc.querySelectorAll('trans-unit');

  const segments: Segment[] = [];

  transUnits.forEach((tu, idx) => {
    const source = tu.querySelector('source')?.textContent || '';
    const target = tu.querySelector('target')?.textContent || '';
    const targetEl = tu.querySelector('target');
    const state = targetEl?.getAttribute('state') || '';
    const approved = tu.getAttribute('approved') === 'yes';

    let status: 'new' | 'translated' | 'confirmed' = 'new';
    if (approved || state === 'final') {
      status = 'confirmed';
    } else if (target && (state === 'translated' || state === '')) {
      status = 'translated';
    }

    if (source) {
      segments.push({
        id: idx,
        source,
        target: target || '',
        status,
        matchRate: 0,
      });
    }
  });

  return segments;
}
