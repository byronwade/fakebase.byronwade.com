import chalk from "chalk";
import { print } from "../ui/print.js";
import { renderTable } from "../ui/table.js";

export async function runAuthInbox(): Promise<void> {
  print.header("Auth OTP Inbox");

  try {
    const { LocalAuthService, MemorySessionStorage } = await import("@fakebase/auth");

    const storage = new MemorySessionStorage();
    const auth = new LocalAuthService(new Map(), new Map(), storage);

    // Access OTP inbox via the service's internal store
    const inbox = auth.getOtpInbox?.() ?? [];

    if (inbox.length === 0) {
      print.info("No OTP records in inbox.");
      console.log();
      print.step("Send a magic link or OTP via `fakebase auth` to see records here.");
      return;
    }

    const rows = inbox.map((record) => {
      const expiry = new Date(record.expiresAt);
      const now = new Date();
      const remainingMs = expiry.getTime() - now.getTime();
      const remainingMin = Math.max(0, Math.round(remainingMs / 60000));
      const expiresStr = record.used
        ? chalk.dim("used")
        : remainingMin > 0
          ? `${remainingMin} min`
          : chalk.red("expired");

      return [
        record.email ?? record.phone ?? "—",
        record.type,
        record.token,
        expiresStr,
      ];
    });

    console.log();
    console.log(renderTable(["Email / Phone", "Type", "Token", "Expires"], rows));
    console.log();
  } catch (err) {
    print.error(
      `Could not load auth service: ${err instanceof Error ? err.message : String(err)}`,
    );
    print.step("Make sure @fakebase/auth is built.");
  }
}

export async function runAuthUsers(): Promise<void> {
  print.header("Auth Users");

  try {
    const { LocalAuthService, MemorySessionStorage } = await import("@fakebase/auth");

    const storage = new MemorySessionStorage();
    const auth = new LocalAuthService(new Map(), new Map(), storage);

    const result = await auth.admin.listUsers();

    if ("error" in result && result.error) {
      print.error(result.error.message);
      return;
    }

    const users =
      "data" in result && result.data
        ? (
            result.data as {
              users: Array<{
                id: string;
                email: string;
                role: string;
                createdAt: string;
                emailConfirmedAt: string | null;
              }>;
            }
          ).users
        : [];

    if (users.length === 0) {
      print.info("No users found.");
      return;
    }

    const rows = users.map((u) => [
      u.id.slice(0, 8) + "…",
      u.email,
      u.role,
      u.emailConfirmedAt ? chalk.green("confirmed") : chalk.yellow("unconfirmed"),
      new Date(u.createdAt).toLocaleDateString(),
    ]);

    console.log();
    console.log(renderTable(["ID", "Email", "Role", "Email Status", "Created"], rows));
    console.log();
  } catch (err) {
    print.error(
      `Could not load auth service: ${err instanceof Error ? err.message : String(err)}`,
    );
    print.step("Make sure @fakebase/auth is built.");
  }
}
