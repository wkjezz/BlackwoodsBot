import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('List the bot commands that are currently available.');

export async function execute(interaction) {
  const memberRoles = interaction.member?.roles?.cache;
  const hasRoleId = id => !!memberRoles && memberRoles.some(r => r.id === id);

  const lines = [];
  for (const command of interaction.client.commands.values()) {
    const def = command.data.toJSON();

    // gather allowed role ids from exported allowedRoleIds / allowedRoleEnv
    const allowedRoleIds = new Set();
    if (command.allowedRoleIds && Array.isArray(command.allowedRoleIds)) for (const id of command.allowedRoleIds) allowedRoleIds.add(String(id));
    if (command.allowedRoleEnv) {
      const envs = Array.isArray(command.allowedRoleEnv) ? command.allowedRoleEnv : [command.allowedRoleEnv];
      for (const key of envs) {
        const val = process.env[key];
        if (!val) continue;
        for (const id of val.split(',').map(s => s.trim()).filter(Boolean)) allowedRoleIds.add(id);
      }
    }

    const restricted = Array.isArray(command.restrictedSubcommands) ? new Set(command.restrictedSubcommands) : null;

    if (!def.options || def.options.length === 0) {
      // simple command
      let accessible = true;
      if (allowedRoleIds.size > 0) {
        accessible = [...allowedRoleIds].some(id => hasRoleId(id));
      }
      if (accessible) lines.push(`/${def.name} - ${def.description}`);
    } else {
      // command with subcommands — list only subcommands the member can run
      for (const opt of def.options) {
        if (opt.type === 1) { // SUB_COMMAND
          const name = `/${def.name} ${opt.name}`;
          const desc = opt.description || def.description || '';
          let accessible = true;
          if (restricted && restricted.has(opt.name)) {
            // requires role
            if (allowedRoleIds.size > 0) {
              accessible = [...allowedRoleIds].some(id => hasRoleId(id));
            } else {
              // if no explicit allowedRoleIds, check env keys on command
              accessible = false;
            }
          }

          if (accessible) lines.push(`${name} - ${desc}`);
        }
      }
    }
  }

  await interaction.reply({ content: lines.length > 0 ? `Available commands:\n${lines.join('\n')}` : 'No commands are available for your role.', ephemeral: true });
}
