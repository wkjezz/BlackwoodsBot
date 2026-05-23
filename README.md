# BlackwoodsBot
A Discord bot for the Blackwoods server.

## What is here

This repo is now set up as a runnable `discord.js` bot with a small command framework. It currently includes:

- `/ping` to check bot latency
- `/help` to list available commands
- `/stock` to request a stock alert for a food category with a required amount and ping the configured role
- `/warehouse` to record warehouse stock levels (`set`, `bulk`)
- scheduled warehouse list posts at 2am, 10am, and 6pm Eastern time
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
	- `FAMER_ROLE_IDS` (or `Famer_Role_Ids`) for the single role that gets pinged when `/stock` is used
	- optional image URLs for each stock type, like `STOCK_FRUIT_IMAGE_URL` and `STOCK_SPECIALITY_IMAGE_URL`
	- `WAREHOUSE_LIST_CHANNEL_ID` for the channel that should receive the scheduled warehouse list posts

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

The `/stock` command now asks for how many are needed, then posts an embed like `Our target is to product 10 amount of Fruit`, pings the configured role, and shows a picture when the matching `STOCK_*_IMAGE_URL` value is set.

## Scheduled warehouse posts

The bot can automatically post the warehouse stock list to a channel at 2:00am, 10:00am, and 6:00pm Eastern time. Set `WAREHOUSE_LIST_CHANNEL_ID` to the target channel and keep the bot running. The schedule uses `America/New_York`, so it follows daylight saving time instead of staying on fixed UTC offsets.
