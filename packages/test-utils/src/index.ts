// Test fixtures
export { TEST_SCHEMA, TEST_SEEDS } from "./fixtures.js";

// Adapter contract suite
export { defineAdapterContractSuite } from "./contract-suite.js";

// Compatibility runner
export { runCompatSuite, DEFAULT_COMPAT_SCENARIOS } from "./compat-runner.js";
export type {
  CompatScenario,
  CompatReport,
  SupabaseLikeClient,
} from "./compat-runner.js";
