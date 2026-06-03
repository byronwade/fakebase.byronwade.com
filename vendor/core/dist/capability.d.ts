/**
 * Capability registry — tracks which features each adapter supports so that
 * callers can get clear errors and documentation links instead of silent failures.
 */
/** Describes the implementation level of a feature. */
export declare enum CapabilityStatus {
    /** Fully implemented and tested. */
    SUPPORTED = "SUPPORTED",
    /** Implemented with known limitations. */
    PARTIAL = "PARTIAL",
    /** Registered but returns a clear not-implemented error. */
    STUB = "STUB",
    /** Not available on this adapter; will never be. */
    UNSUPPORTED = "UNSUPPORTED"
}
/** A single capability record in the registry. */
export interface CapabilityEntry {
    name: string;
    status: CapabilityStatus;
    notes?: string;
    docsLink?: string;
}
/**
 * Central registry of all capabilities declared by an adapter.
 * Adapters register their features at initialization time; callers
 * can then assert support or render a compatibility table.
 */
export declare class CapabilityRegistry {
    private readonly entries;
    /** Register or overwrite a capability entry. */
    register(entry: CapabilityEntry): void;
    /** Retrieve the entry for a named capability (undefined if not registered). */
    get(name: string): CapabilityEntry | undefined;
    /** Return all registered entries sorted by name. */
    getAll(): CapabilityEntry[];
    /**
     * Assert that a capability is fully or partially supported.
     * Throws `CapabilityError` when status is STUB or UNSUPPORTED.
     */
    assertSupported(name: string): void;
    /** Render a markdown compatibility table for documentation or CLI output. */
    toMarkdown(): string;
}
//# sourceMappingURL=capability.d.ts.map