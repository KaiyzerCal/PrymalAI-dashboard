#!/usr/bin/env node
// Catch-rate eval runner. Hits the deployed prymal-chat with the internal key
// against a dedicated eval client, scores replies with the regexes in
// scenarios.json, prints a scoreboard, exits non-zero below the threshold.
//
// Required env:
//   EVAL_FUNCTION_URL   e.g. https://<ref>.supabase.co/functions/v1/prymal-chat
//   INTERNAL_FUNCTION_SECRET
//   EVAL_CLIENT_ID      a real prymal_clients.id set up as the eval account
// Optional:
//   EVAL_THRESHOLD      pass rate 0-1 to exit 0 (default 0.85)
//   EVAL_ONLY           comma-separated scenario ids
//
// Usage: node evals/run.mjs        (add --dry to list scenarios without calling)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { scenarios } = JSON.parse(
	readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'scenarios.json'), 'utf8')
);

const dry = process.argv.includes('--dry');
const only = (process.env.EVAL_ONLY ?? '').split(',').filter(Boolean);
const list = only.length ? scenarios.filter(s => only.includes(s.id)) : scenarios;

if (dry) {
	for (const s of list) console.log(`${s.id.padEnd(30)} ${s.goal}`);
	process.exit(0);
}

const URL_ = process.env.EVAL_FUNCTION_URL;
const KEY = process.env.INTERNAL_FUNCTION_SECRET;
const CLIENT = process.env.EVAL_CLIENT_ID;
if (!URL_ || !KEY || !CLIENT) {
	console.error('Set EVAL_FUNCTION_URL, INTERNAL_FUNCTION_SECRET, EVAL_CLIENT_ID');
	process.exit(2);
}

const results = [];
for (const s of list) {
	const started = Date.now();
	let reply = '';
	let error = null;
	try {
		const res = await fetch(URL_, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-internal-key': KEY },
			body: JSON.stringify({
				client_id: CLIENT,
				message: s.message,
				history: [],
				channel: s.channel ?? 'web',
			}),
		});
		const data = await res.json();
		reply = String(data.reply ?? data.error ?? '');
		if (!res.ok) error = `HTTP ${res.status}: ${reply.slice(0, 120)}`;
	} catch (e) {
		error = String(e);
	}

	const failures = [];
	if (error) failures.push(error);
	for (const rx of s.expect ?? []) {
		if (!new RegExp(rx, 'i').test(reply)) failures.push(`missing expected /${rx}/`);
	}
	for (const rx of s.reject ?? []) {
		if (new RegExp(rx, 'i').test(reply)) failures.push(`matched rejected /${rx}/`);
	}
	if (s.maxChars && reply.length > s.maxChars) {
		failures.push(`reply ${reply.length} chars > max ${s.maxChars}`);
	}

	const pass = failures.length === 0;
	results.push({ id: s.id, pass, failures, ms: Date.now() - started, reply });
	console.log(`${pass ? 'PASS' : 'FAIL'}  ${s.id.padEnd(30)} ${results.at(-1).ms}ms${pass ? '' : '  — ' + failures.join('; ')}`);
	if (!pass) console.log(`      reply: ${reply.slice(0, 200).replace(/\n/g, ' ')}`);
}

const passed = results.filter(r => r.pass).length;
const rate = passed / results.length;
const threshold = Number(process.env.EVAL_THRESHOLD ?? 0.85);
console.log(`\nCatch rate: ${passed}/${results.length} (${(rate * 100).toFixed(0)}%) — threshold ${(threshold * 100).toFixed(0)}%`);
process.exit(rate >= threshold ? 0 : 1);
