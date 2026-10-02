'use strict';

// A small lexer for the hook's command checks, not a shell interpreter or a
// security sandbox. Never execute input. Keep literal data separate from shell
// expansions, and inspect substitutions and command groups independently.
function commandsOf(source, depth = 0) {
  if (depth > 16) throw new Error('Shell nesting limit exceeded');
  source = source.replace(/\r\n/g, '\n');
  const commands = [];
  let words = [];
  let value = '';
  let active = '';
  let started = false;
  let quoted = false;
  let quote = '';
  let heredocs = [];
  let nextHeredoc = null;
  const word = () => {
    if (!started) return;
    const token = { value, active, quoted };
    words.push(token);
    if (nextHeredoc !== null) {
      heredocs.push({ delimiter: value, quoted, tabs: nextHeredoc, owner: words });
      nextHeredoc = null;
    }
    value = active = '';
    started = quoted = false;
  };
  const command = () => {
    word();
    if (words.length) commands.push(words);
    words = [];
  };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\\' && quote !== "'") {
      if (i + 1 >= source.length) throw new Error('Incomplete shell escape');
      if (quote === '"' && !/[\$`"\\\n]/.test(source[i + 1])) {
        value += ch;
        active += ch;
        continue;
      }
      const next = source[++i];
      if (next !== '\n') {
        value += next;
        // Escaped dollar signs are literal, not variable expansion.
        active += next === '$' ? ' ' : next;
        started = true;
      }
      continue;
    }
    if (ch === "'" && quote !== '"' || ch === '"' && quote !== "'") {
      if (quote === ch) quote = '';
      else { quote = ch; quoted = true; }
      started = true;
      continue;
    }
    if (quote !== "'" && (source.startsWith('$(', i) || ch === '`')) {
      const backtick = ch === '`';
      const start = i + (backtick ? 1 : 2);
      let end = start;
      let level = 1;
      let innerQuote = '';
      for (; end < source.length; end++) {
        const c = source[end];
        if (c === '\\') { end++; continue; }
        if (backtick) { if (c === '`') break; continue; }
        if (c === "'" || c === '"') {
          if (!innerQuote) innerQuote = c;
          else if (innerQuote === c) innerQuote = '';
          continue;
        }
        if (!innerQuote && c === '(') level++;
        if (!innerQuote && c === ')' && --level === 0) break;
      }
      if (end === source.length) throw new Error('Unterminated shell substitution');
      commands.push(...commandsOf(source.slice(start, end), depth + 1));
      value += '<substitution>';
      active += '<substitution>';
      started = true;
      i = end;
      continue;
    }
    if (!quote && ch === '#' && !started) {
      while (i + 1 < source.length && source[i + 1] !== '\n') i++;
      continue;
    }
    if (!quote && ch === '<' && source[i + 1] === '<') {
      word();
      if (source[i + 2] === '<') throw new Error('Use a quoted heredoc or a file tool instead of a here-string');
      const tabs = source[i + 2] === '-';
      words.push({ value: '<<', active: '<<', quoted: false });
      nextHeredoc = tabs;
      i += tabs ? 2 : 1;
      continue;
    }
    if (!quote && /[;|&()\r\n]/.test(ch)) {
      const header = words;
      command();
      if (ch === '\n' && heredocs.length) {
        for (const doc of heredocs) {
          if (doc.owner !== header) throw new Error('Compound heredoc headers require separate commands');
          const start = i + 1;
          let end = start;
          let found = false;
          while (end <= source.length) {
            const newline = source.indexOf('\n', end);
            const stop = newline < 0 ? source.length : newline;
            let line = source.slice(end, stop).replace(/\r$/, '');
            if (doc.tabs) line = line.replace(/^\t+/, '');
            if (line === doc.delimiter) { i = stop; found = true; break; }
            if (newline < 0) break;
            end = newline + 1;
          }
          if (!found) throw new Error('Unterminated heredoc');
          const body = source.slice(start, end);
          const executable = header[0]?.value;
          if (doc.quoted && /^(cat|tee)$/.test(executable)) {
            // These commands consume literal data. Their output destinations
            // remain in the header and are checked normally.
          } else if (/^(bash|sh|zsh)$/.test(executable)) {
            commands.push(...commandsOf(body, depth + 1));
          } else {
            // Do not guess about expansion or an interpreter's input language.
            throw new Error('Use a quoted cat/tee heredoc for literal documents');
          }
        }
        heredocs = [];
      }
      continue;
    }
    if (!quote && /\s/.test(ch)) { word(); continue; }
    if (!quote && /[<>]/.test(ch)) {
      word();
      let operator = ch;
      if (source[i + 1] === ch) { operator += ch; i++; }
      words.push({ value: operator, active: operator, quoted: false });
      continue;
    }
    started = true;
    value += ch;
    if (quote !== "'") active += ch;
  }
  if (quote || heredocs.length || nextHeredoc !== null) throw new Error('Incomplete shell command');
  command();
  return commands;
}

module.exports = { commandsOf };
