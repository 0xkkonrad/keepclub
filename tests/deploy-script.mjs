/* The Pages copier uses rsync --delete, so its repository preflight is a data
 * safety boundary. Exercise the refusals in disposable repositories without
 * touching the real deployment checkout. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = new URL('../scripts/deploy-to-keepclub.sh', import.meta.url).pathname;
const passed = [], failed = [];
const ok = (condition, message) =>
  (condition ? passed : failed).push((condition ? 'PASS  ' : 'FAIL  ') + message);
const run = (command, cwd) => {
  const result = spawnSync(command[0], command.slice(1), {
    cwd,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${command.join(' ')}\n${result.stdout}${result.stderr}`);
  }
  return result;
};
const deploy = (site, ...args) => spawnSync('bash', [SCRIPT, ...args], {
  encoding: 'utf8',
  env: { ...process.env, SITE: site },
});

const root = mkdtempSync(join(tmpdir(), 'keepclub-deploy-'));
try {
  const makeSite = (name, remote = 'https://github.com/0xkkonrad/keepclub-pages.git') => {
    const site = join(root, name);
    run(['git', 'init', '-q', '-b', 'main', site], root);
    run(['git', 'config', 'user.email', 'qa@example.invalid'], site);
    run(['git', 'config', 'user.name', 'QA'], site);
    writeFileSync(join(site, 'sentinel.txt'), 'keep me\n');
    run(['git', 'add', 'sentinel.txt'], site);
    run(['git', 'commit', '-q', '-m', 'baseline'], site);
    run(['git', 'remote', 'add', 'origin', remote], site);
    run(['git', 'update-ref', 'refs/remotes/origin/main', 'HEAD'], site);
    return site;
  };

  {
    const site = makeSite('wrong-branch');
    run(['git', 'switch', '-q', '-c', 'feature'], site);
    const result = deploy(site);
    ok(result.status !== 0 && /must be on main/.test(result.stdout + result.stderr),
      'deployment refuses a Pages feature branch before copying');
    ok(run(['git', 'status', '--porcelain'], site).stdout === '',
      'the wrong-branch refusal leaves the Pages checkout untouched');
  }

  {
    const site = makeSite('dirty');
    writeFileSync(join(site, 'sentinel.txt'), 'uncommitted work\n');
    const result = deploy(site);
    ok(result.status !== 0 && /uncommitted work/.test(result.stdout + result.stderr),
      'deployment refuses dirty Pages work before rsync --delete');
    ok(run(['git', 'diff', '--', 'sentinel.txt'], site).stdout.includes('uncommitted work'),
      'the dirty-tree refusal preserves the existing edit');
  }

  {
    const site = makeSite('wrong-remote', 'https://github.com/example/not-keepclub.git');
    const result = deploy(site);
    ok(result.status !== 0 && /site origin/.test(result.stdout + result.stderr),
      'deployment refuses an unexpected repository remote');
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log([...passed, ...failed].join('\n'));
console.log(`\n${passed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
