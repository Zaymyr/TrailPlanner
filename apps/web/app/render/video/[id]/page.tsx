import { noIndexMetadata } from "../../../noindex-metadata";
import { RenderVideoClient } from "./RenderVideoClient";

export const metadata = noIndexMetadata;

/** Opened by the Cloud Run renderer only; the job token travels in the URL fragment. */
export default function RenderVideoPage({ params }: { params: { id: string } }) {
  return <RenderVideoClient jobId={params.id} />;
}
