import 'dotenv/config';
import { Client, Collection, Events, GatewayIntentBits, ActivityType } from 'discord.js';
import { loadCommands } from './lib/load-commands.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

const commands = await loadCommands();
for (const command of commands) {
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  readyClient.user.setPresence({
    activities: [{ name: 'Blackwoods', type: ActivityType.Playing }],
    status: 'online',
  });
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        await interaction.reply({ content: 'That command is not available right now.', ephemeral: true });
        return;
      }

      await command.execute(interaction);
      return;
    }

    // route modal submissions for warehouse bulk input
    if (interaction.isModalSubmit()) {
      if (interaction.customId && interaction.customId.startsWith('warehouse-bulk')) {
        try {
          const mod = await import('./commands/warehouse.js');
          if (typeof mod.handleBulkModal === 'function') {
            await mod.handleBulkModal(interaction);
            return;
          }
        } catch (e) {
          console.error('Error handling warehouse modal submit', e);
          try {
            await interaction.reply({ content: `Failed processing input: ${e.message}`, ephemeral: true });
          } catch (replyErr) {
            console.error('Failed to send error reply for modal submit', replyErr);
          }
          return;
        }
      }
    }

    // route buttons for warehouse bulk flow
    if (interaction.isButton()) {
      if (interaction.customId && (interaction.customId.startsWith('warehouse-bulk-start-') || interaction.customId.startsWith('warehouse-bulk-next-'))) {
        try {
          const parts = interaction.customId.split('-');
          const key = parts.slice(3).join('-');
          const mod = await import('./commands/warehouse.js');
          if (typeof mod.showBulkModal === 'function') {
            await mod.showBulkModal(interaction, key);
            return;
          }
        } catch (e) {
          console.error('Error handling warehouse bulk button', e);
          try { await interaction.reply({ content: `Failed: ${e.message}`, ephemeral: true }); } catch {}
        }
      }
    }
  } catch (error) {
    console.error('Interaction handling error', error);
    const payload = { content: 'There was an error handling the interaction.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
      return;
    }
    await interaction.reply(payload);
  }
});

if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN is required.');
}

await client.login(process.env.DISCORD_TOKEN);
