export default function PrivacyPage() {
  return (
    <div className="space-y-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl sm:p-8">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Pace Yourself</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">Politique de confidentialité</h1>
          <p className="text-base text-slate-300 sm:text-lg">
            Détails sur la collecte, l&apos;utilisation et la protection de vos données personnelles lors de l&apos;usage
            de Pace Yourself.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Responsable du traitement</h2>
        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
          Le responsable du traitement des données est TODO [Nom de l&apos;entreprise], dont le siège est situé à TODO
          [Adresse complète de l&apos;entreprise], immatriculée sous le numéro TODO [Numéro SIRET].
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Données collectées</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Données de compte : e-mail, langue préférée et informations fournies lors de l&apos;inscription.</li>
          <li>Données d&apos;usage : interactions avec les pages, préférences de planification et métriques de performance.</li>
          <li>Données techniques : type de navigateur, adresse IP tronquée et identifiants de session nécessaires.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Finalités et bases légales</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Fourniture du service et personnalisation des recommandations (exécution du contrat).</li>
          <li>Sécurisation des comptes, prévention des fraudes et maintien de la disponibilité (intérêt légitime).</li>
          <li>Envoi d&apos;actualités ou de conseils après consentement explicite.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Partage et hébergement des données</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Données hébergées par TODO [Nom et coordonnées de l&apos;hébergeur].</li>
          <li>Accès restreint aux prestataires nécessaires au fonctionnement du service.</li>
          <li>Aucun transfert à des tiers non autorisés sans votre consentement préalable.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Durée de conservation</h2>
        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
          Les données sont conservées pendant la durée de votre utilisation du service, puis archivées ou supprimées
          conformément aux obligations légales et aux bonnes pratiques de sécurité.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Vos droits</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Droit d&apos;accès, de rectification, d&apos;effacement et de limitation du traitement.</li>
          <li>Droit d&apos;opposition pour motifs légitimes et droit à la portabilité de vos données.</li>
          <li>Droit d&apos;introduire une réclamation auprès de l&apos;autorité compétente.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Contact</h2>
        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
          Pour exercer vos droits ou poser une question sur la gestion des données, écrivez-nous à : TODO [Adresse
          e-mail de contact].
        </p>
      </section>
    </div>
  );
}
