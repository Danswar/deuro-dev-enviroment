"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type ForkHead = {
	blockNumber: number;
	timestamp: number;
};

function formatBlockTime(unixSeconds: number): string {
	return new Date(unixSeconds * 1000).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "medium",
	});
}

async function fetchForkHead(): Promise<ForkHead> {
	const r = await fetch("/api/block");
	const data = (await r.json()) as {
		blockNumber?: number;
		timestamp?: number;
		error?: string;
	};
	if (!r.ok) {
		throw new Error(data.error ?? "Request failed");
	}
	if (typeof data.blockNumber !== "number" || typeof data.timestamp !== "number") {
		throw new Error("Invalid response");
	}
	return { blockNumber: data.blockNumber, timestamp: data.timestamp };
}

type MineBody = { blocks: number } | { days: number };

async function mineAdvance(body: MineBody): Promise<void> {
	const r = await fetch("/api/mine", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const data = (await r.json()) as { error?: string };
	if (!r.ok) {
		throw new Error(data.error ?? "Mine failed");
	}
}

const BLOCK_PRESETS = [1, 10, 100, 1000] as const;
const DAY_PRESETS = [1, 7, 30] as const;

export function ForkBlock() {
	const queryClient = useQueryClient();
	const [customBlocks, setCustomBlocks] = useState("10");
	const [customDays, setCustomDays] = useState("1");

	const { data, error, isPending } = useQuery({
		queryKey: ["fork-block"],
		queryFn: fetchForkHead,
		refetchInterval: 3000,
	});

	const mine = useMutation({
		mutationFn: mineAdvance,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["fork-block"] });
		},
	});

	const busy = mine.isPending;
	const mineCustomBlocks = () => {
		const n = Number.parseInt(customBlocks, 10);
		if (!Number.isFinite(n) || n < 1) return;
		mine.mutate({ blocks: n });
	};
	const mineCustomDays = () => {
		const n = Number.parseFloat(customDays);
		if (!Number.isFinite(n) || n <= 0) return;
		mine.mutate({ days: n });
	};

	return (
		<article
			className="max-w-md rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-xl shadow-zinc-950/[0.04] ring-1 ring-zinc-950/[0.03] dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-black/50 dark:ring-white/[0.06]"
		>
			<div className="space-y-8">
				<section className="space-y-6">
					<div className="space-y-2">
						<h1 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
							Current block (fork)
						</h1>
						<p className="text-4xl font-mono tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
							{isPending ? "…" : data !== undefined ? data.blockNumber : "—"}
						</p>
					</div>

					<div className="space-y-2">
						<h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
							Chain timestamp
						</h2>
						<p className="text-xl font-mono tabular-nums leading-snug text-zinc-900 dark:text-zinc-50 sm:text-2xl">
							{isPending
								? "…"
								: data !== undefined
									? formatBlockTime(data.timestamp)
									: "—"}
						</p>
						{!isPending && data !== undefined ? (
							<p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">
								Unix {data.timestamp}s
							</p>
						) : null}
					</div>

					{error ? (
						<p className="text-sm text-red-600 dark:text-red-400">
							{error instanceof Error ? error.message : "Error"}
						</p>
					) : null}
				</section>

				<div className="border-t border-zinc-100 dark:border-zinc-800" />

				<section className="space-y-3">
					<h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
						Advance chain
					</h2>
					<p className="text-xs text-zinc-500 dark:text-zinc-500">
						Uses Hardhat <code className="font-mono">hardhat_mine</code> on
						your local node.
					</p>
					<div className="flex flex-wrap gap-2">
						{BLOCK_PRESETS.map((n) => (
							<button
								key={n}
								type="button"
								disabled={busy}
								onClick={() => mine.mutate({ blocks: n })}
								className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
							>
								+{n}
							</button>
						))}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<input
							type="number"
							min={1}
							max={50_000}
							value={customBlocks}
							onChange={(e) => setCustomBlocks(e.target.value)}
							disabled={busy}
							className="w-28 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-mono text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
						/>
						<button
							type="button"
							disabled={busy}
							onClick={mineCustomBlocks}
							className="rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
						>
							Mine blocks
						</button>
					</div>
				</section>

				<div className="border-t border-zinc-100 dark:border-zinc-800" />

				<section className="space-y-3">
					<h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
						Advance by days
					</h2>
					<p className="text-xs text-zinc-500 dark:text-zinc-500">
						Mines{" "}
						<code className="font-mono">
							ceil(days × 86400 / BLOCK_TIME_SECONDS)
						</code>{" "}
						blocks with that many seconds between block timestamps (
						<code className="font-mono">hardhat_mine</code> interval). Default
						12s — set{" "}
						<code className="font-mono">BLOCK_TIME_SECONDS</code> in{" "}
						<code className="font-mono">.env</code> to match your fork.
					</p>
					<div className="flex flex-wrap gap-2">
						{DAY_PRESETS.map((n) => (
							<button
								key={n}
								type="button"
								disabled={busy}
								onClick={() => mine.mutate({ days: n })}
								className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
							>
								+{n}d
							</button>
						))}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<input
							type="number"
							min={0.0001}
							step="any"
							value={customDays}
							onChange={(e) => setCustomDays(e.target.value)}
							disabled={busy}
							className="w-28 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-mono text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
						/>
						<span className="text-sm text-zinc-500 dark:text-zinc-400">
							days
						</span>
						<button
							type="button"
							disabled={busy}
							onClick={mineCustomDays}
							className="rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
						>
							Mine equivalent blocks
						</button>
					</div>
					{mine.error ? (
						<p className="text-sm text-red-600 dark:text-red-400">
							{mine.error instanceof Error
								? mine.error.message
								: "Mine failed"}
						</p>
					) : null}
				</section>
			</div>
		</article>
	);
}
