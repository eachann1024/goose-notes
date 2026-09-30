import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlan } from './contract.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const [requestFile, inspectionFile, outputFile, failureFile] = process.argv.slice(2);
if (!requestFile || !inspectionFile || !outputFile) throw new Error('plan.mjs request.json inspection.json plan.json [failure.json]');
const request = JSON.parse(await fs.readFile(requestFile, 'utf8'));
const inspection = JSON.parse(await fs.readFile(inspectionFile, 'utf8'));
const key = process.env.UI_PREVIEW_API_KEY || process.env.DEEPSEEK_API_KEY;
if (!key) throw new Error('UI_PREVIEW_API_KEY is not configured');
const url = process.env.UI_PREVIEW_API_URL || 'https://api.deepseek.com/v1/chat/completions';
if (new URL(url).protocol !== 'https:') throw new Error('Planner requires HTTPS');
const model = process.env.UI_PREVIEW_MODEL || 'deepseek-flash';
const cap = (value, length) => String(value || '').slice(0, length);
const prompt = await fs.readFile(path.join(here, 'planner-prompt.md'), 'utf8');
const input = {
  pr: request.number, sha: request.sha,
  title: cap(request.title, 500), body: cap(request.body, 6000),
  diff: cap(request.diff, 100000), codeContext: cap(request.codeContext, 24000),
  outlines: cap(JSON.stringify(inspection.outlines), 60000),
};
if (failureFile) input.previousAttempt = cap(await fs.readFile(failureFile, 'utf8'), 30000);
const response = await fetch(url, {
  method: 'POST', signal: AbortSignal.timeout(120000),
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, temperature: 0, max_tokens: 6000, response_format: { type: 'json_object' }, messages: [
    { role: 'system', content: prompt },
    { role: 'user', content: JSON.stringify(input) },
  ] }),
});
if (!response.ok) throw new Error(`Planner request failed (HTTP ${response.status})`);
const data = await response.json();
const plan = validatePlan(JSON.parse(data.choices?.[0]?.message?.content || 'null'));
const serialized = JSON.stringify(plan, null, 2);
if (serialized.includes(key)) throw new Error('Refusing plan containing a credential');
await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, serialized);
console.log(`PR #${request.number} ${request.sha.slice(0,12)}: ${plan.scenes.length} planned scenes, model ${model}`);
