// Run: node scripts/guard-regression.cjs <path-to-guard>
// Commands below are inert JSON fixtures passed to the guard, never executed.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const target = process.argv[2];
if (!target) throw new Error('Provide the guard file to test');
const bash = command => ({ tool_name: 'Bash', tool_input: { command } });
const file = (tool_name, file_path, content = '') => ({ tool_name, tool_input: { file_path, content } });
const cases = [
  ['ordinary command', bash('git status --short'), 'allow'],
  ['documentation content', file('Write', 'docs/config.md', 'Read .env; echo $SUPABASE_SERVICE_ROLE_KEY'), 'allow'],
  ['test fixture content', file('Write', 'scripts/example.test.js', 'const fixture = "echo $SUPABASE_SERVICE_ROLE_KEY";'), 'allow'],
  ['quoted documentation heredoc', bash("cat > docs/config.md <<'DOC'\nDiscuss .env and SENTRY_AUTH_TOKEN names.\nDOC"), 'allow'],
  ['literal variable name', bash("echo 'SENTRY_AUTH_TOKEN'"), 'allow'],
  ['read credential file', file('Read', '.env'), 'block'],
  ['write credential file', file('Write', '.env.local', 'SYNTHETIC=value'), 'block'],
  ['read template', file('Read', '.env.example'), 'allow'],
  ['write template', file('Write', '.env.example', 'NAME='), 'allow'],
  ['shell read credentials', bash('cat .env'), 'block'],
  ['print secret variable', bash('echo $SUPABASE_SERVICE_ROLE_KEY'), 'block'],
  ['names extraction', bash("grep -o '^[A-Z_]*=' .env"), 'allow'],
  ['names extraction followed by dump', bash("grep -o '^[A-Z_]*=' .env; cat .env"), 'block'],
  ['force push deploy', bash('git push --force origin master'), 'block'],
  ['remote destructive SQL', bash('psql --db-url REMOTE -c "DROP TABLE synthetic_fixture"'), 'block'],
  ['ordinary push asks', bash('git push origin feature'), 'ask'],
  ['OTA asks', bash('eas update --branch preview'), 'ask'],
  ['malformed JSON fails closed', '{', 'block'],
  ['null payload fails closed', 'null', 'block'],
  ['missing tool fails closed', { tool_input: {} }, 'block'],
  ['missing command fails closed', { tool_name: 'Bash', tool_input: {} }, 'block'],
  ['invalid command fails closed', bash(42), 'block'],
  ['missing file path fails closed', file('Write', ''), 'block'],
  ['unclosed quote fails closed', bash("echo 'unfinished"), 'block'],
  ['documentation edit', file('Edit', 'docs/config.md', 'cat .env; git push --force origin master'), 'allow'],
  ['unrelated input description', { ...bash('git status'), description: 'cat .env; printenv' }, 'allow'],
  ['literal documentation argument', bash("echo 'cat .env; printenv; git push --force origin master'"), 'allow'],
  ['literal dollar name', bash("echo '$SENTRY_AUTH_TOKEN'"), 'allow'],
  ['double quoted secret expands', bash('echo "$SENTRY_AUTH_TOKEN"'), 'block'],
  ['printf secret argument', bash('printf "%s" "$SENTRY_AUTH_TOKEN"'), 'block'],
  ['braced secret variable', bash('echo "${SENTRY_AUTH_TOKEN}"'), 'block'],
  ['powershell secret variable', bash('Write-Output $env:SENTRY_AUTH_TOKEN'), 'block'],
  ['escaped dollar name', bash('echo \\$SENTRY_AUTH_TOKEN'), 'allow'],
  ['environment dump', bash('printenv'), 'block'],
  ['environment command dump', bash('env'), 'block'],
  ['environment consumer', bash('env MODE=test node scripts/check.js'), 'allow'],
  ['secret consumer', bash('curl -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" https://example.invalid'), 'allow'],
  ['quoted credential path', bash('cat "config/.env.local"'), 'block'],
  ['credential template suffix is not exempt', file('Read', '.env.example.local'), 'block'],
  ['dotenv in directory name', file('Write', '.env-notes/readme.txt'), 'allow'],
  ['template through shell', bash('cat .env.example'), 'allow'],
  ['template write through shell', bash("echo 'NAME=' > .env.example"), 'allow'],
  ['credential output redirection', bash("echo 'SYNTHETIC=value' > .env"), 'block'],
  ['credential input redirection', bash('cat < .env'), 'block'],
  ['credential tee', bash("echo 'SYNTHETIC=value' | tee .env"), 'block'],
  ['names extraction followed by pipe reader', bash("grep -o '^[A-Z_]*=' .env | cat .env"), 'block'],
  ['names extraction followed by newline reader', bash("grep -o '^[A-Z_]*=' .env\ncat .env"), 'block'],
  ['unsafe extraction pattern', bash("grep -o '^.*=' .env"), 'block'],
  ['substitution reads credentials', bash('echo "$(cat .env)"'), 'block'],
  ['assignment substitution reads credentials', bash('VALUE=$(cat .env)'), 'block'],
  ['backtick reads credentials', bash('echo `cat .env`'), 'block'],
  ['shell wrapper reads credentials', bash("bash -c 'cat .env'"), 'block'],
  ['eval reads credentials', bash("eval 'cat .env'"), 'block'],
  ['command wrapper reads credentials', bash('command cat .env'), 'block'],
  ['assignment prefix reads credentials', bash('MODE=test cat .env'), 'block'],
  ['fixture heredoc', bash("cat > scripts/fixture.js <<'DOC'\nconst fixture = 'echo $SENTRY_AUTH_TOKEN';\nDOC"), 'allow'],
  ['CRLF heredoc', bash("cat > docs/config.md <<'DOC'\r\ncat .env\r\nDOC\r\n"), 'allow'],
  ['double quoted delimiter', bash('cat > docs/config.md <<"DOC"\ncat .env\nDOC'), 'allow'],
  ['tab stripped heredoc', bash("cat > docs/config.md <<-'DOC'\n\tcat .env\n\tDOC"), 'allow'],
  ['heredoc credential destination', bash("cat > .env <<'DOC'\nSYNTHETIC=value\nDOC"), 'block'],
  ['reader after heredoc', bash("cat > docs/config.md <<'DOC'\nDocumentation\nDOC\ncat .env"), 'block'],
  ['shell heredoc executes', bash("bash <<'DOC'\ncat .env\nDOC"), 'block'],
  ['unquoted heredoc expansion', bash('cat <<DOC\n$SENTRY_AUTH_TOKEN\nDOC'), 'block'],
  ['unterminated heredoc', bash("cat <<'DOC'\nDocumentation"), 'block'],
  ['dry run push allowed', bash('git push --dry-run origin feature'), 'allow'],
  ['prior dry run does not exempt push', bash('git push --dry-run origin feature; git push origin feature'), 'ask'],
  ['force push wrapped shell', bash("sh -c 'git push --force origin production'"), 'block'],
  ['build asks', bash('eas build --platform android'), 'ask'],
  ['remote deploy asks', bash('supabase functions deploy example'), 'ask'],
  ['local reset allowed', bash('supabase db reset'), 'allow'],
  ['new dependency asks', bash('npm install example-package'), 'ask'],
  ['dependency restore allowed', bash('npm ci'), 'allow'],
  ['conditional credential read', bash('if true; then cat .env; fi'), 'block'],
  ['grouped credential read', bash('{ cat .env; }'), 'block'],
  ['absolute reader', bash('/usr/bin/cat .env'), 'block'],
  ['heredoc piped to interpreter', bash("cat <<'DOC' | bash\ncat .env\nDOC"), 'block'],
  ['interpreter heredoc piped to reader', bash("bash <<'DOC' | cat\ncat .env\nDOC"), 'block'],
  ['notebook credential read', { tool_name: 'NotebookRead', tool_input: { notebook_path: '.env' } }, 'block'],
  ['notebook ordinary edit', { tool_name: 'NotebookEdit', tool_input: { notebook_path: 'notes.ipynb', new_source: 'cat .env' } }, 'allow'],
];
let failures = 0;
for (const [name, payload, expected] of cases) {
  const result = spawnSync(process.execPath, [path.resolve(target)], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8', timeout: 5000,
  });
  let actual = result.status === 2 ? 'block' : result.status === 0 ? 'allow' : 'error';
  if (actual === 'allow' && result.stdout.trim()) {
    try {
      if (JSON.parse(result.stdout).hookSpecificOutput?.permissionDecision === 'ask') actual = 'ask';
    } catch { actual = 'invalid-output'; }
  }
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: expected ${expected}, got ${actual}`);
}
console.log(`${cases.length - failures}/${cases.length} passed`);
process.exitCode = failures ? 1 : 0;
