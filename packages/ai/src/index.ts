/**
 * @fakebase/ai — AI rules, schema summaries, and prompt generation for Fakebase.
 *
 * @example
 * ```ts
 * import { generateFakebaseRules, generateAgentPrompt } from "@fakebase/ai";
 *
 * const rules = generateFakebaseRules(schema, { projectName: "my-app" });
 * const prompt = generateAgentPrompt("cursor", schema);
 * ```
 */

export {
  generateFakebaseRules,
  generateSchemasSummary,
  generatePoliciesSummary,
  generateCompatibilitySummary,
  generateMigrationChecklist,
} from "./rules-generator.js";

export {
  generateAgentPrompt,
  generateAgentsFile,
  generateClaudeFile,
  generateCursorRuleFile,
} from "./prompt-generator.js";

export type { PromptTarget } from "./prompt-generator.js";
