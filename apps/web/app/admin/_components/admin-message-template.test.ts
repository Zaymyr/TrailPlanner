import { describe, expect, it } from "vitest";

import { adminMessageBody, adminMessageTitle, handledRowClassName } from "./admin-message-template";

describe("admin message template", () => {
  it("wraps the message between the greeting and Faustin's signature", () => {
    expect(adminMessageBody("C'est corrigé.")).toBe("Bonjour,\n\nC'est corrigé.\n\nFaustin de Pace Yourself");
  });

  it("leaves an empty line to write in when there is no prefilled text", () => {
    expect(adminMessageBody()).toBe("Bonjour,\n\n\n\nFaustin de Pace Yourself");
  });

  it("keeps titles within the 160-character database limit", () => {
    expect(adminMessageTitle("a".repeat(200))).toHaveLength(160);
    expect(adminMessageTitle("Court")).toBe("Court");
  });

  it("greys only handled items", () => {
    expect(handledRowClassName("pending")).toBe("");
    expect(handledRowClassName("completed")).toBe("opacity-60");
    expect(handledRowClassName("rejected")).toBe("opacity-60");
  });
});
