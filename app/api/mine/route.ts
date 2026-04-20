import { NextResponse } from "next/server";

const DEFAULT_RPC = "http://127.0.0.1:8545";
/** Max blocks for a single JSON body `{ blocks: n }` request. */
const MAX_BLOCKS_DIRECT = 50_000;
/** When mining by `days`, total blocks are chunked; cap avoids runaway work. */
const MAX_BLOCKS_FROM_DAYS = 2_000_000;
const CHUNK = 25_000;
const SECONDS_PER_DAY = 86_400;

function blockTimeSeconds(): number {
	const raw = process.env.BLOCK_TIME_SECONDS;
	if (raw === undefined || raw === "") return 12;
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) return 12;
	return n;
}

function daysToBlocks(days: number): number {
	const bt = blockTimeSeconds();
	const raw = (days * SECONDS_PER_DAY) / bt;
	return Math.max(1, Math.ceil(raw));
}

function toHexQuantity(n: number): string {
	const i = Math.max(1, Math.round(n));
	return `0x${i.toString(16)}`;
}

/**
 * @param intervalSeconds Hardhat's 2nd param: seconds between each mined block's
 *   timestamp (default in Hardhat is 1, which makes "days" only advance ~blocks×1s).
 */
async function hardhatMine(
	url: string,
	blocks: number,
	intervalSeconds?: number,
): Promise<void> {
	const hexBlocks = `0x${blocks.toString(16)}`;
	const params =
		intervalSeconds !== undefined
			? [hexBlocks, toHexQuantity(intervalSeconds)]
			: [hexBlocks];
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "hardhat_mine",
			params,
		}),
	});
	const data = (await res.json()) as {
		result?: unknown;
		error?: { message: string };
	};
	if (data.error) {
		throw new Error(data.error.message);
	}
}

async function mineBlocksChunked(
	url: string,
	total: number,
	intervalSeconds: number,
): Promise<void> {
	let left = total;
	while (left > 0) {
		const n = Math.min(left, CHUNK);
		await hardhatMine(url, n, intervalSeconds);
		left -= n;
	}
}

export async function POST(request: Request) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	if (typeof body !== "object" || body === null) {
		return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	}

	const b = body as Record<string, unknown>;
	const hasBlocks = "blocks" in b;
	const hasDays = "days" in b;

	if (hasBlocks === hasDays) {
		return NextResponse.json(
			{ error: "Send exactly one of: blocks (integer), days (number)" },
			{ status: 400 },
		);
	}

	const url = process.env.RPC_URL ?? DEFAULT_RPC;
	let totalBlocks: number;

	if (hasBlocks) {
		const blocks = b.blocks;
		if (
			typeof blocks !== "number" ||
			!Number.isInteger(blocks) ||
			blocks < 1 ||
			blocks > MAX_BLOCKS_DIRECT
		) {
			return NextResponse.json(
				{
					error: `blocks must be an integer from 1 to ${MAX_BLOCKS_DIRECT}`,
				},
				{ status: 400 },
			);
		}
		totalBlocks = blocks;
		try {
			await hardhatMine(url, totalBlocks);
		} catch (e) {
			const message = e instanceof Error ? e.message : "Mine failed";
			return NextResponse.json({ error: message }, { status: 502 });
		}
		return NextResponse.json({ ok: true, blocksMined: totalBlocks });
	}

	const days = b.days;
	if (typeof days !== "number" || !Number.isFinite(days) || days <= 0) {
		return NextResponse.json(
			{ error: "days must be a finite number > 0" },
			{ status: 400 },
		);
	}

	totalBlocks = daysToBlocks(days);
	if (totalBlocks > MAX_BLOCKS_FROM_DAYS) {
		return NextResponse.json(
			{
				error: `That span maps to ${totalBlocks} blocks (cap ${MAX_BLOCKS_FROM_DAYS}). Lower days or raise BLOCK_TIME_SECONDS.`,
			},
			{ status: 400 },
		);
	}

	const bt = blockTimeSeconds();
	try {
		await mineBlocksChunked(url, totalBlocks, bt);
	} catch (e) {
		const message = e instanceof Error ? e.message : "Mine failed";
		return NextResponse.json({ error: message }, { status: 502 });
	}

	return NextResponse.json({
		ok: true,
		blocksMined: totalBlocks,
		assumedBlockTimeSeconds: bt,
	});
}
