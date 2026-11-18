import { describe, expect, it } from "vitest";

import { toExpoPushMessage } from "./push";

const reminder = {
  expoPushToken: "ExponentPushToken[abc]",
  title: "Message",
  body: "Bonjour",
  payload: { href: "/(app)/profile?tab=notifications" },
};

describe("toExpoPushMessage", () => {
  it("carries the unread badge count when one is known", () => {
    expect(toExpoPushMessage({ ...reminder, badge: 3 })).toEqual({
      to: "ExponentPushToken[abc]",
      title: "Message",
      body: "Bonjour",
      sound: "default",
      data: { href: "/(app)/profile?tab=notifications" },
      badge: 3,
    });
  });

  it("leaves the app icon badge untouched for reminders without a count", () => {
    expect(toExpoPushMessage(reminder)).not.toHaveProperty("badge");
  });
});
