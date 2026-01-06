export default function MentionsLegalesPage() {
  return (
    <div className="space-y-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl sm:p-8">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">TrailPlanner</p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">Mentions légales</h1>
          <p className="text-base text-slate-300 sm:text-lg">
            Informations légales sur l&apos;éditeur du site, son hébergeur et les conditions d&apos;utilisation du service.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Informations sur l&apos;éditeur</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Nom de la société : TODO [Nom de l&apos;entreprise]</li>
          <li>Adresse : TODO [Adresse complète de l&apos;entreprise]</li>
          <li>SIRET : TODO [Numéro SIRET]</li>
          <li>Contact : TODO [Adresse e-mail de contact]</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Hébergement</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Hébergeur du site : TODO [Nom et coordonnées de l&apos;hébergeur]</li>
          <li>Localisation des serveurs et principales garanties de disponibilité.</li>
          <li>Procédure de contact en cas d&apos;incident : TODO [Adresse e-mail de contact].</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Responsabilité</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Les informations fournies sur le site le sont à titre indicatif et peuvent évoluer.</li>
          <li>Les utilisateurs s&apos;engagent à vérifier la pertinence des conseils avant toute mise en pratique.</li>
          <li>L&apos;éditeur ne saurait être responsable des dommages directs ou indirects liés à l&apos;utilisation du site.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Contact</h2>
        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
          Pour toute question relative aux mentions légales ou pour signaler un contenu, vous pouvez nous contacter à :
          TODO [Adresse e-mail de contact].
        </p>
      </section>
    </div>
  );
}
