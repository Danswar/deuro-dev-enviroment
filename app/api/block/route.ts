import { NextResponse } from "next/server";

const DEFAULT_RPC = "http://127.0.0.1:8545";

export async function GET() {
	const url = process.env.RPC_URL ?? DEFAULT_RPC;
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "eth_getBlockByNumber",
				params: ["latest", false],
			}),
		});
		const data = (await res.json()) as {
			result?: { number?: string; timestamp?: string } | null;
			error?: { message: string };
		};
		if (data.error) {
			return NextResponse.json(
				{ error: data.error.message },
				{ status: 502 },
			);
		}
		const block = data.result;
		if (
			!block ||
			typeof block.number !== "string" ||
			typeof block.timestamp !== "string"
		) {
			return NextResponse.json(
				{ error: "Invalid RPC response" },
				{ status: 502 },
			);
		}
		const blockNumber = Number(BigInt(block.number));
		const timestamp = Number(BigInt(block.timestamp));
		return NextResponse.json({ blockNumber, timestamp });
	} catch (e) {
		const message = e instanceof Error ? e.message : "Unknown error";
		return NextResponse.json({ error: message }, { status: 503 });
	}
}
