# d-EURO dev environment

Local UI plus a **Hardhat node** that can **fork Ethereum mainnet** (chain id `1` on `http://127.0.0.1:8545`).

## Setup

1. Copy `.env.example` to `.env`.
2. Set **`FORK_URL`** to an archive-capable mainnet HTTPS RPC (e.g. Alchemy/Infura). Same value as `RPC_URL_MAINNET` if you already use that name.

## Run (fork + app)

```bash
yarn install   # or npm install
yarn dev:with-chain
```

Then open [http://localhost:3040](http://localhost:3040). The Next app talks to the node via `RPC_URL` (default `http://127.0.0.1:8545`).

**`yarn dev` alone** only starts the web app; without **`yarn chain`** in another process (or `dev:with-chain`), nothing serves the fork on port 8545.

## Run (two terminals)

```bash
yarn chain    # Hardhat fork — keep running
yarn dev      # Next on port 3040
```

## Wallet

Add the local RPC in MetaMask (see in-app copy): mainnet chain id **1**, URL **`http://127.0.0.1:8545`**.

## Ponder (indexer) against this fork

Ponder lives in the monorepo at **`../ponder`** (sibling of this folder). It reads **`ponder/.env.local`** (not `.env`).

1. Start the fork first: **`yarn dev:with-chain`** or **`yarn chain`** here so **`http://127.0.0.1:8545`** is up.
2. In **`ponder/`**, create **`.env.local`** (see **`ponder/.env.example`**) with at least:
   - **`PONDER_PROFILE=mainnet`** (anything other than `polygon` selects mainnet)
   - **`RPC_URL_MAINNET=http://127.0.0.1:8545`**
3. Optional: set **`PONDER_MAINNET_START_*`** / **`PONDER_V3_START_BLOCK`** (see example) so indexing begins near your fork head; otherwise Ponder replays from the default mainnet deployment blocks and the first sync can be large.
4. From **`ponder/`**: **`yarn dev`** (Ponder UI defaults to port **42069**).

`ponder.config.ts` also accepts **`PONDER_RPC_URL_MAINNET`** as an alias for **`RPC_URL_MAINNET`**.

## Dapp (`../dapp`) against this stack

In **`dapp/.env`** (see **`dapp/.env.example`**):

- **`NEXT_PUBLIC_API_URL`** → Nest API (e.g. **`http://localhost:3000`**)
- **`NEXT_PUBLIC_PONDER_URL`** / **`NEXT_PUBLIC_PONDER_FALLBACK_URL`** → Ponder HTTP (default **`http://127.0.0.1:42069/`**; use the port Ponder prints if you pass **`ponder dev -p`**)
- **`NEXT_PUBLIC_CHAIN_NAME=mainnet`**
- **`NEXT_PUBLIC_RPC_URL_MAINNET=http://127.0.0.1:8545`** — for **`localhost` / `127.0.0.1`**, wagmi does **not** append **`NEXT_PUBLIC_ALCHEMY_API_KEY`** (see **`dapp/app.config.ts`** **`CONFIG_RPC`**)

Optional **`NEXT_PUBLIC_WAGMI_RPC_URL`** forces the wagmi JSON-RPC URL. Run **`yarn dev`** from **`dapp/`**.
