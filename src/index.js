import 'dotenv/config';
import { Client, Collection, Events, GatewayIntentBits, ActivityType } from 'discord.js';
import { loadCommands } from './lib/load-commands.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const warehouseListSchedule = [
  { hour: 2, minute: 0 },
  { hour: 10, minute: 0 },
  { hour: 18, minute: 0 },
];
const warehouseListTimeZone = 'America/New_York';
const scheduledWarehouseRuns = new Set();

function getTimeParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

async function postScheduledWarehouseList() {
  const channelId = process.env.WAREHOUSE_LIST_CHANNEL_ID;
  if (!channelId) {
    console.warn('WAREHOUSE_LIST_CHANNEL_ID is not set; skipping scheduled warehouse list posts.');
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(error => {
    console.error('Failed to fetch warehouse list channel', error);
    return null;
  });

  if (!channel || !channel.isTextBased()) {
    console.warn(`Channel ${channelId} is not a text channel; skipping scheduled warehouse list post.`);
    return;
  }

  const mod = await import('./commands/warehouse.js');
  if (typeof mod.buildWarehouseListEmbed !== 'function') {
    console.warn('Warehouse list embed builder is unavailable; skipping scheduled post.');
    return;
  }

  const embed = await mod.buildWarehouseListEmbed();
  await channel.send({ embeds: [embed] });
  console.log(`Posted scheduled warehouse list in ${channelId}.`);
}

function scheduleWarehouseListPosts() {
  const checkSchedule = async () => {
    const now = new Date();
    const parts = getTimeParts(now, warehouseListTimeZone);
    const slot = warehouseListSchedule.find(entry => entry.hour === parts.hour && entry.minute === parts.minute);
    if (!slot) {
      return;
    }

    const runKey = `${parts.year}-${parts.month}-${parts.day} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
    if (scheduledWarehouseRuns.has(runKey)) {
      return;
    }

    scheduledWarehouseRuns.add(runKey);
    if (scheduledWarehouseRuns.size > 20) {
      scheduledWarehouseRuns.clear();
    }

    try {
      await postScheduledWarehouseList();
    } catch (error) {
      console.error('Scheduled warehouse list post failed', error);
    }
  };

  void checkSchedule();
  setInterval(() => {
    void checkSchedule();
  }, 30_000);
}

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
  scheduleWarehouseListPosts();
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

      if (interaction.customId && interaction.customId.startsWith('store-bulk')) {
        try {
          const mod = await import('./commands/store.js');
          if (typeof mod.handleBulkModal === 'function') {
            await mod.handleBulkModal(interaction);
            return;
          }
        } catch (e) {
          console.error('Error handling store modal submit', e);
          try {
            await interaction.reply({ content: `Failed processing input: ${e.message}`, ephemeral: true });
          } catch (replyErr) {
            console.error('Failed to send error reply for store modal submit', replyErr);
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

      if (interaction.customId && (interaction.customId.startsWith('store-bulk-start-') || interaction.customId.startsWith('store-bulk-next-'))) {
        try {
          const parts = interaction.customId.split('-');
          const key = parts.slice(3).join('-');
          const mod = await import('./commands/store.js');
          if (typeof mod.showBulkModal === 'function') {
            await mod.showBulkModal(interaction, key);
            return;
          }
        } catch (e) {
          console.error('Error handling store bulk button', e);
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
