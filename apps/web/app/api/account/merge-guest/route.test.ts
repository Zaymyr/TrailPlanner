import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { guestOwnedReferences, moveGuestOwnedReferences } from "../../../../lib/guest-merge";

describe("guest account notification merge", () => {
  it("moves notification ownership without changing the creator", async () => {
    const updates: Array<{ table: string; values: Record<string, string>; column: string; source: string }> = [];
    const fakeClient = {
      from: (table: string) => ({
        update: (values: Record<string, string>) => ({
          eq: async (column: string, source: string) => {
            updates.push({ table, values, column, source });
            return { error: null };
          },
        }),
      }),
    };

    await moveGuestOwnedReferences(
      fakeClient as never,
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    );

    expect(guestOwnedReferences).toContainEqual(["user_notifications", "user_id"]);
    const notificationUpdate = updates.find((entry) => entry.table === "user_notifications");
    expect(notificationUpdate).toEqual({
      table: "user_notifications",
      values: { user_id: "22222222-2222-4222-8222-222222222222" },
      column: "user_id",
      source: "11111111-1111-4111-8111-111111111111",
    });
    expect(notificationUpdate?.values).not.toHaveProperty("created_by");
  });

  it("moves owned rows before deleting the source Auth user", () => {
    const source = readFileSync(resolve(process.cwd(), "app/api/account/merge-guest/route.ts"), "utf8");
    expect(source.indexOf("await moveGuestOwnedReferences(")).toBeLessThan(
      source.indexOf("adminClient.auth.admin.deleteUser(sourceUser.id)")
    );
  });
});
