import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL || "file:./dev.sqlite";

if (!databaseUrl.startsWith("file:")) {
  console.log("Skipping SQLite setup because DATABASE_URL is not a file URL.");
  process.exit(0);
}

const rawPath = databaseUrl.slice("file:".length);
const databasePath = rawPath.startsWith("/")
  ? rawPath
  : resolve("prisma", rawPath.replace(/^\.\//, ""));

mkdirSync(dirname(databasePath), { recursive: true });

const sessionTableSql = `
CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "isOnline" BOOLEAN NOT NULL DEFAULT false,
  "scope" TEXT,
  "expires" DATETIME,
  "accessToken" TEXT NOT NULL,
  "userId" BIGINT,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "accountOwner" BOOLEAN NOT NULL DEFAULT false,
  "locale" TEXT,
  "collaborator" BOOLEAN DEFAULT false,
  "emailVerified" BOOLEAN DEFAULT false,
  "refreshToken" TEXT,
  "refreshTokenExpires" DATETIME
);
`;

execFileSync("sqlite3", [databasePath], {
  input: sessionTableSql,
  stdio: ["pipe", "inherit", "inherit"],
});

console.log(`SQLite session table is ready at ${databasePath}`);
