import { randomBytes } from "crypto";

const cron = randomBytes(32).toString("hex");
const session = randomBytes(32).toString("hex");

console.log("ZONNING production secrets — paste into Vercel / .env\n");
console.log(`CRON_SECRET=${cron}`);
console.log(`SESSION_SECRET=${session}`);
console.log("\nKeep these private. SESSION_SECRET must differ from CRON_SECRET.");
