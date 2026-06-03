/**
 * Capability registry — tracks which features each adapter supports so that
 * callers can get clear errors and documentation links instead of silent failures.
 */

import { CapabilityError } from "./errors.js";

/** Describes the implementation level of a feature. */
export enum CapabilityStatus {
  /** Fully implemented and tested. */
  SUPPORTED = "SUPPORTED",
  /** Implemented with known limitations. */
  PARTIAL = "PARTIAL",
  /** Registered but returns a clear not-implemented error. */
  STUB = "STUB",
  /** Not available on this adapter; will never be. */
  UNSUPPORTED = "UNSUPPORTED",
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
export class CapabilityRegistry {
  private readonly entries = new Map<string, CapabilityEntry>();

  /** Register or overwrite a capability entry. */
  register(entry: CapabilityEntry): void {
    this.entries.set(entry.name, entry);
  }

  /** Retrieve the entry for a named capability (undefined if not registered). */
  get(name: string): CapabilityEntry | undefined {
    return this.entries.get(name);
  }

  /** Return all registered entries sorted by name. */
  getAll(): CapabilityEntry[] {
    return [...this.entries.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Assert that a capability is fully or partially supported.
   * Throws `CapabilityError` when status is STUB or UNSUPPORTED.
   */
  assertSupported(name: string): void {
    const entry = this.entries.get(name);
    if (!entry) {
      throw CapabilityError.notImplemented(name);
    }
    if (
      entry.status === CapabilityStatus.STUB ||
      entry.status === CapabilityStatus.UNSUPPORTED
    ) {
      throw new CapabilityError(
        name,
        `'${name}' is ${entry.status.toLowerCase()} on this adapter.${entry.notes ? ` ${entry.notes}` : ""}`,
        entry.docsLink,
      );
    }
  }

  /** Render a markdown compatibility table for documentation or CLI output. */
  toMarkdown(): string {
    const rows = this.getAll()
      .map(
        (e) =>
          `| ${e.name} | ${e.status} | ${e.notes ?? ""} | ${e.docsLink ? `[docs](${e.docsLink})` : ""} |`,
      )
      .join("\n");
    return [
      "| Capability | Status | Notes | Docs |",
      "| --- | --- | --- | --- |",
      rows,
    ].join("\n");
  }
}
