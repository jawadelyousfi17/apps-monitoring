import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Direct (non-pooled) connection. Used by CLI migrate/generate and,
    // for now, by the runtime client too (see lib/prisma.ts).
    url: process.env["DIRECT_URL"],
  },
});
