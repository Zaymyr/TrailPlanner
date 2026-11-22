"use client";

import { useEffect, useState } from "react";

import { TabsList } from "../../../components/ui/tabs";
import { replaceLocationSearch } from "../admin-tabs";
import { AdminMessagingTab } from "../_components/AdminMessagingTab";
import { InboxQueue } from "../_components/inbox/InboxQueue";
import { INBOX_PAGE_VIEWS, readInboxMode, searchForInboxMode, type InboxMode } from "../_components/inbox/inbox-mode";
import { useAdminInbox } from "../_components/inbox/useAdminInbox";
import { useAdminAccessToken } from "../_components/shell/AdminAccess";
import { AdminPageHeader } from "../_components/shell/AdminPageHeader";
import { inboxTotals, useInboxCounts, withCount } from "../_components/useInboxCounts";

/**
 * « À traiter » (lot 2): « File » is the single queue of every pending item (oldest first, each row
 * opens the screen where it is handled); « Traiter » keeps the Messagerie sub-tabs and their dialogs
 * (bugs, feedback, race and demo requests). Organizer requests are handled in Organisateurs.
 */
export default function AdminInboxPage() {
  const accessToken = useAdminAccessToken();
  const [mode, setModeState] = useState<InboxMode>("file");
  useEffect(() => setModeState(readInboxMode(window.location.search)), []);
  const inbox = useAdminInbox(accessToken);
  const counts = useInboxCounts(accessToken);
  const messages = inboxTotals(counts.data).messages;
  const setMode = (next: InboxMode) => {
    replaceLocationSearch(searchForInboxMode(window.location.search, next));
    if (next === "file" && mode !== "file") {
      // Something may have been answered in « Traiter ».
      inbox.refetch();
      counts.refetch();
    }
    setModeState(next);
  };
  return (
    <>
      <AdminPageHeader
        title="À traiter"
        description="Tout ce qui attend une action, du plus ancien au plus récent. Chaque ligne ouvre l’écran où l’élément se traite."
      />
      <div className="mb-4">
        <TabsList
          tabs={[
            { id: "file", label: "File" },
            { id: "traiter", label: withCount("Traiter les messages", messages) },
          ]}
          activeTab={mode}
          onTabChange={(next) => setMode(next as InboxMode)}
        />
      </div>
      {mode === "file" ? (
        <InboxQueue accessToken={accessToken} />
      ) : (
        <AdminMessagingTab accessToken={accessToken} views={INBOX_PAGE_VIEWS} title="Bugs, feedback et demandes" defaultView={null} />
      )}
    </>
  );
}
