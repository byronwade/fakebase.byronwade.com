export interface LocalEnvConfig {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  [key: string]: string | undefined;
}

export class LocalEnv {
  private readonly env: LocalEnvConfig;

  constructor(env: LocalEnvConfig = process.env as LocalEnvConfig) {
    this.env = { ...env };
  }

  get(key: string): string | undefined {
    return this.env[key];
  }

  require(key: string): string {
    const value = this.env[key];
    if (value === undefined || value === "") {
      throw new Error(
        `[fakebase/functions] Required environment variable '${key}' is not set.`,
      );
    }
    return value;
  }

  toObject(): LocalEnvConfig {
    return { ...this.env };
  }
}
