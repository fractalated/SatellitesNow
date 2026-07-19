import type { TleRecord } from './types';

/**
 * Parses CelesTrak's 3-line TLE text format (name line + two element lines,
 * repeated) into structured records. Tolerant of blank lines and CRLF.
 */
export function parseTleText(text: string): TleRecord[] {
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
  const records: TleRecord[] = [];

  for (let i = 0; i + 2 < lines.length; ) {
    const name = lines[i].trim();
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    if (!name || !line1?.startsWith('1 ') || !line2?.startsWith('2 ')) {
      i += 1;
      continue;
    }

    const noradId = Number.parseInt(line1.slice(2, 7), 10);
    if (Number.isFinite(noradId)) {
      records.push({ noradId, name, line1, line2 });
    }
    i += 3;
  }

  return records;
}
