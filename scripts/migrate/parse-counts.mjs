import { readFileSync } from 'node:fs';
const raw = readFileSync(process.argv[2], 'utf8');
const start = raw.indexOf('\n[');
const arr = JSON.parse(raw.slice(start + 1));
for (const r of arr) {
  const row = r.results[0];
  const keys = Object.keys(row);
  console.log(row[keys[0]], '=', row[keys[1]]);
}
