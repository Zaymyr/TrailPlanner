const ORGANIZER_IMPORT_BUCKET = "organizer-imports";
const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

export const WEBSITE_IMPORT_MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const WEBSITE_IMPORT_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type OrganizerImportDocumentReference = {
  path: string;
  fileName: string;
  mediaType: (typeof WEBSITE_IMPORT_DOCUMENT_MIME_TYPES)[number];
  sizeBytes: number;
};

export type OrganizerImportUploadProgress = {
  fileName: string;
  fileIndex: number;
  fileCount: number;
  bytesUploaded: number;
  bytesTotal: number;
  percentage: number;
};

export const isOrganizerImportDocumentMimeType = (
  value: string
): value is OrganizerImportDocumentReference["mediaType"] =>
  WEBSITE_IMPORT_DOCUMENT_MIME_TYPES.some((mediaType) => mediaType === value);

export const getOrganizerImportTusEndpoint = (supabaseUrl: string) => {
  const url = new URL(supabaseUrl);
  if (url.hostname.endsWith(".supabase.co") && !url.hostname.endsWith(".storage.supabase.co")) {
    url.hostname = url.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  }
  url.pathname = "/storage/v1/upload/resumable";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
};

const getDocumentExtension = (document: File) => {
  const extension = document.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (extension) return extension;
  return document.type === "application/pdf" ? "pdf" : document.type.split("/")[1] ?? "bin";
};

const createAbortError = () => new DOMException("Upload annulé.", "AbortError");

export const removeTemporaryOrganizerImportDocuments = async (
  documents: OrganizerImportDocumentReference[],
  accessToken: string
) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return;

  await Promise.all(
    documents.map((document) =>
      fetch(`${supabaseUrl}/storage/v1/object/${ORGANIZER_IMPORT_BUCKET}/${document.path}`, {
        method: "DELETE",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => null)
    )
  );
};

const uploadDocument = async ({
  document,
  path,
  endpoint,
  accessToken,
  anonKey,
  signal,
  onProgress,
}: {
  document: File;
  path: string;
  endpoint: string;
  accessToken: string;
  anonKey: string;
  signal?: AbortSignal;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
}) => {
  const { Upload } = await import("tus-js-client");
  if (signal?.aborted) throw createAbortError();

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", handleAbort);
      callback();
    };
    const upload = new Upload(document, {
      endpoint,
      retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
      chunkSize: TUS_CHUNK_SIZE_BYTES,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${accessToken}`,
      },
      metadata: {
        bucketName: ORGANIZER_IMPORT_BUCKET,
        objectName: path,
        contentType: document.type,
        cacheControl: "3600",
      },
      onProgress,
      onSuccess: () => finish(resolve),
      onError: (error) => finish(() => reject(signal?.aborted ? createAbortError() : error)),
    });
    const handleAbort = () => {
      void upload.abort(true).finally(() => finish(() => reject(createAbortError())));
    };

    signal?.addEventListener("abort", handleAbort, { once: true });
    void upload.findPreviousUploads()
      .then((previousUploads) => {
        if (signal?.aborted) {
          handleAbort();
          return;
        }
        if (previousUploads[0]) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      })
      .catch((error: unknown) => finish(() => reject(error)));
  });
};

export const uploadTemporaryOrganizerImportDocuments = async ({
  documents,
  userId,
  accessToken,
  signal,
  onProgress,
}: {
  documents: File[];
  userId: string;
  accessToken: string;
  signal?: AbortSignal;
  onProgress?: (progress: OrganizerImportUploadProgress) => void;
}): Promise<OrganizerImportDocumentReference[]> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Configuration Supabase manquante.");

  const endpoint = getOrganizerImportTusEndpoint(supabaseUrl);
  const totalBytes = documents.reduce((total, document) => total + document.size, 0);
  let completedBytes = 0;
  const uploaded: OrganizerImportDocumentReference[] = [];

  try {
    for (const [fileIndex, document] of documents.entries()) {
      if (!isOrganizerImportDocumentMimeType(document.type)) {
        throw new Error(`Le format du document ${document.name} n’est pas pris en charge.`);
      }
      if (signal?.aborted) throw createAbortError();

      const path = `${userId}/${crypto.randomUUID()}.${getDocumentExtension(document)}`;
      await uploadDocument({
        document,
        path,
        endpoint,
        accessToken,
        anonKey: supabaseAnonKey,
        signal,
        onProgress: (bytesUploaded) => {
          const aggregateBytes = completedBytes + bytesUploaded;
          onProgress?.({
            fileName: document.name,
            fileIndex,
            fileCount: documents.length,
            bytesUploaded: aggregateBytes,
            bytesTotal: totalBytes,
            percentage: totalBytes === 0 ? 100 : Math.round((aggregateBytes / totalBytes) * 100),
          });
        },
      });
      completedBytes += document.size;
      uploaded.push({ path, fileName: document.name, mediaType: document.type, sizeBytes: document.size });
    }
    return uploaded;
  } catch (error) {
    await removeTemporaryOrganizerImportDocuments(uploaded, accessToken);
    throw error;
  }
};
