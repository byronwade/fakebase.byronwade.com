import { describe, it, expect } from "vitest";
import { renderTable } from "../ui/table.js";

describe("renderTable", () => {
  it("renders a simple single-row table", () => {
    const output = renderTable(["Name", "Age"], [["Alice", "30"]]);
    expect(output).toContain("Name");
    expect(output).toContain("Age");
    expect(output).toContain("Alice");
    expect(output).toContain("30");
  });

  it("includes box-drawing characters", () => {
    const output = renderTable(["Col A", "Col B"], [["val1", "val2"]]);
    expect(output).toContain("┌");
    expect(output).toContain("┐");
    expect(output).toContain("└");
    expect(output).toContain("┘");
    expect(output).toContain("│");
    expect(output).toContain("─");
  });

  it("has a separator row between header and data", () => {
    const output = renderTable(["H1", "H2"], [["d1", "d2"]]);
    expect(output).toContain("├");
    expect(output).toContain("┤");
  });

  it("pads columns to the width of the widest cell", () => {
    const output = renderTable(["Short", "Longer Column Header"], [["x", "y"]]);
    // The "Longer Column Header" column should be wider than "y"
    const lines = output.split("\n");
    // All lines should have the same width (it's a box)
    const widths = lines.map((l) => l.length);
    expect(new Set(widths).size).toBe(1);
  });

  it("handles multiple rows", () => {
    const rows = [
      ["Alice", "Engineer"],
      ["Bob", "Designer"],
      ["Carol", "Manager"],
    ];
    const output = renderTable(["Name", "Role"], rows);
    expect(output).toContain("Alice");
    expect(output).toContain("Bob");
    expect(output).toContain("Carol");
    expect(output).toContain("Engineer");
    expect(output).toContain("Designer");
    expect(output).toContain("Manager");
  });

  it("returns empty string for empty headers", () => {
    const output = renderTable([], []);
    expect(output).toBe("");
  });

  it("fills missing cells with empty string", () => {
    const output = renderTable(["A", "B", "C"], [["x"]]);
    // Should not throw, missing cells become empty
    expect(output).toContain("x");
  });

  it("renders a 4-column auth inbox table", () => {
    const headers = ["Email", "Type", "Token", "Expires"];
    const rows = [["alice@example.com", "magic_link", "123456", "10 min"]];
    const output = renderTable(headers, rows);

    expect(output).toContain("Email");
    expect(output).toContain("Type");
    expect(output).toContain("Token");
    expect(output).toContain("Expires");
    expect(output).toContain("alice@example.com");
    expect(output).toContain("magic_link");
    expect(output).toContain("123456");
    expect(output).toContain("10 min");
  });
});
