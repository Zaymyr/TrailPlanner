import { noIndexMetadata } from "../../../noindex-metadata";
import { RenderCarouselClient } from "./RenderCarouselClient";

export const metadata = noIndexMetadata;

/** Opened by the Cloud Run renderer only; the carousel job token travels in the URL fragment. */
export default function RenderCarouselPage({ params }: { params: { id: string } }) {
  return <RenderCarouselClient jobId={params.id} />;
}
