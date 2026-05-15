// packages/core/src/cli/commands/account.ts

import chalk from "chalk";
import type { Command } from "commander";
import { CliError } from "../types";
import {
  listAccounts,
  addAccount,
  viewAccount,
  updateAccount,
  removeAccount,
  testAccount,
  listExchanges,
} from "../../account";
import type { ExchangeId } from "../../account";

export function registerAccountCommand(program: Command): void {
  const account = program
    .command("account")
    .description("Trading account management");

  account
    .command("list")
    .description("List all trading accounts")
    .action(async () => {
      try {
        const result = await listAccounts();
        if (!result.success) throw CliError.operationFailed("account list", result.error!);
        if (result.accounts.length === 0) {
          console.log("No trading accounts configured. Use 'viben account add' to add one.");
          return;
        }
        console.log("\nTrading Accounts:\n");
        for (const acc of result.accounts) {
          console.log(`  ${chalk.dim(acc.id)}  ${acc.exchange.padEnd(10)} ${acc.name}`);
        }
        console.log(`\nTotal: ${result.accounts.length}`);
      } catch (e) {
        if (e instanceof CliError) { console.error(chalk.red(e.message)); process.exit(1); }
        throw e;
      }
    });

  account
    .command("add")
    .description("Add a new trading account")
    .option("-e, --exchange <exchange>", "Exchange ID (okx, binance, bitget, bybit, gate, kucoin, lighter)")
    .option("-n, --name <name>", "Account name")
    .option("--api-key <key>", "API key")
    .option("--secret <secret>", "API secret")
    .option("--passphrase <passphrase>", "Passphrase (for OKX/Bitget/KuCoin)")
    .action(async (opts) => {
      try {
        let { exchange, name } = opts;
        const apiKey = opts.apiKey as string | undefined;
        const secret = opts.secret as string | undefined;
        const passphrase = opts.passphrase as string | undefined;

        if (!exchange || !apiKey || !secret) {
          const exchanges = listExchanges();
          console.log("\nAvailable exchanges:");
          for (const ex of exchanges) {
            console.log(`  ${ex.id.padEnd(10)} ${ex.name}`);
          }
          throw CliError.operationFailed("account add",
            "Non-interactive usage: viben account add --exchange <id> --name <name> --api-key <key> --secret <secret> [--passphrase <pp>]");
        }

        if (!name) {
          const ex = listExchanges().find((e) => e.id === exchange);
          name = `${ex?.name ?? exchange} #1`;
        }

        const result = await addAccount({
          exchange: exchange as ExchangeId,
          name,
          api_key: apiKey,
          secret,
          passphrase,
        });

        if (!result.success) throw CliError.operationFailed("account add", result.error!);
        console.log(chalk.green(`Account added: ${result.account!.name} (${result.account!.id})`));
      } catch (e) {
        if (e instanceof CliError) { console.error(chalk.red(e.message)); process.exit(1); }
        throw e;
      }
    });

  account
    .command("view <idOrName>")
    .description("View account details (credentials masked)")
    .action(async (idOrName: string) => {
      try {
        const result = await viewAccount(idOrName);
        if (!result.success) throw CliError.operationFailed("account view", result.error!);
        const acc = result.account!;
        console.log(`\n  ID:       ${acc.id}`);
        console.log(`  Exchange: ${acc.exchange}`);
        console.log(`  Name:     ${acc.name}`);
        console.log(`  Created:  ${acc.created_at}`);
        console.log(`  Updated:  ${acc.updated_at}`);
        if (result.masked_credentials) {
          console.log("\n  Credentials:");
          for (const [field, masked] of Object.entries(result.masked_credentials)) {
            console.log(`    ${field}: ${masked}`);
          }
        }
      } catch (e) {
        if (e instanceof CliError) { console.error(chalk.red(e.message)); process.exit(1); }
        throw e;
      }
    });

  account
    .command("update <idOrName>")
    .description("Update account credentials")
    .option("-n, --name <name>", "New account name")
    .option("--api-key <key>", "New API key")
    .option("--secret <secret>", "New API secret")
    .option("--passphrase <passphrase>", "New passphrase")
    .action(async (idOrName: string, opts) => {
      try {
        const result = await updateAccount(idOrName, {
          name: opts.name,
          api_key: opts.apiKey,
          secret: opts.secret,
          passphrase: opts.passphrase,
        });
        if (!result.success) throw CliError.operationFailed("account update", result.error!);
        console.log(chalk.green(`Account updated: ${result.account!.name} (${result.account!.id})`));
      } catch (e) {
        if (e instanceof CliError) { console.error(chalk.red(e.message)); process.exit(1); }
        throw e;
      }
    });

  account
    .command("remove <idOrName>")
    .description("Remove a trading account")
    .action(async (idOrName: string) => {
      try {
        const result = await removeAccount(idOrName);
        if (!result.success) throw CliError.operationFailed("account remove", result.error!);
        console.log(chalk.green("Account removed."));
      } catch (e) {
        if (e instanceof CliError) { console.error(chalk.red(e.message)); process.exit(1); }
        throw e;
      }
    });

  account
    .command("test <idOrName>")
    .description("Test API connectivity")
    .action(async (idOrName: string) => {
      try {
        console.log("Testing connection...");
        const result = await testAccount(idOrName);
        if (result.success) {
          console.log(chalk.green(`Connection successful! (${result.latency_ms}ms)`));
        } else {
          throw CliError.operationFailed("account test", `${result.error}${result.latency_ms ? ` (${result.latency_ms}ms)` : ""}`);
        }
      } catch (e) {
        if (e instanceof CliError) { console.error(chalk.red(e.message)); process.exit(1); }
        throw e;
      }
    });
}
