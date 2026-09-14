import { supportEmail } from "../../support/copy";
import { buildLegalMetadata } from "../metadata";

export const metadata = buildLegalMetadata({
  path: "/legal/mentions-legales",
  title: "Mentions légales | Pace Yourself",
  description: "Informations sur l’éditeur, le contact et les responsabilités du service Pace Yourself.",
});

export default function MentionsLegalesPage() {
  return (
    <div className="space-y-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl sm:p-8">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Pace Yourself</p>
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
          <li>Éditeur : Faustin Bertrand, entrepreneur individuel sous le régime de la micro-entreprise</li>
          <li>Nom commercial et service édité : Pace Yourself</li>
          <li>Adresse : 10 avenue Félix Faure, 69580 Sathonay-Camp, France</li>
          <li>SIREN : 109 903 757</li>
          <li>SIRET : 109 903 757 00010</li>
          <li>Immatriculation : RCS Lyon n° 109 903 757</li>
          <li>TVA non applicable, art. 293 B du CGI</li>
          <li>
            E-mail : <a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </li>
          <li>
            Téléphone : <a className="underline" href="tel:+33623203657">06 23 20 36 57</a>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Directeur de la publication</h2>
        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">Faustin Bertrand</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Hébergement</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300 sm:text-base">
          <li>Hébergeur : Vercel Inc.</li>
          <li>Adresse : 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis</li>
          <li>Téléphone : +1 559 288 7060</li>
          <li>
            Site : <a className="underline" href="https://vercel.com" rel="noreferrer">vercel.com</a>
          </li>
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
          Pour toute question relative aux mentions légales ou pour signaler un contenu, écrivez à {supportEmail}.
        </p>
      </section>
    </div>
  );
}
