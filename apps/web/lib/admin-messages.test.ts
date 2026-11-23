import { describe, expect, it } from "vitest";

import { adminMessagesFilter, mapAdminMessage, messageChannels, readAdminMessagesQuery, writeAdminMessagesQuery, type AdminMessageRow } from "./admin-messages";

const USER = "22222222-2222-4222-8222-222222222222";
const row = (patch: Partial<AdminMessageRow> = {}): AdminMessageRow => ({
  id: "m1", user_id: USER, created_by: "admin", race_request_id: null, feedback_id: null, kind: "admin_message", title: "Bonjour", body: "Texte",
  read_at: null, deleted_at: null, email_requested: false, email_status: "not_requested", push_requested: false, push_status: "not_requested", push_sent_count: 0,
  created_at: "2026-11-20T10:00:00.000Z", ...patch,
});

describe("admin message history", () => {
  it("reads and writes the URL of the page", () => {
    const query = readAdminMessagesQuery(new URLSearchParams(`recherche=%20merci%20&type=demande,questionnaire,inconnu&destinataire=${USER}&page=3`));
    expect(query).toEqual({ search: "merci", kinds: ["race_request_status", "feedback_survey"], userId: USER, page: 3 });
    expect(writeAdminMessagesQuery(query).toString()).toBe(`recherche=merci&type=demande%2Cquestionnaire&destinataire=${USER}&page=3`);
    expect(readAdminMessagesQuery(new URLSearchParams("destinataire=pas-un-uuid&page=-2"))).toEqual({ search: "", kinds: [], userId: null, page: 1 });
    expect(writeAdminMessagesQuery({ page: 1 }).toString()).toBe("");
  });

  it("builds PostgREST filters without letting the search change the or() syntax", () => {
    expect(adminMessagesFilter({ search: "", kinds: [], userId: null })).toEqual([]);
    expect(adminMessagesFilter({ search: "", kinds: ["admin_message", "race_request_status", "feedback_survey"], userId: null })).toEqual([]);
    const filters = adminMessagesFilter({ search: "merci, (vraiment)*", kinds: ["admin_message"], userId: USER });
    expect(filters[0]).toBe("kind=in.(admin_message)");
    expect(filters[1]).toBe(`user_id=eq.${USER}`);
    expect(decodeURIComponent(filters[2])).toBe("or=(title.ilike.*merci vraiment*,body.ilike.*merci vraiment*)");
  });

  it("lists the channels that were requested with their delivery state", () => {
    expect(messageChannels(row()).map((channel) => channel.label)).toEqual(["Boîte de réception"]);
    const channels = messageChannels(row({ email_requested: true, email_status: "failed", push_requested: true, push_status: "sent", push_sent_count: 2 }));
    expect(channels.map((channel) => [channel.label, channel.tone])).toEqual([
      ["Boîte de réception", "neutral"],
      ["E-mail échec", "danger"],
      ["Push envoyé (2 appareils)", "success"],
    ]);
  });

  it("maps a row with its recipient, read state and what it answers", () => {
    expect(mapAdminMessage(row(), { email: "camille@gmail.com" })).toMatchObject({ recipient: "camille@gmail.com", readState: "unread", context: null, href: null, kindLabel: "Message" });
    expect(mapAdminMessage(row({ kind: "race_request_status", race_request_id: 4, read_at: "2026-11-21T00:00:00.000Z" }), { name: "Camille" })).toMatchObject({
      recipient: "Camille", readState: "read", context: "Demande de course n° 4", href: "/admin/inbox?vue=demandes",
    });
    expect(mapAdminMessage(row({ feedback_id: 9, deleted_at: "2026-11-22T00:00:00.000Z" }), {}, "feedback")).toMatchObject({
      recipient: "Compte coureur", readState: "deleted", context: "Retour n° 9", href: "/admin/inbox?vue=feedback",
    });
  });
});
