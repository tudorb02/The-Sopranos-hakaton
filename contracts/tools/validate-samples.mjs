// Validates real backend responses against the contract. Each file in the samples directory is named
// <Schema>__<case>.json: <Schema> is a component of openapi.yaml, or RunEvent for one SSE event.
// The backend test ContractSamplesTest writes them to backend/target/contract-samples.
// Run: npm run validate:samples   (exit code 1 on any mismatch)
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://contracts.greenstruct.ro/';
const samplesDir = resolve(process.argv[2] ?? join(ROOT, '..', 'backend', 'target', 'contract-samples'));

const ajv = new Ajv2020({ strict: false, allErrors: true, validateSchema: false });
addFormats(ajv);
for (const f of readdirSync(join(ROOT, 'schemas')).filter((f) => f.endsWith('.json'))) {
  ajv.addSchema(JSON.parse(readFileSync(join(ROOT, 'schemas', f), 'utf8')));
}
const openapi = parseYaml(readFileSync(join(ROOT, 'openapi.yaml'), 'utf8'));
ajv.addSchema({ ...openapi, $id: `${BASE}openapi.yaml` });

const files = readdirSync(samplesDir).filter((f) => f.endsWith('.json')).sort();
if (!files.length) {
  console.error(`✗ no samples in ${samplesDir}; run the backend tests first`);
  process.exit(1);
}
const errors = [];
for (const file of files) {
  const schema = file.split('__')[0];
  const ref = schema === 'RunEvent' ? `${BASE}schemas/event.json` : `${BASE}openapi.yaml#/components/schemas/${schema}`;
  const validate = ajv.getSchema(ref);
  if (!validate) { errors.push(`${file}: unknown schema ${schema}`); continue; }
  const value = JSON.parse(readFileSync(join(samplesDir, file), 'utf8'));
  if (!validate(value)) errors.push(`${file}: ${ajv.errorsText(validate.errors, { dataVar: schema })}`);
}
if (errors.length) {
  console.error(`✗ ${errors.length} of ${files.length} samples do not match the contract:`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log(`✓ ${files.length} backend samples match the contract`);
