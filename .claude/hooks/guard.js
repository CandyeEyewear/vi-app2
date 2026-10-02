#!/usr/bin/env node
/**
 * PreToolUse guard for vi-app2 (VIbe).
 *
 * Design intent: DO by default, ASK for anything that leaves this machine,
 * NEVER for the small set with no legitimate agent use. The agent should be
 * able to work normally. A guard that blocks ordinary work gets disabled,
 * and a disabled guard protects nothing.
 *
 * Protocol (Claude Code hooks):
 *   - tool call arrives as JSON on stdin
 *   - exit 0  => allow, continue through the normal permission flow
 *   - exit 2  => BLOCK; stderr is shown to Claude as the reason
 *   - exit 1  => does NOT block. Never use it here.
 *   - decision "ask" => emit a PreToolUse permissionDecision on stdout and
 *     exit 0, so the user confirms at the moment of use.
 *
 * An ask rule still prompts even when a matching permissions.allow entry
 * exists: the allow entry silences the normal prompt, and this hook re-raises
 * it. That is how `Bash(git push:*)` in settings.local.json is neutralised
 * without editing that file.
 *
 * Failure behaviour is deliberately split:
 *   - CRITICAL rules are checked first, against validated operation fields, and
 *     fail CLOSED. If that check itself errors, the call is blocked.
 *   - Everything else fails OPEN. A broken guard must not wedge the session.
 *
 * Why this repo needs one at all:
 *   .github/workflows/ota-update.yml fires on push to master and runs
 *   `eas update`. VIbe is live on Google Play. The path from a local commit
 *   to code on volunteers' phones has no human gate in it.
 */

'use strict';

let commandsOf;

function readStdin() {
  const fs = require('fs');
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    throw new Error('Cannot read hook input');
  }
}

function block(reason) {
  process.stderr.write(reason + '\n');
  process.exit(2);
}

function ask(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

function allow() {
  process.exit(0);
}

/* ------------------------------------------------------------------ *
 * CRITICAL — checked against operation fields, fails CLOSED.
 * Four rules. No legitimate agent use for any of them.
 * ------------------------------------------------------------------ */

const CRITICAL = [
  {
    reason:
      'BLOCKED: this would print a secret value into the transcript. ' +
      'Transcripts get pasted and shared. List key NAMES if you need them ' +
      "(e.g. grep -o '^[A-Z_]*=' .env), or run the command that consumes the " +
      'credential directly — tools can read env vars without you seeing them.',
  },
  {
    reason:
      'BLOCKED: writing to .env. Credentials are managed outside the repo. ' +
      'Use `npx expo env` / EAS environment variables, or edit it yourself.',
  },
  {
    // 3. Force-push or history rewrite on the deploy branches.
    test: (s) =>
      /git\s+push[^"]*(--force|-f\b)/i.test(s) &&
      /(master|main|production)/i.test(s),
    reason:
      'BLOCKED: force-push to a deploy branch. master triggers eas update ' +
      'to preview; production reaches installed apps. Rewriting that history ' +
      'is not recoverable from the remote.',
  },
  {
    // 4. Destructive SQL against the REMOTE database.
    // Local resets are fine and handled below — this is remote only.
    test: (s) =>
      /(drop\s+table|drop\s+schema|truncate\s+table|truncate\s+\w|delete\s+from\s+\w+\s*(;|$|")|delete\s+from\s+(?![^"]*\bwhere\b))/i.test(
        s
      ) && /(supabase\s+db\s+push|--linked|--db-url|psql\s+.*(supabase\.co|postgres:\/\/(?!localhost|127\.0\.0\.1)))/i.test(s),
    reason:
      'BLOCKED: destructive SQL against the remote database. VIbe is live — ' +
      'this data belongs to real volunteers and donors. Write a reversible ' +
      'migration instead, or run it yourself against a verified target.',
  },
];

/* ------------------------------------------------------------------ *
 * ASK — leaves this machine, or costs money. Prompt, do not block.
 * ------------------------------------------------------------------ */

const ASK = [
  {
    test: (c) => /git\s+push\b/i.test(c) && !/--dry-run/i.test(c),
    reason:
      'git push. Pushing to master fires .github/workflows/ota-update.yml, ' +
      'which runs `eas update`. Pushing to production reaches installed apps ' +
      'on Google Play. Confirm the branch is what you intend.',
  },
  {
    test: (c) => /\beas\s+update\b/i.test(c),
    reason:
      'eas update publishes an OTA bundle. VIbe is live on Google Play — ' +
      'this reaches volunteers\' installed apps without an app-store review.',
  },
  {
    test: (c) => /\beas\s+build\b/i.test(c),
    reason: 'eas build consumes build credits and can produce a store artifact.',
  },
  {
    test: (c) =>
      /git\s+tag\s+.*v\d/i.test(c) || /git\s+push\s+.*--tags/i.test(c),
    reason:
      'A v* tag triggers .github/workflows/build.yml and produces a ' +
      'production Android AAB.',
  },
  {
    test: (c) => /supabase\s+functions\s+deploy/i.test(c),
    reason:
      'Deploying an Edge Function to the live project. The HubSpot signup ' +
      'pipeline and eZeePayments donation flow run through these.',
  },
  {
    test: (c) => /supabase\s+db\s+push/i.test(c) || /supabase\s+link/i.test(c),
    reason: 'This targets the remote Supabase project, not local.',
  },
  {
    test: (c) =>
      /npm\s+(install|i|add)\s+(?!$)(?!--)[a-z@]/i.test(c) &&
      !/npm\s+(install|i)\s*$/i.test(c),
    reason:
      'Installing a new dependency. Worth a look at what it is and who ' +
      'publishes it before it enters the bundle.',
  },
  {
    test: (c) =>
      /\b(rm|Remove-Item|rimraf)\b/i.test(c) &&
      /(-rf?\b|-Recurse)/i.test(c) &&
      !/(node_modules|\.expo|\.next|dist|build|coverage|\.metro-health-check)/i.test(
        c
      ),
    reason: 'Recursive delete outside the usual build artifact folders.',
  },
];

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

const READ_TOOLS = /^(Read|NotebookRead)$/;
const WRITE_TOOLS = /^(Write|Edit|MultiEdit|NotebookEdit)$/;
const READERS = /^(cat|type|less|more|head|tail|Get-Content|gc|grep|rg|findstr|Select-String|awk|sed|nl|od|xxd|strings|sort|uniq)$/i;
const WRITERS = /^(Set-Content|Add-Content|Out-File|tee)$/i;
const SECRET_EXPANSION = /\$(?:\{)?(?:env:)?[A-Za-z_][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Za-z0-9_]*|\$(?:\{)?(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)\b|%[A-Za-z_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Za-z0-9_]*%/i;

function credentialPath(value) {
  const name = value.replace(/\\/g, '/').split('/').pop();
  return /^\.env/i.test(name) && !/^\.env\.(example|sample|template|dist)$/i.test(name);
}

function validate(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.tool_name !== 'string' || !payload.tool_name ||
      !payload.tool_input || typeof payload.tool_input !== 'object' || Array.isArray(payload.tool_input)) {
    throw new Error('Invalid hook payload');
  }
  return payload;
}

function criticalReason(payload, commands) {
  const { tool_name: tool, tool_input: input } = payload;
  if (READ_TOOLS.test(tool) || WRITE_TOOLS.test(tool)) {
    const paths = ['file_path', 'notebook_path', 'path', 'filePath']
      .filter(key => input[key] !== undefined).map(key => input[key]);
    if (!paths.length || paths.some(p => typeof p !== 'string' || !p)) throw new Error('Missing file target');
    if (paths.some(credentialPath)) return CRITICAL[READ_TOOLS.test(tool) ? 0 : 1].reason;
  }
  for (const tokens of commands) {
    const argv = tokens.map(t => t.value);
    const executable = argv[0];
    const text = argv.join(' ');
    const expansion = tokens.map(t => t.active).join(' ');
    if (/^(echo|printf|Write-Host|Write-Output)$/i.test(executable) && SECRET_EXPANSION.test(expansion) ||
        /^printenv$/i.test(executable) ||
        /^Get-ChildItem$/i.test(executable) && argv.some(a => /^Env:/i.test(a)) ||
        executable === 'env' && argv.length === 1) return CRITICAL[0].reason;

    // Exact names-only form, scoped to this command. Do not exempt a pipeline,
    // subsequent command, arbitrary regex, or extra option such as --passthru.
    const namesOnly = executable === 'grep' && argv.length === 4 && argv[1] === '-o' &&
      argv[2] === '^[A-Z_]*=' && credentialPath(argv[3]);
    const targets = argv.slice(1).filter(credentialPath);
    if (targets.length && READERS.test(executable) && !namesOnly) return CRITICAL[0].reason;
    for (let i = 0; i < argv.length; i++) {
      if (/^(>|>>|<)$/.test(argv[i]) && argv[i + 1] && credentialPath(argv[i + 1])) {
        return CRITICAL[argv[i] === '<' ? 0 : 1].reason;
      }
    }
    if (targets.length && (WRITERS.test(executable) || executable === 'sed' && argv.some(a => /^-i/.test(a)))) {
      return CRITICAL[1].reason;
    }
    // SQL arguments are intentionally retained: they are executable input,
    // unlike the contents of a Write/Edit document or a literal cat heredoc.
    if (executable === 'git' && CRITICAL[2].test(text)) return CRITICAL[2].reason;
    if (/^(psql|supabase)$/.test(executable) && CRITICAL[3].test(text)) return CRITICAL[3].reason;
  }
  return null;
}

function expandCommands(commands, depth = 0) {
  if (depth > 16) throw new Error('Shell nesting limit exceeded');
  const result = [];
  for (let tokens of commands) {
    while (tokens[0] && /^(if|then|elif|else|while|until|do|!|\{)$/.test(tokens[0].value)) tokens = tokens.slice(1);
    // Assignments and common launch wrappers do not hide the actual command.
    while (tokens[0] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0].value)) tokens = tokens.slice(1);
    while (tokens[0] && /^(command|exec|sudo)$/.test(tokens[0].value)) {
      tokens = tokens.slice(1);
      if (tokens[0]?.value.startsWith('-')) throw new Error('Unsupported shell wrapper options');
    }
    if (!tokens.length) continue;
    // Absolute executable paths have the same behavior as their bare names.
    tokens = tokens.map((token, index) => index === 0
      ? { ...token, value: token.value.replace(/\\/g, '/').split('/').pop().replace(/\.exe$/i, '') }
      : token);
    if (tokens[0].value === 'env' && tokens.length > 1) {
      const rest = tokens.slice(1);
      if (rest[0].value.startsWith('-')) throw new Error('Unsupported env options');
      result.push(...expandCommands([rest], depth + 1));
      continue;
    }
    result.push(tokens);
    if (/^(bash|sh|zsh)$/.test(tokens[0].value)) {
      const index = tokens.findIndex(t => /^-[a-z]*c[a-z]*$/.test(t.value));
      if (index >= 0 && tokens[index + 1]) result.push(...expandCommands(commandsOf(tokens[index + 1].value), depth + 1));
    }
    if (tokens[0].value === 'eval') result.push(...expandCommands(commandsOf(tokens.slice(1).map(t => t.value).join(' ')), depth + 1));
  }
  return result;
}

function main() {
  // Parsing, lexing and all critical checks fail closed. Never print the input
  // or parser exception: either may contain credentials from a malformed call.
  let commands;
  try {
    ({ commandsOf } = require('./guard-shell'));
    const payload = validate(JSON.parse(readStdin()));
    if (payload.tool_name === 'Bash' && typeof payload.tool_input.command !== 'string') throw new Error('Missing command');
    commands = payload.tool_name === 'Bash' ? expandCommands(commandsOf(payload.tool_input.command)) : [];
    const reason = criticalReason(payload, commands);
    if (reason) block(reason);
  } catch {
    block('BLOCKED: guard could not validate this operation. Check the tool payload or simplify the shell command.');
  }
  // Advisory checks retain fail-open behavior only after critical evaluation.
  try {
    for (const tokens of commands) {
      if (/^(echo|printf|Write-Host|Write-Output)$/.test(tokens[0].value)) continue;
      for (const rule of ASK) {
        if (rule.test(tokens.map(t => t.value).join(' '))) ask(rule.reason);
      }
    }
  } catch {
    allow();
  }
  allow();
}

main();
