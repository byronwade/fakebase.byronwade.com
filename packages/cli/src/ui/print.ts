import chalk from "chalk";

const BANNER_WIDTH = 60;

export const print = {
  success(msg: string): void {
    console.log(chalk.green(`✓ ${msg}`));
  },

  error(msg: string): void {
    console.error(chalk.red(`✗ ${msg}`));
  },

  warn(msg: string): void {
    console.warn(chalk.yellow(`⚠ ${msg}`));
  },

  info(msg: string): void {
    console.log(chalk.blue(`ℹ ${msg}`));
  },

  step(msg: string): void {
    console.log(chalk.dim(`  → ${msg}`));
  },

  header(title: string): void {
    const border = "─".repeat(BANNER_WIDTH);
    console.log(chalk.bold(border));
    console.log(chalk.bold(`  ${title}`));
    console.log(chalk.bold(border));
  },

  devOnly(): void {
    const border = "═".repeat(BANNER_WIDTH);
    console.log(chalk.yellow(border));
    console.log(chalk.yellow.bold("  ⚠  DEV-ONLY  —  Not for production use  ⚠"));
    console.log(
      chalk.yellow("  Fakebase is a local prototype tool. Switch to Supabase"),
    );
    console.log(chalk.yellow("  for any real environment."));
    console.log(chalk.yellow(border));
    console.log();
  },
};
