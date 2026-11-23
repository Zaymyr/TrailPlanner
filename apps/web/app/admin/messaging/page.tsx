"use client";

import type { Route } from "next";
import Link from "next/link";

import { MessagesHistory } from "../_components/messaging/MessagesHistory";
import { useAdminAccessToken } from "../_components/shell/AdminAccess";
import { AdminPageHeader } from "../_components/shell/AdminPageHeader";

/** Communication › Messages & notifications (lot 5): history of the admin messages and « Nouveau message ». */
export default function AdminMessagingPage() {
  const accessToken = useAdminAccessToken();
  return (
    <>
      <AdminPageHeader
        title="Messages & notifications"
        description="Historique des messages envoyés aux coureurs : messages de l’admin, réponses aux demandes de course, questionnaires."
        actions={
          <Link href={"/admin/messaging/surveys" as Route} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
            Questionnaires →
          </Link>
        }
      />
      <MessagesHistory accessToken={accessToken} />
    </>
  );
}
