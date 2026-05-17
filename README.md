# BlackwoodsBot
A Discord bot for the Blackwoods server.

## What is here

This repo is now set up as a runnable `discord.js` bot with a small command framework. It currently includes:

- `/ping` to check bot latency
- `/help` to list available commands
- `/stock` to request a stock alert for a food category and ping configured roles
- `/warehouse` to record or view warehouse stock levels (`set`, `adjust`, `view`, `bulk`)
- a shared command loader for adding more slash commands

## Setup

1. Install dependencies:

	```bash
	npm install
	```

2. Create a `.env` file in the project root and fill in your Discord values:

	- `DISCORD_TOKEN`
	- `DISCORD_CLIENT_ID`
	- `DISCORD_GUILD_ID` if you want to register commands to a test server first
	- the rank role IDs to ping on stock alerts: `SLINGER_ROLE_IDS`, `WRANGLER_ROLE_IDS`, `RANGER_ROLE_IDS`, `DESPERADO_ROLE_IDS`, and `PROPRIETROR_ROLE_IDS`
	- optional image URLs for each stock type, like `STOCK_FRUIT_IMAGE_URL` and `STOCK_SPECIALITY_IMAGE_URL`

3. Register the slash commands:

	```bash
	npm run register
	```

4. Start the bot:

	```bash
	npm start
	```

## Adding commands

Add a new file in `src/commands/` that exports `data` and `execute`. The loader will pick it up automatically.

## Stock alerts

The `/stock` command posts an embed like `Stock Low - We need more Fruit Goods`, pings the configured rank roles, and shows a picture when the matching `STOCK_*_IMAGE_URL` value is set. If you want multiple role IDs for a rank, separate them with commas in the matching environment variable.
