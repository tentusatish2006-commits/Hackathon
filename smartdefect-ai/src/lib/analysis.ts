export type Batch = {
  BatchID: string;
  MachineID: string;
  Temperature: number | null;
  Vibration: number | null;
  DefectCount: number | null;
  TemperatureCategory?: 'LOW' | 'NORMAL' | 'HIGH';
  Defective?: 'YES' | 'NO';
};
export type Field = 'Temperature' | 'Vibration' | 'DefectCount';
export const HEADERS = ['BatchID', 'MachineID', 'Temperature', 'Vibration', 'DefectCount'];
export const DEMO: Batch[] = [
  { BatchID: 'B101', MachineID: 'M1', Temperature: 72, Vibration: 2.1, DefectCount: 0 },
  { BatchID: 'B102', MachineID: 'M1', Temperature: null, Vibration: 2.4, DefectCount: 1 },
  { BatchID: 'B103', MachineID: 'M2', Temperature: 85, Vibration: 3.2, DefectCount: 2 },
  { BatchID: 'B104', MachineID: 'M2', Temperature: 78, Vibration: null, DefectCount: 0 },
  { BatchID: 'B105', MachineID: 'M3', Temperature: 92, Vibration: 3.8, DefectCount: 3 },
  { BatchID: 'B106', MachineID: 'M1', Temperature: 69, Vibration: 2.0, DefectCount: 0 },
  { BatchID: 'B106', MachineID: 'M1', Temperature: 69, Vibration: 2.0, DefectCount: 0 },
  { BatchID: 'B107', MachineID: 'M3', Temperature: 88, Vibration: 3.5, DefectCount: 2 },
  { BatchID: 'B108', MachineID: 'M2', Temperature: 74, Vibration: 2.6, DefectCount: 1 },
  { BatchID: 'B109', MachineID: 'M1', Temperature: 71, Vibration: 2.2, DefectCount: 0 },
];

export function parseCsv(text: string): { rows: Batch[]; errors: string[] } {
  try {
    const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const records: string[][] = [];
    let record: string[] = [];
    let value = '';
    let quoted = false;
    let afterQuote = false;
    const finishRecord = () => {
      record.push(value.trim());
      if (record.some((field) => field !== '')) records.push(record);
      record = [];
      value = '';
      afterQuote = false;
    };

    for (let i = 0; i < source.length; i++) {
      const char = source[i];
      if (quoted) {
        if (char === '"' && source[i + 1] === '"') {
          value += '"';
          i++;
        } else if (char === '"') {
          quoted = false;
          afterQuote = true;
        } else {
          value += char;
        }
      } else if (afterQuote) {
        if (char === ',') {
          record.push(value.trim());
          value = '';
          afterQuote = false;
        } else if (char === '\n') {
          finishRecord();
        } else if (!/\s/.test(char)) {
          throw new Error('Unexpected text after a quoted value.');
        }
      } else if (char === '"') {
        if (value.trim() !== '') throw new Error('A quote appeared inside an unquoted value.');
        quoted = true;
      } else if (char === ',') {
        record.push(value.trim());
        value = '';
      } else if (char === '\n') {
        finishRecord();
      } else {
        value += char;
      }
    }
    if (quoted) throw new Error('A quoted value was not closed.');
    if (value !== '' || record.length > 0 || afterQuote) finishRecord();
    if (!records.length) return { rows: [], errors: ['The file is empty. Add a header row and at least one batch.'] };

    const headers = records[0];
    const missing = HEADERS.filter((h) => !headers.includes(h));
    if (missing.length) return { rows: [], errors: missing.map((h) => `Invalid dataset. Missing required column: ${h}`) };
    const duplicateHeaders = headers.filter((h, i) => headers.indexOf(h) !== i);
    if (duplicateHeaders.length) return { rows: [], errors: [...new Set(duplicateHeaders)].map((h) => `Invalid dataset. Duplicate column header: ${h}`) };
    const ix = Object.fromEntries(HEADERS.map((h) => [h, headers.indexOf(h)])) as Record<string, number>;
    const rows: Batch[] = []; const errors: string[] = [];
    records.slice(1).forEach((fields, index) => {
      const lineNo = index + 2;
      if (fields.length !== headers.length) { errors.push(`Row ${lineNo}: expected ${headers.length} columns, found ${fields.length}.`); return; }
      const nums: Record<Field, number | null> = { Temperature: null, Vibration: null, DefectCount: null };
      (['Temperature', 'Vibration', 'DefectCount'] as Field[]).forEach((key) => {
        const v = fields[ix[key]];
        if (v !== '') {
          const n = Number(v);
          if (!Number.isFinite(n)) errors.push(`Row ${lineNo}: ${key} must be numeric; received “${v}”.`);
          else nums[key] = n;
        }
      });
      const BatchID = fields[ix.BatchID]; const MachineID = fields[ix.MachineID];
      if (!BatchID) errors.push(`Row ${lineNo}: BatchID is required.`);
      if (!MachineID) errors.push(`Row ${lineNo}: MachineID is required.`);
      if (BatchID && MachineID && !errors.some((e) => e.startsWith(`Row ${lineNo}:`))) rows.push({ BatchID, MachineID, ...nums });
    });
    if (!rows.length && !errors.length) errors.push('No batch records found in this file.');
    return { rows, errors };
  } catch (error) { return { rows: [], errors: [`Could not parse CSV safely: ${error instanceof Error ? error.message : 'malformed quoting'}`] }; }
}

export const median = (values: number[]) => {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b); const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
export function dedupe(rows: Batch[]) {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = JSON.stringify([r.BatchID, r.MachineID, r.Temperature, r.Vibration, r.DefectCount]);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}
export function cleanRows(rows: Batch[]): Batch[] {
  const meds: Record<Field, number> = {
    Temperature: median(rows.map((r) => r.Temperature).filter((v): v is number => v !== null)),
    Vibration: median(rows.map((r) => r.Vibration).filter((v): v is number => v !== null)),
    DefectCount: median(rows.map((r) => r.DefectCount).filter((v): v is number => v !== null)),
  };
  const imputed = rows.map((r) => {
    const Temperature = r.Temperature ?? meds.Temperature;
    const Vibration = r.Vibration ?? meds.Vibration;
    const DefectCount = r.DefectCount ?? meds.DefectCount;
    return { ...r, Temperature, Vibration, DefectCount };
  });
  return dedupe(imputed).map((r) => ({ ...r, TemperatureCategory: (r.Temperature ?? 0) < 75 ? 'LOW' : (r.Temperature ?? 0) <= 85 ? 'NORMAL' : 'HIGH', Defective: (r.DefectCount ?? 0) > 0 ? 'YES' : 'NO' }));
}
export function machineStats(rows: Batch[]) {
  const ids = [...new Set(rows.map((r) => r.MachineID))].sort();
  return ids.map((MachineID) => {
    const rs = rows.filter((r) => r.MachineID === MachineID);
    const known = (key: Field) => rs.map((r) => r[key]).filter((v): v is number => v !== null);
    const defects = known('DefectCount').reduce((a, b) => a + b, 0);
    return { MachineID, batches: rs.length, avgTemperature: mean(known('Temperature')), avgVibration: mean(known('Vibration')), defects, defectRate: rs.length ? rs.filter((r) => (r.DefectCount ?? 0) > 0).length / rs.length * 100 : 0, rows: rs };
  });
}
export const mean = (v: number[]) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
export function riskStats(rows: Batch[]) {
  const maxT = Math.max(...rows.map((r) => r.Temperature ?? 0), 1);
  const maxV = Math.max(...rows.map((r) => r.Vibration ?? 0), 1);
  const maxD = Math.max(...rows.map((r) => r.DefectCount ?? 0), 1);
  return machineStats(rows).map((m) => {
    const t = Math.max(0, Math.min(1, mean(m.rows.map((r) => r.Temperature ?? 0)) / maxT));
    const v = Math.max(0, Math.min(1, mean(m.rows.map((r) => r.Vibration ?? 0)) / maxV));
    const d = Math.max(0, Math.min(1, m.defects / (m.rows.length * maxD || 1)));
    const score = Math.round(Math.max(0, Math.min(100, (t * .35 + v * .35 + d * .3) * 100)));
    return {
      ...m,
      score,
      temperatureRisk: t,
      vibrationRisk: v,
      defectRisk: d,
      status: score >= 70 ? 'Critical' : score >= 40 ? 'Warning' : 'Healthy',
    };
  });
}