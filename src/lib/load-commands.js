import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);
const commandsDirPath = join(currentDirPath, '..', 'commands');

export async function loadCommands() {
  const entries = await readdir(commandsDirPath, { withFileTypes: true });
  const commands = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }

    const commandModule = await import(pathToFileURL(join(commandsDirPath, entry.name)).href);
    if (!commandModule.data || typeof commandModule.execute !== 'function') {
      continue;
    }

    commands.push(commandModule);
  }

  return commands.sort((left, right) => left.data.name.localeCompare(right.data.name));
}
