/**
 * Structured error model for Fakebase.
 * Mirrors the Supabase/PostgREST error envelope so existing error-handling code works unchanged.
 */
/** Canonical error codes used throughout the Fakebase stack. */
export declare enum FakebaseErrorCode {
    UNSUPPORTED_CAPABILITY = "UNSUPPORTED_CAPABILITY",
    TABLE_NOT_FOUND = "TABLE_NOT_FOUND",
    ROW_NOT_FOUND = "ROW_NOT_FOUND",
    /** PostgREST single-row assertion: 0 or 2+ rows when exactly 1 was expected. */
    PGRST116 = "PGRST116",
    POLICY_DENIED = "POLICY_DENIED",
    CONSTRAINT_VIOLATION = "CONSTRAINT_VIOLATION",
    UNIQUE_VIOLATION = "UNIQUE_VIOLATION",
    NOT_NULL_VIOLATION = "NOT_NULL_VIOLATION",
    INVALID_QUERY = "INVALID_QUERY",
    ADAPTER_ERROR = "ADAPTER_ERROR",
    AUTH_ERROR = "AUTH_ERROR",
    STORAGE_ERROR = "STORAGE_ERROR",
    REALTIME_ERROR = "REALTIME_ERROR",
    FUNCTION_ERROR = "FUNCTION_ERROR",
    MIGRATION_ERROR = "MIGRATION_ERROR"
}
/** Rich error type used by all Fakebase operations. */
export declare class FakebaseError extends Error {
    readonly code: FakebaseErrorCode;
    readonly details?: string;
    readonly hint?: string;
    readonly status: number;
    constructor(code: FakebaseErrorCode, message: string, details?: string, hint?: string);
    /** Adapter attempted a capability that is not implemented. */
    static unsupportedCapability(name: string, link?: string): FakebaseError;
    /** A referenced table does not exist in the schema. */
    static tableMissing(name: string): FakebaseError;
    /** A row-level security policy rejected the operation. */
    static policyDenied(table: string, op: string): FakebaseError;
    /** A unique constraint was violated. */
    static uniqueViolation(table: string, column: string): FakebaseError;
    /**
     * Single-row assertion failed (.single() returned 0 or 2+ rows).
     * Mirrors PostgREST error PGRST116.
     */
    static singleRowViolation(count: number): FakebaseError;
}
/**
 * Thrown when an operation requires a capability the current adapter marks
 * as STUB or UNSUPPORTED.
 */
export declare class CapabilityError extends Error {
    readonly capability: string;
    readonly docsLink?: string;
    constructor(capability: string, message: string, docsLink?: string);
    /** Create a standard "not implemented" capability error. */
    static notImplemented(capability: string, docsLink?: string): CapabilityError;
}
/** Shape any error into the Supabase-compatible error envelope. */
export declare function toSupabaseError(err: unknown): {
    message: string;
    details: string | undefined;
    hint: string | undefined;
    code: string;
};
//# sourceMappingURL=errors.d.ts.map