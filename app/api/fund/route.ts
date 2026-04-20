import {
	decodeFunctionResult,
	encodeAbiParameters,
	encodeFunctionData,
	erc20Abi,
	isAddress,
	keccak256,
	parseEther,
	parseUnits,
	pad,
	toHex,
	type Address,
	type Hex,
} from "viem";
import { NextResponse } from "next/server";

const DEFAULT_RPC = "http://127.0.0.1:8545";
const MAX_AMOUNT = 1_000_000;

/** ERC-20 Transfer(address indexed from, address indexed to, uint256 value) */
const TRANSFER_EVENT_TOPIC =
	"0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as const;

const LOG_CHUNK_BLOCKS = 100_000n;
const LOG_MAX_CHUNKS = 8;
const LOG_MAX_UNIQUE_RECIPIENTS = 250;
const MAX_MAPPING_SLOT_SCAN = 128n;

/** Tried first on forked mainnet (CEX / known large holders). */
const COMMON_ERC20_SOURCE_ACCOUNTS: Address[] = [
	"0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549",
	"0xF977814e90dA44bFA03b6295A0616a897441aceC",
	"0x9696f59e4d72e237be84ffd425dcad154bf96976",
	"0x28C6c06298d432Db0886556159476d915C0cFcA4",
	"0xBE0eB53f46cd790Cd13851d5EFf43D12404d33E8",
	"0x56eddb7aa87536c09ccc2793473599fd21a8b17f",
	"0x47ac0Fb4F2D84898e4D9E7bDaDaB4B90bad8e61",
	"0x40B38765696e3d5d8d9d834D8AaD1BbB6E08E618",
];

async function rpcCall(
	url: string,
	method: string,
	params: unknown[],
): Promise<unknown> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
	const data = (await res.json()) as {
		result?: unknown;
		error?: { message: string };
	};
	if (data.error) {
		throw new Error(data.error.message);
	}
	return data.result;
}

/** Solidity layout: `mapping(address => uint256)` at `mappingSlot` → storage slot for `holder`. */
function erc20BalanceStorageSlot(holder: Address, mappingSlot: bigint): Hex {
	return keccak256(
		encodeAbiParameters(
			[{ type: "address" }, { type: "uint256" }],
			[holder, mappingSlot],
		),
	);
}

function parseAmount(b: Record<string, unknown>): number {
	const raw = b.amount ?? b.valueEth;
	if (typeof raw === "number") return raw;
	if (typeof raw === "string") return Number.parseFloat(raw);
	return 10;
}

function topicToAddress(topic: string): Address | undefined {
	if (!topic || topic.length < 66) return undefined;
	return `0x${topic.slice(26)}` as Address;
}

async function erc20BalanceOf(
	url: string,
	token: Address,
	holder: Address,
): Promise<bigint> {
	const balData = encodeFunctionData({
		abi: erc20Abi,
		functionName: "balanceOf",
		args: [holder],
	});
	const balHex = (await rpcCall(url, "eth_call", [
		{ to: token, data: balData },
		"latest",
	])) as Hex;
	return decodeFunctionResult({
		abi: erc20Abi,
		functionName: "balanceOf",
		data: balHex,
	}) as bigint;
}

async function collectTransferRecipientCandidates(
	url: string,
	token: Address,
): Promise<Address[]> {
	const latestHex = (await rpcCall(url, "eth_blockNumber", [])) as string;
	let latest = BigInt(latestHex);
	const seen = new Set<string>();
	const out: Address[] = [];

	for (let chunk = 0n; chunk < LOG_MAX_CHUNKS; chunk++) {
		const hi = latest;
		const lo = latest - LOG_CHUNK_BLOCKS + 1n;
		if (lo < 0n) break;
		try {
			const logs = (await rpcCall(url, "eth_getLogs", [
				{
					fromBlock: toHex(lo),
					toBlock: toHex(hi),
					address: token,
					topics: [TRANSFER_EVENT_TOPIC],
				},
			])) as { topics: string[] }[];
			for (let i = logs.length - 1; i >= 0; i--) {
				const toAddr = topicToAddress(logs[i].topics[2]);
				if (!toAddr || !isAddress(toAddr)) continue;
				const key = toAddr.toLowerCase();
				if (seen.has(key)) continue;
				seen.add(key);
				out.push(toAddr);
				if (out.length >= LOG_MAX_UNIQUE_RECIPIENTS) return out;
			}
		} catch {
			/* Alchemy / range limits — skip chunk */
		}
		latest = lo - 1n;
		if (latest < 0n) break;
	}
	return out;
}

async function tryTransferFrom(
	url: string,
	token: Address,
	from: Address,
	to: Address,
	amount: bigint,
): Promise<boolean> {
	const data = encodeFunctionData({
		abi: erc20Abi,
		functionName: "transfer",
		args: [to, amount],
	});
	try {
		await rpcCall(url, "hardhat_impersonateAccount", [from]);
		await rpcCall(url, "eth_sendTransaction", [
			{
				from,
				to: token,
				data,
				gas: "0x7a1200",
			},
		]);
		return true;
	} catch {
		return false;
	} finally {
		try {
			await rpcCall(url, "hardhat_stopImpersonatingAccount", [from]);
		} catch {
			/* ignore */
		}
	}
}

async function fundViaImpersonatedTransfers(
	url: string,
	token: Address,
	recipient: Address,
	amount: bigint,
): Promise<Address | undefined> {
	const candidates: Address[] = [];
	const pushUnique = (a: Address) => {
		const k = a.toLowerCase();
		if (candidates.some((x) => x.toLowerCase() === k)) return;
		candidates.push(a);
	};
	for (const a of COMMON_ERC20_SOURCE_ACCOUNTS) pushUnique(a);
	const fromLogs = await collectTransferRecipientCandidates(url, token);
	for (const a of fromLogs) pushUnique(a);

	for (const from of candidates) {
		if (from.toLowerCase() === recipient.toLowerCase()) continue;
		let bal: bigint;
		try {
			bal = await erc20BalanceOf(url, token, from);
		} catch {
			continue;
		}
		if (bal < amount) continue;
		const ok = await tryTransferFrom(url, token, from, recipient, amount);
		if (ok) {
			try {
				const after = await erc20BalanceOf(url, token, recipient);
				if (after > 0n) return from;
			} catch {
				return from;
			}
		}
	}
	return undefined;
}

async function readWordStorage(
	url: string,
	token: Address,
	slot: Hex,
): Promise<bigint> {
	const word = (await rpcCall(url, "eth_getStorageAt", [
		token,
		slot,
		"latest",
	])) as string;
	return BigInt(word);
}

async function discoverBalanceMappingSlot(
	url: string,
	token: Address,
	probeHolder: Address,
	expectedBalance: bigint,
): Promise<bigint | undefined> {
	for (let m = 0n; m < MAX_MAPPING_SLOT_SCAN; m++) {
		const slot = erc20BalanceStorageSlot(probeHolder, m);
		const v = await readWordStorage(url, token, slot);
		if (v === expectedBalance) return m;
	}
	return undefined;
}

async function fundViaSetStorage(
	url: string,
	token: Address,
	recipient: Address,
	addUnits: bigint,
	mappingSlot: bigint,
): Promise<void> {
	const current = await erc20BalanceOf(url, token, recipient);
	const next = current + addUnits;
	const storageSlot = erc20BalanceStorageSlot(recipient, mappingSlot);
	const valueWord = pad(toHex(next), { size: 32 });
	await rpcCall(url, "hardhat_setStorageAt", [
		token,
		storageSlot,
		valueWord,
	]);
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
	const address = typeof b.address === "string" ? b.address : undefined;
	const amount = parseAmount(b);

	const tokenRaw = b.token;
	const tokenStr =
		typeof tokenRaw === "string" ? tokenRaw.trim().toLowerCase() : "";
	const token =
		tokenStr === "" || tokenStr === "native" || tokenStr === "eth"
			? undefined
			: (tokenRaw as string).trim();

	if (!address || !isAddress(address)) {
		return NextResponse.json({ error: "Invalid address" }, { status: 400 });
	}
	if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
		return NextResponse.json(
			{
				error: `amount must be between 0 and ${MAX_AMOUNT} (exclusive of 0)`,
			},
			{ status: 400 },
		);
	}

	const slotRaw = b.balanceMappingSlot;
	const mappingSlotProvided =
		typeof slotRaw === "number" ||
		(typeof slotRaw === "string" && slotRaw.trim() !== "");
	const mappingSlot =
		typeof slotRaw === "number" && Number.isInteger(slotRaw)
			? BigInt(slotRaw)
			: typeof slotRaw === "string" && slotRaw.trim() !== ""
				? BigInt(slotRaw.trim())
				: BigInt(0);

	const recipient = address as Address;
	const url = process.env.RPC_URL ?? DEFAULT_RPC;

	try {
		if (!token) {
			let addWei: bigint;
			try {
				addWei = parseEther(amount.toString());
			} catch {
				return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
			}
			const balHex = (await rpcCall(url, "eth_getBalance", [
				address,
				"latest",
			])) as string;
			const current = BigInt(balHex);
			const next = current + addWei;
			await rpcCall(url, "hardhat_setBalance", [address, toHex(next)]);
			return NextResponse.json({ ok: true, kind: "native", amount });
		}

		if (!isAddress(token)) {
			return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
		}
		const tokenAddr = token as Address;

		let decimals = 18;
		try {
			const decData = encodeFunctionData({
				abi: erc20Abi,
				functionName: "decimals",
			});
			const decHex = (await rpcCall(url, "eth_call", [
				{ to: tokenAddr, data: decData },
				"latest",
			])) as Hex;
			decimals = Number(
				decodeFunctionResult({
					abi: erc20Abi,
					functionName: "decimals",
					data: decHex,
				}),
			);
			if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
				decimals = 18;
			}
		} catch {
			decimals = 18;
		}

		let addUnits: bigint;
		try {
			addUnits = parseUnits(amount.toString(), decimals);
		} catch {
			return NextResponse.json({ error: "Invalid amount for decimals" }, {
				status: 400,
			});
		}

		if (mappingSlotProvided) {
			await fundViaSetStorage(
				url,
				tokenAddr,
				recipient,
				addUnits,
				mappingSlot,
			);
			return NextResponse.json({
				ok: true,
				kind: "erc20",
				method: "setStorage",
				token: tokenAddr,
				amount,
				balanceMappingSlot: mappingSlot.toString(),
			});
		}

		const source = await fundViaImpersonatedTransfers(
			url,
			tokenAddr,
			recipient,
			addUnits,
		);
		if (source) {
			return NextResponse.json({
				ok: true,
				kind: "erc20",
				method: "impersonateTransfer",
				token: tokenAddr,
				amount,
				from: source,
			});
		}

		let discoveredSlot: bigint | undefined;
		for (const probe of COMMON_ERC20_SOURCE_ACCOUNTS) {
			let bal: bigint;
			try {
				bal = await erc20BalanceOf(url, tokenAddr, probe);
			} catch {
				continue;
			}
			if (bal === 0n) continue;
			discoveredSlot = await discoverBalanceMappingSlot(
				url,
				tokenAddr,
				probe,
				bal,
			);
			if (discoveredSlot !== undefined) break;
		}
		if (discoveredSlot === undefined) {
			for (const probe of await collectTransferRecipientCandidates(
				url,
				tokenAddr,
			)) {
				let bal: bigint;
				try {
					bal = await erc20BalanceOf(url, tokenAddr, probe);
				} catch {
					continue;
				}
				if (bal === 0n) continue;
				discoveredSlot = await discoverBalanceMappingSlot(
					url,
					tokenAddr,
					probe,
					bal,
				);
				if (discoveredSlot !== undefined) break;
			}
		}

		if (discoveredSlot === undefined) {
			throw new Error(
				"Could not fund ERC-20: no transfer succeeded and balance mapping slot could not be detected (try passing balanceMappingSlot)",
			);
		}

		await fundViaSetStorage(
			url,
			tokenAddr,
			recipient,
			addUnits,
			discoveredSlot,
		);
		return NextResponse.json({
			ok: true,
			kind: "erc20",
			method: "setStorage",
			token: tokenAddr,
			amount,
			balanceMappingSlot: discoveredSlot.toString(),
			autoDiscoveredSlot: true,
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : "RPC failed";
		return NextResponse.json(
			{
				error: message.includes("hardhat_")
					? `${message} (Hardhat fork node required)`
					: message,
			},
			{ status: 502 },
		);
	}
}
