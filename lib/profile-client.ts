import { profileResponseSchema, profileUpdateSchema, type ProfileUpdatePayload, type UserProfile } from "./profile-types";

const parseProfileResponse = async (response: Response): Promise<UserProfile> => {
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to load profile";
    throw new Error(message);
  }

  const parsed = profileResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Invalid profile response");
  }

  return parsed.data.profile;
};

export const fetchUserProfile = async (accessToken: string, signal?: AbortSignal): Promise<UserProfile> => {
  const response = await fetch("/api/profile", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal,
  });

  return parseProfileResponse(response);
};

export const updateUserProfile = async (
  accessToken: string,
  payload: ProfileUpdatePayload,
  signal?: AbortSignal
): Promise<UserProfile> => {
  const parsedPayload = profileUpdateSchema.partial().safeParse(payload);

  if (!parsedPayload.success) {
    throw new Error("Invalid profile payload");
  }

  const response = await fetch("/api/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(parsedPayload.data),
    signal,
  });

  return parseProfileResponse(response);
};
