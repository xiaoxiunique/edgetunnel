#!/usr/bin/env node

import fs from 'node:fs/promises';
import net from 'node:net';
import tls from 'node:tls';

const COLO_REGIONS = {
	HKG: '香港',
	NRT: '日本',
	HND: '日本',
	KIX: '日本',
	FUK: '日本',
	SIN: '新加坡',
	TPE: '台湾',
	ICN: '韩国',
	LAX: '美国',
	SJC: '美国',
	SEA: '美国',
	DFW: '美国',
	ORD: '美国',
	IAD: '美国',
	EWR: '美国',
};

const args = parseArgs(process.argv.slice(2));
if (!args.host) {
	console.error('Usage: node scripts/probe-cf-ips.mjs --host <domain> --input <ip-file> [--ports 443,8443] [--regions 香港,日本,新加坡] [--limit-per-region 4]');
	process.exit(1);
}

const ports = splitList(args.ports || '443').map(Number).filter(Number.isInteger);
const wantedRegions = new Set(splitList(args.regions || '香港,新加坡,日本'));
const limitPerRegion = Math.max(1, Number.parseInt(args['limit-per-region'] || '4', 10));
const timeout = Math.max(500, Number.parseInt(args.timeout || '3000', 10));
const concurrency = Math.max(1, Number.parseInt(args.concurrency || '16', 10));
const ips = await loadIPs(args.input);
const jobs = ips.flatMap(ip => ports.map(port => ({ ip, port })));
const regionCounts = new Map();
const output = [];

await runPool(jobs, concurrency, async ({ ip, port }) => {
	const result = await probe(ip, port, args.host, timeout).catch(error => ({ ip, port, error: error.message }));
	if (!result.colo) return;
	const region = COLO_REGIONS[result.colo] || result.loc || '其他';
	if (!wantedRegions.has(region)) return;
	const count = regionCounts.get(region) || 0;
	if (count >= limitPerRegion) return;
	regionCounts.set(region, count + 1);
	output.push({ ...result, region, index: count + 1 });
});

output.sort((a, b) => String(a.region).localeCompare(String(b.region), 'zh-Hans-CN') || a.index - b.index);
for (const item of output) {
	console.log(`${item.ip}:${item.port}#${item.region} CF优选${item.index}`);
}

async function loadIPs(file) {
	const text = file ? await fs.readFile(file, 'utf8') : await readStdin();
	return [...new Set(text
		.split(/\r?\n|,|\s+/)
		.map(line => line.trim())
		.filter(Boolean)
		.map(line => line.split('#')[0].replace(/^\[/, '').replace(/\]$/, '').split(':')[0])
		.filter(ip => net.isIP(ip) === 4))];
}

function probe(ip, port, host, timeout) {
	return new Promise((resolve, reject) => {
		const started = Date.now();
		const socket = tls.connect({
			host: ip,
			port,
			servername: host,
			rejectUnauthorized: false,
			timeout,
		});
		let data = '';
		socket.setTimeout(timeout);
		socket.once('secureConnect', () => {
			socket.write(`GET /cdn-cgi/trace HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: edgetunnel-probe\r\nConnection: close\r\n\r\n`);
		});
		socket.on('data', chunk => {
			data += chunk.toString('utf8');
		});
		socket.once('timeout', () => {
			socket.destroy();
			reject(new Error('timeout'));
		});
		socket.once('error', reject);
		socket.once('close', () => {
			const body = data.split('\r\n\r\n').slice(1).join('\r\n\r\n');
			const trace = Object.fromEntries(body.split(/\r?\n/).map(line => line.split('=')).filter(parts => parts.length === 2));
			if (!trace.colo) return reject(new Error('missing colo'));
			resolve({ ip, port, colo: trace.colo, loc: trace.loc, latency: Date.now() - started });
		});
	});
}

async function runPool(items, limit, worker) {
	let cursor = 0;
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (cursor < items.length) {
			const item = items[cursor++];
			await worker(item);
		}
	}));
}

function parseArgs(argv) {
	const parsed = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg.startsWith('--')) continue;
		const key = arg.slice(2);
		const next = argv[i + 1];
		parsed[key] = next && !next.startsWith('--') ? argv[++i] : 'true';
	}
	return parsed;
}

function splitList(value) {
	return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function readStdin() {
	return new Promise(resolve => {
		let data = '';
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', chunk => data += chunk);
		process.stdin.on('end', () => resolve(data));
	});
}
