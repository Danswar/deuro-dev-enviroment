"use client";

import { PRESET_ERC20_TOKENS } from "@/lib/presetTokens";
import { erc20Abi, formatUnits, type Address } from "viem";
import { useCallback, useMemo, useState } from "react";
import { useConnection, useReadContracts } from "wagmi";

const cardClass =
	"max-w-md rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-xl shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03] dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-black/50 dark:ring-white/[0.06]";

const btnSolid =
	"shrink-0 rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";

/** MetaMask limits token symbol length when importing. */
const MAX_WATCH_SYMBOL_LEN = 11;

type EthereumRequester = {
	request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

function getInjectedProvider(): EthereumRequester | undefined {
	if (typeof window === "undefined") return undefined;
	const w = window as unknown as { ethereum?: EthereumRequester };
	return w.ethereum;
}

type ReadEntry =
	| { status: "success"; result?: unknown }
	| { status: "failure"; error?: Error }
	| undefined;

function pickResult<T>(entry: ReadEntry): T | undefined {
	if (!entry || entry.status !== "success") return undefined;
	return entry.result as T;
}

export function BalancesCard() {
	const { address, isConnected } = useConnection();
	const [rowPending, setRowPending] = useState<number | null>(null);
	const [watchError, setWatchError] = useState<string | null>(null);

	const contracts = useMemo(() => {
		if (!address) return [];
		const holder = address as Address;
		return PRESET_ERC20_TOKENS.flatMap((t) => [
			{
				address: t.address,
				abi: erc20Abi,
				functionName: "balanceOf" as const,
				args: [holder],
			},
			{
				address: t.address,
				abi: erc20Abi,
				functionName: "decimals" as const,
			},
			{
				address: t.address,
				abi: erc20Abi,
				functionName: "symbol" as const,
			},
		]);
	}, [address]);

	const { data, isPending } = useReadContracts({
		contracts,
		query: {
			enabled: Boolean(isConnected && address && contracts.length > 0),
		},
	});

	const suggestTokenInWallet = useCallback(
		async (
			token: Address,
			rowIndex: number,
			symbol: string,
			decimals: number,
		) => {
			setWatchError(null);
			setRowPending(rowIndex);
			try {
				const provider = getInjectedProvider();
				if (!provider?.request) {
					throw new Error("No injected wallet (e.g. MetaMask) found.");
				}
				const sym =
					symbol.length > MAX_WATCH_SYMBOL_LEN
						? symbol.slice(0, MAX_WATCH_SYMBOL_LEN)
						: symbol;
				const added = (await provider.request({
					method: "wallet_watchAsset",
					params: {
						type: "ERC20",
						options: {
							address: token,
							symbol: sym,
							decimals,
						},
					},
				})) as boolean | null;
				if (added === false) {
					throw new Error("Wallet did not add the token.");
				}
			} catch (e) {
				const msg =
					e instanceof Error ? e.message : "Could not add token to wallet.";
				if (
					typeof e === "object" &&
					e !== null &&
					"code" in e &&
					(e as { code?: number }).code === 4001
				) {
					setWatchError("Request rejected in wallet.");
				} else {
					setWatchError(msg);
				}
			} finally {
				setRowPending(null);
			}
		},
		[],
	);

	return (
		<article className={cardClass}>
			<div className="space-y-4">
				<h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
					Balances
				</h2>
				<p className="text-xs text-zinc-500 dark:text-zinc-500">
					Preset fork tokens. The button calls{" "}
					<code className="font-mono">wallet_watchAsset</code> so the extension
					adds the ERC-20 to your token list (no balance change).
				</p>

				{!isConnected || !address ? (
					<p className="text-sm text-zinc-600 dark:text-zinc-400">
						Connect a wallet to load balances.
					</p>
				) : (
					<ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
						{PRESET_ERC20_TOKENS.map((t, i) => {
							const base = i * 3;
							const bal = pickResult<bigint>(data?.[base] as ReadEntry);
							const dec = pickResult<number>(data?.[base + 1] as ReadEntry);
							const sym = pickResult<string>(data?.[base + 2] as ReadEntry);
							const decimals =
								typeof dec === "number" &&
								Number.isInteger(dec) &&
								dec >= 0 &&
								dec <= 255
									? dec
									: 18;
							const symbol =
								typeof sym === "string" && sym.length > 0 ? sym : t.label;
							const balanceLine =
								bal !== undefined
									? `${formatUnits(bal, decimals)} ${symbol}`
									: !data && isPending
										? "…"
										: "—";

							return (
								<li
									key={t.address}
									className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
								>
									<div className="min-w-0">
										<p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
											{t.label}
										</p>
										<p className="font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
											{balanceLine}
										</p>
										<p className="break-all font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
											{t.address}
										</p>
									</div>
									<button
										type="button"
										disabled={rowPending !== null || (!data && isPending)}
										onClick={() =>
											void suggestTokenInWallet(
												t.address,
												i,
												symbol,
												decimals,
											)
										}
										className={btnSolid}
									>
										{rowPending === i ? "Requesting…" : "Add to wallet"}
									</button>
								</li>
							);
						})}
					</ul>
				)}

				{watchError ? (
					<p className="text-sm text-red-600 dark:text-red-400">{watchError}</p>
				) : null}
			</div>
		</article>
	);
}
