import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { promptVersions } from '../src/schema';

const PROMPT_VERSION_DATA = [
  {
    name: 'document_qa',
    version: 1,
    promptTemplate:
      'Answer the user using the provided document context when available. If the answer is not supported by the documents, say that clearly.',
    defaultModelProvider: null,
    defaultModelName: null,
    isActive: true,
    createdByUserId: null,
  },
  {
    name: 'general_chat',
    version: 1,
    promptTemplate:
      'You are a helpful AI workspace assistant. Give concise, accurate answers and ask for clarification when the request is ambiguous.',
    defaultModelProvider: null,
    defaultModelName: null,
    isActive: true,
    createdByUserId: null,
  },
] as const;

// biome-ignore lint/suspicious/noExplicitAny: seed runner uses generic drizzle instance without full schema types
export async function seedPromptVersions(db: PostgresJsDatabase<any>): Promise<void> {
  for (const promptVersion of PROMPT_VERSION_DATA) {
    await db
      .insert(promptVersions)
      .values(promptVersion)
      .onConflictDoUpdate({
        target: [promptVersions.name, promptVersions.version],
        set: {
          promptTemplate: promptVersion.promptTemplate,
          defaultModelProvider: promptVersion.defaultModelProvider,
          defaultModelName: promptVersion.defaultModelName,
          isActive: promptVersion.isActive,
          createdByUserId: promptVersion.createdByUserId,
        },
      });
  }

  // biome-ignore lint/suspicious/noConsole: seed CLI script
  console.log(`Seeded ${PROMPT_VERSION_DATA.length} prompt versions`);
}
