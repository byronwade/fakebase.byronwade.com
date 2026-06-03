export type FunctionAuth = "anon" | "service_role" | "authenticated" | "none";

export interface FunctionDefinition {
  name: string;
  auth?: FunctionAuth;
  handler: (req: FunctionRequest) => Promise<FunctionResponse> | FunctionResponse;
}

export interface FunctionRequest {
  body: unknown;
  headers: Record<string, string>;
  method: string;
  url: string;
}

export interface FunctionResponse {
  status?: number;
  headers?: Record<string, string>;
  body: unknown;
}

export interface FunctionInvokeOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
}
