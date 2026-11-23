import { redirect } from "next/navigation";

/** Former studio URL: the studio is now `/admin/content/studio` (same client, `VideoGeneratorStudio`). */
export default function LegacyVideoGeneratorPage() {
  redirect("/admin/content/studio");
}
