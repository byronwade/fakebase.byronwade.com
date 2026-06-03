/**
 * Structured error model for Fakebase.
 * Mirrors the Supabase/PostgREST error envelope so existing error-handling code works unchanged.
 */
/** Canonical error codes used throughout the Fakebase stack. */
export var FakebaseErrorCode;
(function (FakebaseErrorCode) {
    FakebaseErrorCode["UNSUPPORTED_CAPABILITY"] = "UNSUPPORTED_CAPABILITY";
    FakebaseErrorCode["TABLE_NOT_FOUND"] = "TABLE_NOT_FOUND";
    FakebaseErrorCode["ROW_NOT_FOUND"] = "ROW_NOT_FOUND";
    /** PostgREST single-row assertion: 0 or 2+ rows when exactly 1 was expected. */
    FakebaseErrorCode["PGRST116"] = "PGRST116";
    FakebaseErrorCode["POLICY_DENIED"] = "POLICY_DENIED";
    FakebaseErrorCode["CONSTRAINT_VIOLATION"] = "CONSTRAINT_VIOLATION";
    FakebaseErrorCode["UNIQUE_VIOLATION"] = "UNIQUE_VIOLATION";
    FakebaseErrorCode["NOT_NULL_VIOLATION"] = "NOT_NULL_VIOLATION";
    FakebaseErrorCode["INVALID_QUERY"] = "INVALID_QUERY";
    FakebaseErrorCode["ADAPTER_ERROR"] = "ADAPTER_ERROR";
    FakebaseErrorCode["AUTH_ERROR"] = "AUTH_ERROR";
    FakebaseErrorCode["STORAGE_ERROR"] = "STORAGE_ERROR";
    FakebaseErrorCode["REALTIME_ERROR"] = "REALTIME_ERROR";
    FakebaseErrorCode["FUNCTION_ERROR"] = "FUNCTION_ERROR";
    FakebaseErrorCode["MIGRATION_ERROR"] = "MIGRATION_ERROR";
})(FakebaseErrorCode || (FakebaseErrorCode = {}));
/** HTTP status codes mapped to each error code. */
const STATUS_MAP = {
    [FakebaseErrorCode.UNSUPPORTED_CAPABILITY]: 501,
    [FakebaseErrorCode.TABLE_NOT_FOUND]: 404,
    [FakebaseErrorCode.ROW_NOT_FOUND]: 404,
    [FakebaseErrorCode.PGRST116]: 406,
    [FakebaseErrorCode.POLICY_DENIED]: 403,
    [FakebaseErrorCode.CONSTRAINT_VIOLATION]: 409,
    [FakebaseErrorCode.UNIQUE_VIOLATION]: 409,
    [FakebaseErrorCode.NOT_NULL_VIOLATION]: 400,
    [FakebaseErrorCode.INVALID_QUERY]: 400,
    [FakebaseErrorCode.ADAPTER_ERROR]: 500,
    [FakebaseErrorCode.AUTH_ERROR]: 401,
    [FakebaseErrorCode.STORAGE_ERROR]: 500,
    [FakebaseErrorCode.REALTIME_ERROR]: 500,
    [FakebaseErrorCode.FUNCTION_ERROR]: 500,
    [FakebaseErrorCode.MIGRATION_ERROR]: 500,
};
/** Rich error type used by all Fakebase operations. */
export class FakebaseError extends Error {
    code;
    details;
    hint;
    status;
    constructor(code, message, details, hint) {
        super(message);
        this.name = "FakebaseError";
        this.code = code;
        this.details = details;
        this.hint = hint;
        this.status = STATUS_MAP[code];
        Object.setPrototypeOf(this, new.target.prototype);
    }
    /** Adapter attempted a capability that is not implemented. */
    static unsupportedCapability(name, link) {
        return new FakebaseError(FakebaseErrorCode.UNSUPPORTED_CAPABILITY, `Capability '${name}' is not supported by this adapter.`, link ? `See ${link} for alternatives.` : undefined, "Check the capability registry for supported features.");
    }
    /** A referenced table does not exist in the schema. */
    static tableMissing(name) {
        return new FakebaseError(FakebaseErrorCode.TABLE_NOT_FOUND, `Table '${name}' does not exist.`, "Ensure the table is registered in the schema before querying it.");
    }
    /** A row-level security policy rejected the operation. */
    static policyDenied(table, op) {
        return new FakebaseError(FakebaseErrorCode.POLICY_DENIED, `RLS policy denied ${op} on table '${table}'.`, "new row violates row-level security policy", "Check that the authenticated role has appropriate policies.");
    }
    /** A unique constraint was violated. */
    static uniqueViolation(table, column) {
        return new FakebaseError(FakebaseErrorCode.UNIQUE_VIOLATION, `duplicate key value violates unique constraint on '${table}.${column}'`, `Key (${column}) already exists.`, "Change the conflicting value or use upsert semantics.");
    }
    /**
     * Single-row assertion failed (.single() returned 0 or 2+ rows).
     * Mirrors PostgREST error PGRST116.
     */
    static singleRowViolation(count) {
        return new FakebaseError(FakebaseErrorCode.PGRST116, "JSON object requested, multiple (or no) rows returned", `The result contains ${count} rows`, count === 0
            ? "Use maybeSingle() if you expect the row to be absent."
            : "Refine your filters so exactly one row is matched.");
    }
}
/**
 * Thrown when an operation requires a capability the current adapter marks
 * as STUB or UNSUPPORTED.
 */
export class CapabilityError extends Error {
    capability;
    docsLink;
    constructor(capability, message, docsLink) {
        super(message);
        this.name = "CapabilityError";
        this.capability = capability;
        this.docsLink = docsLink;
        Object.setPrototypeOf(this, new.target.prototype);
    }
    /** Create a standard "not implemented" capability error. */
    static notImplemented(capability, docsLink) {
        return new CapabilityError(capability, `'${capability}' is not implemented by this adapter.${docsLink ? ` See ${docsLink}` : ""}`, docsLink);
    }
}
/** Shape any error into the Supabase-compatible error envelope. */
export function toSupabaseError(err) {
    if (err instanceof FakebaseError) {
        return {
            message: err.message,
            details: err.details,
            hint: err.hint,
            code: err.code,
        };
    }
    if (err instanceof Error) {
        return {
            message: err.message,
            details: undefined,
            hint: undefined,
            code: FakebaseErrorCode.ADAPTER_ERROR,
        };
    }
    return {
        message: String(err),
        details: undefined,
        hint: undefined,
        code: FakebaseErrorCode.ADAPTER_ERROR,
    };
}
//# sourceMappingURL=errors.js.map