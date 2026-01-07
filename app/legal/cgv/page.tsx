export default function ConditionsVentePage() {
  return (
    <div className="space-y-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl sm:p-8">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Pace Yourself</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
            Conditions Générales de Vente (CGV)
          </h1>
          <p className="text-base text-slate-300 sm:text-lg">
            Modalités applicables aux offres payantes, facturation et conditions de résiliation.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Offre et prix</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Présentation des fonctionnalités payantes et de leurs limitations.</li>
          <li>Tarifs indiqués en euros, taxes comprises sauf mention contraire.</li>
          <li>TODO [Nom de l&apos;entreprise] se réserve le droit d&apos;ajuster les prix avec préavis raisonnable.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Commande et paiement</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Processus de souscription détaillé et confirmation par e-mail.</li>
          <li>Facturation automatisée avec moyen de paiement sécurisé.</li>
          <li>Contact facturation : TODO [Adresse e-mail de contact].</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Durée, résiliation et remboursement</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Accès mensuel ou annuel renouvelé automatiquement sauf résiliation.</li>
          <li>Droit de rétractation selon la réglementation applicable lorsque pertinent.</li>
          <li>Conditions de remboursement en cas d&apos;interruption ou d&apos;incident de service.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Service client</h2>
        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
          Pour toute question sur la facturation ou pour exercer vos droits, merci de nous écrire à : TODO [Adresse
          e-mail de contact].
        </p>
      </section>
    </div>
  );
}
