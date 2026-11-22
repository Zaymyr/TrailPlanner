import { AdminPlaceholderPage } from "../_components/shell/AdminPageHeader";

export default function AdminMessagingPage() {
  return (
    <AdminPlaceholderPage
      title="Messages & notifications"
      lot={5}
      description="L’historique des messages envoyés arrive avec les fiches clients (lot 5). Pour écrire à un coureur aujourd’hui : Coureurs › ouvre la ligne › « Envoyer un message »."
      links={[
        { href: "/admin/runners", label: "Écrire depuis Coureurs" },
        { href: "/admin/messaging/surveys", label: "Questionnaires" },
      ]}
    />
  );
}
