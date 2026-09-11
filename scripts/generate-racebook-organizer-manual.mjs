import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "docs", "assets", "racebook-organizer-manual");
const baseURL = process.env.RACEBOOK_MANUAL_BASE_URL ?? "http://127.0.0.1:3000";
const eventId = "11111111-1111-4111-8111-111111111111";
const editionId = "22222222-2222-4222-8222-222222222222";
const raceId = "33333333-3333-4333-8333-333333333333";
const membershipId = "44444444-4444-4444-8444-444444444444";

const event = {
  id: eventId,
  name: "Trail des Crêtes — Démo",
  location: "Annecy, Haute-Savoie",
  race_date: "2027-06-12",
  thumbnail_url: null,
  is_live: true,
  organizerDetails: {
    officialWebsiteUrl: "https://example.org/trail-des-cretes",
    instagramUrl: "https://instagram.com/traildescretes",
    facebookUrl: "",
    emergencyContact: { name: "PC Course", phone: "+33 6 00 00 00 00" },
    mandatoryEquipment: {
      weatherPlan: "normal",
      items: [
        { id: "equipment-1", label: "Couverture de survie", required: true, cold: false, heat: false, note: null },
        { id: "equipment-2", label: "Téléphone chargé", required: true, cold: false, heat: false, note: null },
        { id: "equipment-3", label: "Réserve d’eau de 1 litre", required: true, cold: false, heat: true, note: null },
        { id: "equipment-4", label: "Bâtons", required: false, cold: false, heat: false, note: null },
      ],
      note: "Contrôle possible à l’entrée du SAS. Le matériel peut être adapté selon la météo.",
    },
    bibPickup: {
      location: "Salle des fêtes, 12 rue du Lac, Annecy",
      locationDetails: { label: "Salle des fêtes, 12 rue du Lac, Annecy", lat: 45.8992, lng: 6.1294, googleMapsUrl: "https://maps.google.com/?q=45.8992,6.1294", source: "manual" },
      locations: [{
        location: "Salle des fêtes, 12 rue du Lac, Annecy",
        locationDetails: { label: "Salle des fêtes, 12 rue du Lac, Annecy", lat: 45.8992, lng: 6.1294, googleMapsUrl: "https://maps.google.com/?q=45.8992,6.1294", source: "manual" },
        slots: [
          { date: "2027-06-11", startTime: "16:00", endTime: "20:00" },
          { date: "2027-06-12", startTime: "05:00", endTime: "06:15" },
        ],
      }],
      requiredDocuments: "Pièce d’identité et certificat si nécessaire.",
      thirdPartyPickupAllowed: true,
      equipmentCheck: true,
      note: "Prévoir le numéro de dossard reçu par e-mail.",
    },
    access: {
      startAddress: "Le Pâquier, Annecy",
      startLocation: { label: "Le Pâquier, Annecy", lat: 45.9032, lng: 6.1298, googleMapsUrl: "https://maps.google.com/?q=45.9032,6.1298", source: "manual" },
      finishAddress: "Le Pâquier, Annecy",
      finishLocation: { label: "Le Pâquier, Annecy", lat: 45.9032, lng: 6.1298, googleMapsUrl: "https://maps.google.com/?q=45.9032,6.1298", source: "manual" },
      officialParkings: "Parking Bonlieu et parking de l’Hôtel de Ville. Suivre le fléchage organisation.",
      shuttles: "Navettes depuis la gare d’Annecy vers la zone de départ.",
      shuttleSchedule: "Toutes les 20 minutes de 4 h 45 à 6 h 15.",
      roadRestrictions: "Quai Napoléon III fermé de 5 h à 8 h.",
      mapUrl: "https://maps.google.com/?q=Le+Paquier+Annecy",
      note: "Arriver au moins 45 minutes avant le départ.",
    },
  },
  editions: [{
    id: editionId,
    event_id: eventId,
    edition_year: 2027,
    start_date: "2027-06-12",
    end_date: "2027-06-13",
    is_current: true,
    is_visible: true,
    module_setup_completed_at: "2026-09-11T08:00:00.000Z",
    serviceCount: 2,
    sponsorCount: 1,
    sponsorClicks: 24,
    brandingConfigured: false,
    brandingUnpublished: false,
    entitlement: { tier: "complete", status: "active", source: "admin" },
  }],
  races: [{
    id: raceId,
    edition_id: editionId,
    edition_group_id: "55555555-5555-4555-8555-555555555555",
    series_name: "La Grande Traversée",
    name: "La Grande Traversée — 42 km",
    external_site_url: "https://example.org/trail-des-cretes/42-km",
    location_text: "Annecy",
    race_date: "2027-06-12",
    distance_km: 42.3,
    elevation_gain_m: 2450,
    elevation_loss_m: 2450,
    gpx_storage_path: "demo/trail-des-cretes-42k.gpx",
    thumbnail_url: null,
    is_live: false,
    participation_mode: "solo",
    data_status: "complete",
    missing_required_fields: [],
    racebook_is_live: false,
    racebook_preview_is_visible: true,
    racebook_publication_approved_at: null,
    aidStationCount: 3,
    startWaveCount: 2,
    awardCount: 2,
    organizerDetails: {
      schedule: {
        startTime: "06:30",
        timeLimit: "10:00",
        bibBriefing: "Briefing obligatoire 10 minutes avant le départ.",
      },
      raceLocation: { label: "Pâquier, Annecy" },
      mandatoryEquipment: { overrideEnabled: false, required: [], recommended: [], notes: "" },
      bibPickup: { overrideEnabled: false },
      access: { overrideEnabled: false },
    },
  }],
};

const moduleSettings = {
  setupCompletedAt: "2026-09-11T08:00:00.000Z",
  tier: "complete",
  edition: {
    equipment: true,
    bib_pickup: true,
    access: true,
    services: true,
    branding: true,
    sponsors: true,
  },
  races: {
    [raceId]: {
      aid_stations: true,
      start_waves: true,
      awards: true,
      relay: true,
      official_products: true,
    },
  },
};

const json = (body, status = 200) => ({
  status,
  contentType: "application/json; charset=utf-8",
  body: JSON.stringify(body),
});

async function installDemoRoutes(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("trailplanner.accessToken", "manual-demo-token");
    window.localStorage.setItem("trailplanner.refreshToken", "manual-demo-refresh");
    window.localStorage.setItem("trailplanner.sessionEmail", "organisation@example.org");
    window.localStorage.setItem("cookie_consent", "refused");
  });

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    if (pathname === "/api/auth/session") {
      return route.fulfill(json({
        user: { id: "66666666-6666-4666-8666-666666666666", email: "organisation@example.org", role: "organizer", roles: ["organizer"], isAnonymous: false },
        access_token: "manual-demo-token",
        refresh_token: "manual-demo-refresh",
      }));
    }
    if (pathname === "/api/entitlements") {
      return route.fulfill(json({ entitlements: { isPremium: true, planLimit: 999, favoriteLimit: 999, customProductLimit: 999, allowExport: true, allowAutoFill: true } }));
    }
    if (pathname === "/api/resend/contact") return route.fulfill(json({ status: "ok" }));
    if (pathname === "/api/organizer/bootstrap") {
      return route.fulfill(json({
        claims: [],
        editionRequests: [],
        publicationRequests: [],
        memberships: [{ id: membershipId, event_id: eventId, role: "owner", dashboard_onboarding_completed_at: "2026-09-11T08:00:00.000Z", race_events: { id: eventId, name: event.name, location: event.location, race_date: event.race_date, is_live: true } }],
        event,
      }));
    }
    if (pathname === `/api/organizer/events/${eventId}`) return route.fulfill(json({ event }));
    if (pathname === `/api/organizer/editions/${editionId}/module-settings`) return route.fulfill(json(moduleSettings));
    if (pathname === `/api/organizer/events/${eventId}/updates`) return route.fulfill(json({ favoriteCount: 128, updates: [] }));
    if (pathname === `/api/organizer/races/${raceId}/aid-stations`) {
      return route.fulfill(json({ aidStations: [
        { id: "77777777-7777-4777-8777-777777777771", name: "Col du Pré Vernet", km: 12.4, water_available: true, solid_available: true, assistance_allowed: false, notes: "Eau, fruits et salé.", organizerDetails: {} },
        { id: "77777777-7777-4777-8777-777777777772", name: "Semnoz", km: 27.8, water_available: true, solid_available: true, assistance_allowed: true, notes: "Base vie et assistance autorisée.", organizerDetails: {} },
        { id: "77777777-7777-4777-8777-777777777773", name: "Les Puisots", km: 36.2, water_available: true, solid_available: false, assistance_allowed: false, notes: "Eau uniquement.", organizerDetails: {} },
      ] }));
    }
    if (pathname === `/api/organizer/races/${raceId}/relay-points`) return route.fulfill(json({ relayPoints: [] }));
    if (pathname === `/api/organizer/races/${raceId}/aid-station-products`) return route.fulfill(json({ stationProducts: [] }));
    if (pathname === `/api/organizer/races/${raceId}/gpx`) {
      return route.fulfill(json({ preview: { stats: { distanceKm: 42.3, gainM: 2450, lossM: 2450, minAltM: 448, maxAltM: 1699 }, elevationProfile: [], detectedAidStations: [] } }));
    }
    if (pathname === "/api/products") return route.fulfill(json({ products: [] }));
    return route.fulfill(json({}));
  });
}

async function capture(page, name, locator = null) {
  await page.waitForTimeout(350);
  await page.addStyleTag({ content: "div.fixed.bottom-3.right-3 { display: none !important; }" });
  const target = locator ? page.locator(locator) : page;
  await target.screenshot({ path: path.join(outputDir, `${name}.png`), animations: "disabled" });
}

async function annotate(page, groups) {
  await page.locator("[data-manual-annotation]").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  const boxes = [];
  for (let index = 0; index < groups.length; index += 1) {
    const locators = Array.isArray(groups[index]) ? groups[index] : [groups[index]];
    const parts = (await Promise.all(locators.map((locator) => locator.boundingBox()))).filter(Boolean);
    const isFixed = (await Promise.all(locators.map((locator) => locator.evaluate((element) => {
      let current = element;
      while (current instanceof HTMLElement) {
        if (window.getComputedStyle(current).position === "fixed") return true;
        current = current.parentElement;
      }
      return false;
    })))).some(Boolean);
    if (parts.length === 0) throw new Error(`Missing annotation target ${index + 1}`);
    const left = Math.min(...parts.map((box) => box.x));
    const top = Math.min(...parts.map((box) => box.y));
    const right = Math.max(...parts.map((box) => box.x + box.width));
    const bottom = Math.max(...parts.map((box) => box.y + box.height));
    boxes.push({ number: index + 1, left, top, width: right - left, height: bottom - top, isFixed });
  }
  await page.evaluate((annotationBoxes) => {
    for (const box of annotationBoxes) {
      const padding = 7;
      const outline = document.createElement("div");
      outline.dataset.manualAnnotation = "true";
      Object.assign(outline.style, {
        position: box.isFixed ? "fixed" : "absolute",
        zIndex: "70",
        pointerEvents: "none",
        left: `${box.left + (box.isFixed ? 0 : window.scrollX) - padding}px`,
        top: `${box.top + (box.isFixed ? 0 : window.scrollY) - padding}px`,
        width: `${box.width + padding * 2}px`,
        height: `${box.height + padding * 2}px`,
        border: "4px solid #e84d2a",
        borderRadius: "12px",
        background: "rgba(232, 77, 42, 0.055)",
        boxShadow: "0 0 0 2px rgba(255,255,255,.95), 0 4px 14px rgba(82,31,17,.22)",
      });
      const badge = document.createElement("span");
      badge.textContent = String(box.number);
      Object.assign(badge.style, {
        position: "absolute",
        left: "-15px",
        top: "-15px",
        width: "30px",
        height: "30px",
        display: "grid",
        placeItems: "center",
        borderRadius: "999px",
        border: "3px solid white",
        background: "#e84d2a",
        color: "white",
        font: "800 15px/1 Arial, sans-serif",
        boxShadow: "0 2px 7px rgba(82,31,17,.35)",
      });
      outline.appendChild(badge);
      document.body.appendChild(outline);
    }
  }, boxes);
}

const esc = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

async function imageData(name) {
  const data = await readFile(path.join(outputDir, name));
  return `data:image/png;base64,${data.toString("base64")}`;
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.RACEBOOK_MANUAL_BROWSER_PATH
    ?? (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined),
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await installDemoRoutes(page);

await page.goto(`${baseURL}/organizers`, { waitUntil: "domcontentloaded" });
await page.locator("#organizer-new-event-name").waitFor();
await page.locator("#organizer-new-event-name").fill("Trail des Crêtes");
await page.locator("#organizer-new-event-location").fill("Annecy, Haute-Savoie");
await page.locator("#organizer-new-event-date").fill("2027-06-12");
await page.locator("#organizer-new-event-end-date").fill("2027-06-13");
await annotate(page, [
  page.locator("#organizer-new-event-name"),
  page.locator("#organizer-new-event-location"),
  [page.locator("#organizer-new-event-date"), page.locator("#organizer-new-event-end-date")],
  page.getByRole("button", { name: "Créer et continuer" }),
]);
await capture(page, "01-creation-evenement", "main");

await page.goto(`${baseURL}/organizer`, { waitUntil: "domcontentloaded" });
await page.getByText("Trail des Crêtes — Démo").first().waitFor();
const eventNameInput = page.locator("#organizer-onboarding-editor input").first();
await eventNameInput.fill("Trail des Crêtes — Démo ");
await page.getByRole("button", { name: "Sauvegarder" }).waitFor();
await annotate(page, [
  page.locator("#organizer-onboarding-selectors"),
  page.getByText("Préparation", { exact: true }).locator(".."),
  page.locator("#organizer-onboarding-scope-navigation:visible"),
  page.getByRole("button", { name: "Sauvegarder" }),
]);
await capture(page, "02-vue-ensemble", "main");

await page.goto(`${baseURL}/organizer`, { waitUntil: "domcontentloaded" });
await page.getByText("Trail des Crêtes — Démo").first().waitFor();
await page.getByRole("button", { name: "Gérer les sections" }).click();
await page.getByRole("heading", { name: "Sections du RaceBook" }).waitFor();
const sectionsDialog = page.locator("body > div.fixed.inset-0");
await annotate(page, [
  sectionsDialog.locator("section").nth(0),
  sectionsDialog.locator("section").nth(1),
  sectionsDialog.getByText("Brouillon privé").first().locator(".."),
  sectionsDialog.getByRole("button", { name: "Sauvegarder" }),
]);
await capture(page, "03-choix-sections", "body > div.fixed.inset-0");
await page.getByRole("button", { name: "Annuler" }).click();

await page.getByRole("button", { name: "Matériel" }).first().click();
await page.getByRole("heading", { name: "Matériel", level: 3 }).waitFor();
await annotate(page, [
  page.getByText("Plan météo actif").locator(".."),
  [page.getByRole("button", { name: "+ Réserve alimentaire" }), page.getByRole("button", { name: "+ Veste imperméable" }), page.getByRole("button", { name: "+ Lampe frontale" })],
  [page.locator('input[value="Couverture de survie"]'), page.locator('input[value="Bâtons"]')],
  page.getByLabel("Note matériel"),
]);
await capture(page, "04-materiel", "main");

await page.getByRole("button", { name: "Dossard" }).first().click();
await page.getByText("Retrait dossard commun", { exact: true }).waitFor();
const bibLocation = page.locator("article").filter({ hasText: "Lieu de retrait 1" });
await annotate(page, [
  bibLocation.getByLabel("Adresse du lieu"),
  [bibLocation.getByLabel("Jour").first(), bibLocation.getByLabel("Début").first(), bibLocation.getByLabel("Fin").first()],
  page.getByLabel("Documents nécessaires"),
  [page.getByText("Retrait par tiers", { exact: true }), page.getByText("Contrôle matériel", { exact: true })],
]);
await capture(page, "05-dossard", "main");

await page.getByRole("button", { name: "Accès" }).first().click();
await page.getByText("Accès commun événement", { exact: true }).waitFor();
await annotate(page, [
  [page.getByLabel("Adresse départ"), page.getByLabel("Adresse arrivée")],
  [page.getByLabel("Information prioritaire"), page.getByLabel("Routes fermées / restrictions")],
  [page.getByLabel("Parkings officiels"), page.getByLabel("Fonctionnement des navettes"), page.getByLabel("Horaires des navettes")],
  page.getByLabel("Lien vers une carte générale (optionnel)"),
]);
await capture(page, "06-acces", "main");

await page.getByRole("button", { name: /La Grande Traversée/ }).first().click();
await page.getByRole("button", { name: /^Course/ }).first().click();
await page.getByText("Détails du format").waitFor();
await annotate(page, [
  [page.getByLabel("Nom du format"), page.getByLabel("Distance km"), page.getByLabel("D+"), page.getByLabel("D-")],
  [page.getByText("Date différente de l'édition"), page.getByText("Lieu différent de l'événement")],
  page.getByLabel("Site officiel / source du format"),
  page.getByText("Remplacer le GPX source", { exact: true }).locator(".."),
]);
await capture(page, "07-format-gpx", "main");

await page.getByRole("button", { name: /Départ, ravitos/ }).first().click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Ravitos" }).last().click();
await page.getByText("Col du Pré Vernet").waitFor();
const firstStation = page.locator("article").filter({ hasText: "Col du Pré Vernet" });
await annotate(page, [
  [firstStation.getByText("Col du Pré Vernet"), firstStation.getByText("12.4 km")],
  [firstStation.getByText("Eau disponible"), firstStation.getByText("Solide disponible"), firstStation.getByText("Assistance")],
  [page.getByText("Consignes de barrières horaires"), page.getByText("Contraintes et consignes de course")],
  page.getByRole("button", { name: "Ajouter un ravito" }),
]);
await capture(page, "08-ravitaillements", "main");

const details = page.locator("details").filter({ hasText: "Visibilité" }).first();
if (await details.count()) {
  await details.locator("summary").click();
  await annotate(page, [
    details.locator("label").filter({ hasText: /^Masqué/ }),
    details.locator("label").filter({ hasText: /^Privé/ }),
    details.locator("label").filter({ hasText: /^Public/ }),
    page.getByRole("button", { name: "Publier" }),
  ]);
  await capture(page, "09-visibilite-publication", "main");
} else {
  await capture(page, "09-visibilite-publication", "main");
}

const images = Object.fromEntries(await Promise.all([
  "01-creation-evenement.png",
  "02-vue-ensemble.png",
  "03-choix-sections.png",
  "04-materiel.png",
  "05-dossard.png",
  "06-acces.png",
  "07-format-gpx.png",
  "08-ravitaillements.png",
  "09-visibilite-publication.png",
].map(async (name) => [name, await imageData(name)])));

const sections = [
  {
    kicker: "ÉTAPE 1 · DÉMARRER",
    title: "Créer l’événement et sa première édition",
    image: "01-creation-evenement.png",
    intro: "Depuis l’espace organisateurs, créez la fiche mère de votre course. Vous pourrez ensuite ajouter tous les formats de l’édition.",
    items: [
      ["1", "Saisissez le nom public de l’événement, sans année ni distance."],
      ["2", "Indiquez la commune ou le lieu principal."],
      ["3", "Renseignez la plage complète de dates de l’édition."],
      ["4", "Cliquez sur « Créer et continuer ». La fiche reste en brouillon."],
    ],
    tip: "Une nouvelle édition annuelle se crée ensuite depuis Actions → Créer une nouvelle édition.",
  },
  {
    kicker: "ÉTAPE 2 · SE REPÉRER",
    title: "Comprendre le tableau de bord",
    image: "02-vue-ensemble.png",
    intro: "Le haut de page sert à choisir l’événement et l’édition. La zone « Contenu du RaceBook » sépare les informations communes des informations propres à chaque format.",
    items: [
      ["1", "Vérifiez toujours l’événement et l’année sélectionnés avant de modifier."],
      ["2", "Suivez la jauge de préparation : vert = complet, orange = partiel, gris = vide."],
      ["3", "Ouvrez « Événement » pour les données partagées ; ouvrez un format pour ses données propres."],
      ["4", "Le bouton « Sauvegarder » apparaît dès qu’une modification est en attente."],
    ],
    tip: "Les changements de section peuvent être sauvegardés en arrière-plan lors d’un changement d’onglet, mais vérifiez le message de confirmation.",
  },
  {
    kicker: "ÉTAPE 3 · CONFIGURER",
    title: "Choisir les sections utiles",
    image: "03-choix-sections.png",
    intro: "Activez uniquement ce qui sera utile aux coureurs. Une section masquée conserve ses données et peut être réactivée plus tard.",
    items: [
      ["1", "Les sections communes s’appliquent automatiquement à tous les formats de l’édition."],
      ["2", "Les sections de format sont configurées pour le format actif ; depuis la vue Événement, elles s’appliquent à tous les formats existants."],
      ["3", "Un libellé d’offre indique qu’une section restera privée avec l’offre actuelle."],
      ["4", "Cliquez sur « Sauvegarder » ou « Enregistrer et terminer »."],
    ],
    tip: "Désactiver une section ne supprime jamais son contenu.",
  },
  {
    kicker: "ÉTAPE 4 · MATÉRIEL",
    title: "Préparer la liste du matériel",
    image: "04-materiel.png",
    intro: "La liste commune s’applique à tous les formats. Distinguez clairement le matériel obligatoire du matériel simplement recommandé.",
    items: [
      ["1", "Choisissez le plan météo de référence : normal, grand froid ou grosse chaleur."],
      ["2", "Utilisez les suggestions pour ajouter rapidement les équipements habituels."],
      ["3", "Pour chaque élément, précisez s’il est obligatoire ou recommandé et ses conditions météo."],
      ["4", "Ajoutez une note uniquement pour une consigne générale utile au contrôle."],
    ],
    tip: "La liste doit rester cohérente avec le règlement officiel et les dernières consignes météo.",
  },
  {
    kicker: "ÉTAPE 5 · DOSSARD",
    title: "Organiser le retrait des dossards",
    image: "05-dossard.png",
    intro: "Renseignez chaque lieu de retrait avec ses propres créneaux afin que le coureur sache précisément où et quand se présenter.",
    items: [
      ["1", "Ajoutez l’adresse complète du lieu de retrait."],
      ["2", "Créez un créneau par jour avec une heure de début et de fin."],
      ["3", "Listez les documents que le participant doit présenter."],
      ["4", "Indiquez si le retrait par un tiers est autorisé et si un contrôle matériel est prévu."],
    ],
    tip: "Ajoutez plusieurs lieux lorsque le retrait est réparti entre un village course et une zone de départ.",
  },
  {
    kicker: "ÉTAPE 6 · ACCÈS",
    title: "Expliquer comment venir sur place",
    image: "06-acces.png",
    intro: "Centralisez les lieux de départ et d’arrivée, les restrictions routières, les parkings et les navettes dans des blocs courts.",
    items: [
      ["1", "Renseignez les adresses exactes du départ et de l’arrivée."],
      ["2", "Mettez en avant l’information prioritaire et les éventuelles routes fermées."],
      ["3", "Décrivez les parkings officiels, le fonctionnement et les horaires des navettes."],
      ["4", "Ajoutez si besoin un lien vers une carte générale de l’organisation."],
    ],
    tip: "Réservez le champ prioritaire aux informations critiques : dernier départ de navette, route fermée ou accès limité.",
  },
  {
    kicker: "ÉTAPE 7 · REMPLIR UN FORMAT",
    title: "Renseigner le parcours et importer le GPX",
    image: "07-format-gpx.png",
    intro: "Chaque distance est un format distinct. Commencez par ses informations principales, puis ajoutez le GPX et contrôlez les valeurs calculées.",
    items: [
      ["1", "Renseignez nom, distance, D+, D− et type de participation."],
      ["2", "Conservez les dates et le lieu hérités, sauf si ce format est réellement différent."],
      ["3", "Ajoutez l’URL officielle de la page dédiée à ce format."],
      ["4", "Importez le fichier GPX, puis vérifiez distance, dénivelé, tracé et profil avant de sauvegarder."],
    ],
    tip: "Créez un format par distance ou formule : 10 km, 25 km, relais, etc.",
  },
  {
    kicker: "ÉTAPE 8 · INFORMATIONS COUREURS",
    title: "Ajouter les ravitaillements",
    image: "08-ravitaillements.png",
    intro: "Positionnez les ravitaillements dans l’ordre du parcours et décrivez précisément ce que le coureur trouvera sur place.",
    items: [
      ["1", "Saisissez un nom reconnaissable et la distance depuis le départ."],
      ["2", "Cochez eau, solide et assistance autorisée selon la réalité terrain."],
      ["3", "Ajoutez les horaires, barrières ou notes utiles dans les champs dédiés."],
      ["4", "Utilisez « Ajouter un ravito » pour créer un point ; il sera ordonné selon son kilométrage."],
    ],
    tip: "Les produits officiels et les points relais dépendent des sections activées et de l’offre choisie.",
  },
  {
    kicker: "ÉTAPE 9 · CONTRÔLER ET PUBLIER",
    title: "Régler la visibilité puis publier",
    image: "09-visibilite-publication.png",
    intro: "La visibilité se règle format par format. La publication n’est possible que lorsque les informations obligatoires sont complètes et qu’une offre active couvre les sections publiées.",
    items: [
      ["1", "Masqué : le format est retiré du public."],
      ["2", "Privé : le RaceBook reste visible uniquement pour l’équipe organisatrice en aperçu."],
      ["3", "Public : la course et son RaceBook deviennent accessibles aux coureurs après validation serveur."],
      ["4", "Cliquez sur « Publier » et vérifiez les sections incluses ou laissées en brouillon."],
    ],
    tip: "Un changement d’offre ou une section privée ne supprime pas les données déjà saisies.",
  },
];

const sectionHtml = sections.map((section, index) => `
  <section class="manual-page">
    <header><span>${esc(section.kicker)}</span><b>${index + 2}</b></header>
    <h2>${esc(section.title)}</h2>
    <p class="lead">${esc(section.intro)}</p>
    <div class="shot"><img src="${images[section.image]}" alt="Capture d’écran ${esc(section.title)}"></div>
    <div class="steps">${section.items.map(([number, text]) => `<div><i>${number}</i><p>${esc(text)}</p></div>`).join("")}</div>
    <aside><strong>Conseil</strong><span>${esc(section.tip)}</span></aside>
  </section>
`).join("");

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Mode opératoire RaceBook — Organisateur</title>
<style>
  @page { size: A4; margin: 0; } * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, Arial, sans-serif; color: #10251f; background: #edf4f1; }
  .manual-page { width: 210mm; height: 297mm; padding: 17mm 17mm 14mm; background: #fff; page-break-after: always; overflow: hidden; }
  header { display:flex; justify-content:space-between; align-items:center; color:#28725b; font-size:9pt; letter-spacing:.12em; font-weight:800; }
  header b { color:#8aa79d; font-size:9pt; }
  h1 { font-size:34pt; line-height:1.02; letter-spacing:-.04em; margin:22mm 0 5mm; max-width:155mm; }
  h2 { font-size:22pt; line-height:1.08; letter-spacing:-.025em; margin:5mm 0 3mm; }
  .lead { font-size:10.5pt; line-height:1.5; color:#526761; margin:0 0 5mm; }
  .cover { background:linear-gradient(145deg,#0d3228 0%,#174d3d 60%,#2f8064 100%); color:white; position:relative; }
  .cover:after { content:""; position:absolute; width:120mm; height:120mm; border:1px solid rgba(255,255,255,.16); border-radius:50%; right:-30mm; bottom:-30mm; box-shadow:0 0 0 18mm rgba(255,255,255,.035),0 0 0 36mm rgba(255,255,255,.025); }
  .cover header { color:#a7e5cf; }.cover header b{color:#a7e5cf}.cover .subtitle{font-size:15pt;line-height:1.45;max-width:140mm;color:#d8efe7}.cover .meta{position:absolute;left:17mm;bottom:19mm;font-size:10pt;color:#b8d8cd}.cover .pill{display:inline-block;margin-top:9mm;padding:3mm 5mm;border-radius:99px;background:#e9ff7a;color:#183a2f;font-weight:800;font-size:10pt}.cover .brand{font-weight:900;font-size:13pt;letter-spacing:-.02em}
  .toc h2 { margin-top:8mm; }.toc-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:3mm; margin-top:5mm; }.toc-item { border:1px solid #d9e5e0; border-radius:3mm; padding:3.5mm; min-height:25mm; }.toc-item b{display:block;color:#28725b;font-size:8pt;margin-bottom:1mm}.toc-item strong{display:block;font-size:9.5pt;line-height:1.15}.toc-item span{display:block;color:#6c7e78;font-size:7.4pt;margin-top:1.5mm;line-height:1.25}.checklist{margin-top:5mm;padding:4mm 5mm;border-radius:4mm;background:#edf7f3}.checklist h3{margin:0 0 2mm;font-size:11pt}.checklist p{font-size:8pt;margin:1mm 0;color:#425951}
  .shot { width:100%; height:116mm; border:1px solid #cddbd6; border-radius:3mm; overflow:hidden; background:#f3f7f5; box-shadow:0 2mm 6mm rgba(13,50,40,.08); }
  .shot img { width:100%; height:100%; object-fit:contain; object-position:top; display:block; }
  .steps { display:grid; grid-template-columns:1fr 1fr; gap:3mm 6mm; margin-top:5mm; }
  .steps div { display:grid; grid-template-columns:8mm 1fr; gap:2.5mm; align-items:start; }
  .steps i { width:7mm; height:7mm; display:grid; place-items:center; border-radius:50%; background:#e9ff7a; color:#173a2f; font-style:normal; font-size:9pt; font-weight:900; }
  .steps p { margin:.5mm 0 0; font-size:8.7pt; line-height:1.38; color:#30463f; }
  aside { margin-top:5mm; border-left:1.5mm solid #2f8064; background:#edf7f3; padding:3mm 4mm; display:flex; gap:3mm; font-size:8.7pt; line-height:1.4; }
  aside strong { color:#28725b; white-space:nowrap; }.final h2{margin-top:10mm}.final-grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:7mm}.card{padding:5mm;border:1px solid #d8e4df;border-radius:4mm}.card h3{margin:0 0 3mm;font-size:12pt}.card p,.card li{font-size:9pt;line-height:1.45;color:#445b53}.card ul{padding-left:5mm;margin:0}.state{display:grid;grid-template-columns:20mm 1fr;gap:3mm;margin:3mm 0}.state b{font-size:8.5pt;border-radius:99px;padding:1.5mm 2mm;text-align:center}.hidden{background:#e8ecea}.private{background:#fff1cf;color:#8a5a00}.public{background:#dff6e9;color:#16714e}.footer-note{margin-top:7mm;padding:6mm;background:#11392e;color:white;border-radius:4mm;font-size:10pt;line-height:1.5}.small{font-size:8pt;color:#6c7e78;margin-top:6mm}
</style></head><body>
  <section class="manual-page cover"><header><span>PACE YOURSELF · RACEBOOK</span><b>2026</b></header><h1>Mode opératoire<br>organisateur</h1><p class="subtitle">Créer, compléter et publier un RaceBook clair pour vos coureurs.</p><span class="pill">Guide de prise en main · 15 minutes</span><div class="meta"><span class="brand">Pace Yourself</span><br>Version du 11 septembre 2026 · Données de démonstration</div></section>
  <section class="manual-page toc"><header><span>AVANT DE COMMENCER</span><b>1</b></header><h2>Le parcours en 9 étapes</h2><p class="lead">Ce guide suit l’ordre recommandé pour éviter les oublis et préparer une publication sans aller-retour.</p><div class="toc-grid">
    ${sections.map((section, index) => `<div class="toc-item"><b>${String(index + 1).padStart(2, "0")}</b><strong>${esc(section.title)}</strong><span>${esc(section.intro.split(".")[0])}.</span></div>`).join("")}
  </div><div class="checklist"><h3>À préparer</h3><p>□ Nom, lieu et dates de l’édition</p><p>□ Liste des formats avec distances et dénivelés</p><p>□ GPX de chaque format</p><p>□ Horaires, ravitaillements, barrières horaires et matériel</p><p>□ Informations d’accès, retrait des dossards et contact d’urgence</p><p>□ Images PNG (5 Mo maximum pour l’image de l’événement)</p></div>
  </section>
  ${sectionHtml}
  <section class="manual-page final"><header><span>CHECKLIST FINALE</span><b>${sections.length + 2}</b></header><h2>Avant de rendre le RaceBook public</h2><p class="lead">Passez cette liste en revue pour chaque édition et chaque format.</p><div class="final-grid">
    <div class="card"><h3>Événement</h3><ul><li>Nom, lieu et dates exacts</li><li>Site officiel et réseaux</li><li>Contact d’urgence vérifié</li><li>Matériel commun à jour</li><li>Retrait dossard et accès renseignés</li></ul></div>
    <div class="card"><h3>Chaque format</h3><ul><li>Nom, distance, D+ et date</li><li>URL officielle du format</li><li>GPX et profil contrôlés</li><li>Départ, ravitos et barrières</li><li>Contenu sans contradiction avec le règlement</li></ul></div>
    <div class="card"><h3>Les 3 états</h3><div class="state"><b class="hidden">Masqué</b><p>Invisible du public.</p></div><div class="state"><b class="private">Privé</b><p>Aperçu organisateur uniquement.</p></div><div class="state"><b class="public">Public</b><p>Accessible aux coureurs après validation.</p></div></div>
    <div class="card"><h3>Bon réflexe</h3><p>Publiez d’abord un format pilote, contrôlez le rendu côté coureur, puis publiez les autres formats. En cas d’erreur urgente, repassez le format en Privé ou Masqué, corrigez, sauvegardez et republiez.</p></div>
  </div><div class="footer-note"><strong>Besoin de reprendre le tutoriel dans l’interface ?</strong><br>Ouvrez le menu <b>Actions</b>, puis choisissez <b>Revoir le guide</b>.</div><p class="small">Les captures utilisent des données fictives. Les sections disponibles dépendent de l’offre de l’édition. Les règles serveur de complétude et de publication restent prioritaires.</p></section>
</body></html>`;

const htmlPath = path.join(outputDir, "mode-operatoire-racebook-organisateur.html");
await writeFile(htmlPath, html, "utf8");
const pdfPage = await context.newPage();
await pdfPage.goto(`file:///${htmlPath.replaceAll("\\", "/")}`, { waitUntil: "load" });
await pdfPage.pdf({
  path: path.join(root, "docs", "mode-operatoire-racebook-organisateur.pdf"),
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();
console.log("Generated docs/mode-operatoire-racebook-organisateur.pdf and screenshot assets.");
