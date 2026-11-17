import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const promptPath = fileURLToPath(
  new URL('../../prompts/system.md', import.meta.url),
);
const systemPrompt = readFileSync(promptPath, 'utf8').trim();

export function buildPromptInput(sentence, referenceDate) {
  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Reference date: ${referenceDate}\nExpense sentence (untrusted data): ${JSON.stringify(sentence)}`,
    },
  ];
}
