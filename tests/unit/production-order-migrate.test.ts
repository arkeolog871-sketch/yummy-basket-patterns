import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const SCRIPT = join(ROOT, "scripts/production-apply-order-migration.mjs");

describe("production order migration apply guard", () => {
  it("refuses to run without the explicit allow flag", () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, ALLOW_PRODUCTION_ORDER_MIGRATION: "", PRODUCTION_DATABASE_URL: "" },
    });
    expect(result.status).toBe(3);
    expect(result.stderr).toMatch(/ALLOW_PRODUCTION_ORDER_MIGRATION/);
  });

  it("refuses a non-production database URL even when allowed", () => {
    const result = spawnSync(process.execPath, [SCRIPT], {
      encoding: "utf8",
      env: {
        ...process.env,
        ALLOW_PRODUCTION_ORDER_MIGRATION: "YES",
        PRODUCTION_DATABASE_URL: "postgresql://postgres:x@localhost:5432/silvan_rpc_test",
      },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/production project ref/);
  });
});
