// Regenerates fixtures/ and examples/ from the REAL responses of the backend, so they cannot drift from the code.
// The backend test ContractSamplesTest writes backend/target/contract-samples/<Schema>__<case>.json; this script copies
// the ones the contract folder keeps: the module list, a farm and a finished dossier per demo scenario, and the SSE
// events of that dossier as NDJSON (one event per line, in order).
// Run: (cd ../backend && mvn test -Dtest=ContractSamplesTest) && npm run gen
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const samples = resolve(process.argv[2] ?? join(ROOT, '..', 'backend', 'target', 'contract-samples'));
const read = (name) => JSON.parse(readFileSync(join(samples, name), 'utf8'));
const write = (file, value, summary) =>
  writeFileSync(join(ROOT, file), JSON.stringify({ summary, value }, null, 2) + '\n');

write('examples/modules.json', read('ModuleList__all.json'), 'The 6 modules, as the backend serves them');
const scenarios = readdirSync(samples)
  .filter((f) => f.startsWith('RunView__full_trimis_'))
  .map((f) => f.slice('RunView__full_trimis_'.length, -'.json'.length));
for (const id of scenarios) {
  write(`examples/run-${id}.json`, read(`RunView__full_trimis_${id}.json`),
    `The demo dossier "${id}", sent by the SME to the bank (real backend response, from fixtures/${id}.ndjson)`);
  const farm = `FarmProfile__${id}.json`;
  if (existsSync(join(samples, farm))) write(`examples/farm-${id}.json`, read(farm), `The profile of the demo farm "${id}"`);
  const events = readdirSync(samples)
    .filter((f) => f.startsWith(`RunEvent__${id}_`))
    .map((f) => read(f))
    .sort((a, b) => a.seq - b.seq);
  writeFileSync(join(ROOT, `fixtures/${id}.ndjson`), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  console.log(`✓ ${id}: ${events.length} events`);
}
