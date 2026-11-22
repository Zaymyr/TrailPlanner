import { AdminPlaceholderPage } from "../../_components/shell/AdminPageHeader";

export default function AdminSystemAuditPage() {
  return (
    <AdminPlaceholderPage
      title="Journal"
      lot={7}
      description="Le journal des actions admin (qui, quoi, quand, avant / après) arrive au lot 7."
      links={[{ href: "/admin", label: "Vue d’ensemble" }]}
    />
  );
}
