export default function ConditionsUtilisationPage() {
  return (
    <div className="space-y-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl sm:p-8">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">TrailPlanner</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
            Conditions Générales d&apos;Utilisation (CGU)
          </h1>
          <p className="text-base text-slate-300 sm:text-lg">
            Règles d&apos;utilisation du service, responsabilités des utilisateurs et limites de garantie.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Objet du service</h2>
        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
          TrailPlanner aide les athlètes d&apos;ultra-trail à planifier leur ravitaillement et leur stratégie de course.
          Le service fournit des informations indicatives et ne remplace pas un avis médical ou professionnel.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Accès et inscription</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Création de compte avec une adresse e-mail valide.</li>
          <li>Responsabilité de maintenir des identifiants confidentiels.</li>
          <li>Suspension possible en cas d&apos;usage abusif ou frauduleux.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Utilisation responsable</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Ne pas détourner le service, ni tenter d&apos;accéder à des données non autorisées.</li>
          <li>Vérifier l&apos;exactitude des données saisies pour obtenir des recommandations pertinentes.</li>
          <li>Respecter les droits d&apos;auteur et les licences liées aux contenus fournis.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Limitation de responsabilité</h2>
        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
          L&apos;éditeur ne garantit pas l&apos;absence d&apos;erreurs dans les données ou les calculs et décline toute
          responsabilité pour les conséquences d&apos;un entraînement ou d&apos;une course basés sur ces informations. Les
          utilisateurs doivent consulter un professionnel de santé avant toute adaptation majeure de leur pratique.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Contact</h2>
        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
          Pour toute question relative aux conditions d&apos;utilisation, contactez-nous à : TODO [Adresse e-mail de
          contact].
        </p>
      </section>
    </div>
  );
}
