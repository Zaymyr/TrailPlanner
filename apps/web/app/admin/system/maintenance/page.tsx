import { AdminPlaceholderPage } from "../../_components/shell/AdminPageHeader";

export default function AdminSystemMaintenancePage() {
  return (
    <AdminPlaceholderPage
      title="Maintenance"
      lot={3}
      description="Les actions sans écran (rattrapage et nettoyage des livrets publiés, synchronisation Resend, imports Betrail) et le suivi des tâches planifiées arrivent au lot 3."
      links={[{ href: "/admin/system/automation", label: "Automatisations" }]}
    />
  );
}
