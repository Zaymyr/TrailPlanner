import { AdminPlaceholderPage } from "../_components/shell/AdminPageHeader";

export default function AdminBillingPage() {
  return (
    <AdminPlaceholderPage
      title="Ventes & facturation"
      lot={4}
      description="Le registre unique (paiements Stripe, abonnements, packs, virements, factures, survols, remboursements) arrive au lot 4. En attendant, les packs, factures et virements se gèrent par édition dans Organisateurs › Publier le livret."
      links={[{ href: "/admin/organizers", label: "Ouvrir la facturation des organisateurs" }]}
    />
  );
}
