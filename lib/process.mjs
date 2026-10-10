import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

export function hashText(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function redact(value = '') {
  return String(value)
    .replace(/(?:sk|pk|ghp|gho|github_pat|testmu)[-_][A-Za-z0-9_-]{12,}/gi, '[REDACTED]')
    .replace(/(access[-_ ]?key\s*[:=]\s*)\S+/gi, '$1[REDACTED]')
    .replace(/https?:\/\/test-manager\.lambdatest\.com\/[^\s"'<>]+/gi, '[REDACTED_URL]')
    .replace(/https?:\/\/[^\s"'<>]*\/(?:share|shared|evidence)\/[A-Za-z0-9_-]{24,}[^\s"'<>]*/gi, '[REDACTED_URL]')
    .replace(/https?:\/\/[^\s"']*(?:token|signature|secret)=[^\s"']*/gi, '[REDACTED_URL]')
    .slice(-12000);
}

export function runProcess(command, args, options = {}) {
  const { cwd, env, timeoutMs = 180_000, maxBytes = 1_500_000, onLine, shell = false } = options;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let timedOut = false;
    let overflow = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 1500).unref();
    }, timeoutMs);
    const collect = (which) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > maxBytes) {
        overflow = true;
        child.kill('SIGTERM');
        return;
      }
      const text = chunk.toString('utf8');
      if (which === 'stdout') {
        stdout += text;
        if (onLine) for (const line of text.split(/\r?\n/)) if (line.trim()) onLine(line);
      } else stderr += text;
    };
    child.stdout.on('data', collect('stdout'));
    child.stderr.on('data', collect('stderr'));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: null, signal: null, stdout: redact(stdout), stderr: redact(`${stderr}\n${error.message}`), timedOut, overflow, spawnError: error.message });
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal, stdout: redact(stdout), stderr: redact(stderr), timedOut, overflow });
    });
  });
}

export function parseNdjson(text) {
  const events = [];
  const malformed = [];
  for (const line of text.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean) continue;
    try {
      const event = JSON.parse(clean);
      if (event && typeof event === 'object') events.push(event);
    } catch {
      malformed.push(clean.slice(0, 400));
    }
  }
  const final = [...events].reverse().find((event) => event.type === 'run_end' || event.event === 'run_end') ?? null;
  const code = final?.result_code ?? final?.resultCode ?? final?.code ?? null;
  const status = String(final?.status ?? final?.result?.status ?? '').toLowerCase();
  const passed = final !== null && (code === 100 || code === '100' || status === 'passed' || status === 'pass') && code !== 710 && code !== '710';
  return {
    final,
    events: events.map((event) => ({ type: event.type ?? event.event ?? 'event', at: event.timestamp ?? event.time ?? null })),
    malformedCount: malformed.length,
    malformedSamples: malformed.slice(0, 2),
    passed,
    resultCode: code,
    reasonCode: final?.reason_code ?? final?.reasonCode ?? null,
    status: final?.status ?? (final ? (passed ? 'passed' : 'failed') : 'inconclusive'),
  };
}
