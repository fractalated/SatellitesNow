import { describe, expect, it } from 'vitest';
import { parseTleText } from './tle-parser';

const SAMPLE = `ISS (ZARYA)
1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9994
2 25544  51.6416 339.9146 0007976 126.0000 234.0000 15.49560000  1234
ATLAS CENTAUR 2
1 00694U 63047A   26200.29547243  .00000449  00000+0  41214-4 0  9997
2 00694  30.3519 179.8230 0545666 160.6849 201.5315 14.12567821150244
`;

describe('parseTleText', () => {
  it('parses well-formed 3-line records', () => {
    const records = parseTleText(SAMPLE);
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      noradId: 25544,
      name: 'ISS (ZARYA)',
      line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9994',
      line2: '2 25544  51.6416 339.9146 0007976 126.0000 234.0000 15.49560000  1234',
    });
    expect(records[1].noradId).toBe(694);
  });

  it('tolerates CRLF line endings and blank lines', () => {
    const withCrlf = SAMPLE.replace(/\n/g, '\r\n') + '\r\n\r\n';
    expect(parseTleText(withCrlf)).toHaveLength(2);
  });

  it('skips malformed groups instead of throwing', () => {
    const broken = 'JUNK\nnot a line 1\nnot a line 2\n' + SAMPLE;
    expect(parseTleText(broken)).toHaveLength(2);
  });

  it('returns an empty array for empty input', () => {
    expect(parseTleText('')).toEqual([]);
  });
});
