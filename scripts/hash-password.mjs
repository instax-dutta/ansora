#!/usr/bin/env node
/**
 * Ansora password hasher.
 *
 * Usage:
 *   npm run hash-password                 # prompts for a password
 *   npm run hash-password -- "my secret"  # hashes the given argument
 *
 * Prints a bcrypt hash suitable for ADMIN_PASSWORD_HASH. Plaintext passwords
 * are never written to disk or logged.
 */
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";

const ROUNDS = 12;

function hash(password) {
  return bcrypt.hashSync(password, ROUNDS);
}

async function promptPassword() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("Enter admin password: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const arg = process.argv.slice(2).join(" ");
  const password = arg || (await promptPassword());

  if (!password) {
    console.error("Error: no password provided.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Warning: passwords shorter than 8 characters are not recommended.");
  }

  const digest = hash(password);
  console.log("\nCopy this into ADMIN_PASSWORD_HASH:\n");
  console.log(digest + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
