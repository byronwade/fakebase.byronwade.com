import {
  mkdir,
  writeFile,
  readdir,
  readFile,
  copyFile,
  access,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import ora from "ora";
import chalk from "chalk";
import { print } from "../ui/print.js";
import { renderTable } from "../ui/table.js";

interface SnapshotMeta {
  label: string;
  createdAt: string;
  dir: string;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function snapshotsRoot(root: string): string {
  return join(root, ".fakebase", "snapshots");
}

async function loadSnapshotIndex(root: string): Promise<SnapshotMeta[]> {
  const indexPath = join(snapshotsRoot(root), "index.json");
  if (!(await fileExists(indexPath))) return [];
  const raw = await readFile(indexPath, "utf8");
  return JSON.parse(raw) as SnapshotMeta[];
}

async function saveSnapshotIndex(
  root: string,
  snapshots: SnapshotMeta[],
): Promise<void> {
  const indexPath = join(snapshotsRoot(root), "index.json");
  await writeFile(indexPath, JSON.stringify(snapshots, null, 2), "utf8");
}

export async function runSnapshotSave(label?: string, cwd?: string): Promise<void> {
  const root = resolve(cwd ?? process.cwd());
  const snapLabel = label ?? new Date().toISOString().replace(/[:.]/g, "-");
  const snapDir = join(snapshotsRoot(root), snapLabel);

  const spinner = ora(`Saving snapshot "${snapLabel}"…`).start();

  try {
    await mkdir(snapDir, { recursive: true });

    // Copy all JSON files from .fakebase/ to snapshot dir
    const dataDir = join(root, ".fakebase");
    if (await fileExists(dataDir)) {
      const files = await readdir(dataDir);
      for (const file of files) {
        if (file.endsWith(".json") && file !== "index.json") {
          await copyFile(join(dataDir, file), join(snapDir, file));
        }
      }
    }

    const snapshots = await loadSnapshotIndex(root);
    snapshots.push({
      label: snapLabel,
      createdAt: new Date().toISOString(),
      dir: snapDir,
    });
    await saveSnapshotIndex(root, snapshots);

    spinner.succeed(`Snapshot saved: ${snapLabel}`);
    print.step(`Location: .fakebase/snapshots/${snapLabel}/`);
  } catch (err) {
    spinner.fail("Snapshot save failed");
    throw err;
  }
}

export async function runSnapshotRestore(label: string, cwd?: string): Promise<void> {
  const root = resolve(cwd ?? process.cwd());
  const snapDir = join(snapshotsRoot(root), label);

  if (!(await fileExists(snapDir))) {
    print.error(`Snapshot "${label}" not found.`);
    print.step("Run `fakebase snapshot list` to see available snapshots.");
    process.exit(1);
  }

  const spinner = ora(`Restoring snapshot "${label}"…`).start();

  try {
    const files = await readdir(snapDir);
    const dataDir = join(root, ".fakebase");
    await mkdir(dataDir, { recursive: true });

    for (const file of files) {
      await copyFile(join(snapDir, file), join(dataDir, file));
    }

    spinner.succeed(`Snapshot "${label}" restored`);
  } catch (err) {
    spinner.fail("Snapshot restore failed");
    throw err;
  }
}

export async function runSnapshotList(cwd?: string): Promise<void> {
  const root = resolve(cwd ?? process.cwd());
  const snapshots = await loadSnapshotIndex(root);

  if (snapshots.length === 0) {
    print.info("No snapshots saved yet.");
    print.step("Run `fakebase snapshot save` to create one.");
    return;
  }

  const rows = snapshots.map((s, i) => [
    String(i + 1),
    s.label,
    new Date(s.createdAt).toLocaleString(),
  ]);

  console.log();
  console.log(renderTable(["#", "Label", "Created At"], rows));
  console.log();
  console.log(
    chalk.dim(`Restore with: ${chalk.cyan("fakebase snapshot restore <label>")}`),
  );
}
