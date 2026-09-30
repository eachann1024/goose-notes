import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import YAML from 'yaml';

const workflow = YAML.parse(readFileSync(new URL('../../.github/workflows/desktop-build.yml', import.meta.url), 'utf8'));
assert.deepEqual(workflow.on.schedule, [{ cron: '0 7 */2 * *', timezone: 'Asia/Shanghai' }]);
assert.equal(Object.hasOwn(workflow.on, 'workflow_dispatch'), true);
assert.equal(Object.hasOwn(workflow.on, 'push'), false);
for (const job of ['source', 'build']) assert.equal(workflow.jobs[job].if, "needs.prepare.outputs.publish == 'true'");

const script = workflow.jobs.prepare.steps[0].run;
const dir = mkdtempSync(join(tmpdir(), 'goose-release-cadence-'));
try {
  for (const [event, latest, expected] of [
    ['schedule', 'v10.0.0-abcdef0', 'false'],
    ['schedule', 'v9.9.3-1234567', 'true'],
    ['workflow_dispatch', 'v10.0.0-abcdef0', 'true'],
  ]) {
    const output = join(dir, 'output');
    writeFileSync(output, '');
    const result = spawnSync('bash', ['-e', '-c', `gh() { echo '${latest}'; }\n${script}`], {
      env: { ...process.env, GITHUB_EVENT_NAME: event, GITHUB_SHA: 'abcdef0123456789', GITHUB_OUTPUT: output },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, 'utf8').trim(), `publish=${expected}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
