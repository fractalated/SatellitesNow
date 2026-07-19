export interface TleRecord {
  noradId: number;
  name: string;
  line1: string;
  line2: string;
}

export interface TleSet {
  records: TleRecord[];
  fetchedAt: number;
}
