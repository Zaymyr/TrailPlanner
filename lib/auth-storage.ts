export const ACCESS_TOKEN_KEY = "trailplanner.accessToken";
export const REFRESH_TOKEN_KEY = "trailplanner.refreshToken";
export const SESSION_EMAIL_KEY = "trailplanner.sessionEmail";

type StoredSession = {
  accessToken: string;
  refreshToken?: string;
  email?: string;
};

export const persistSessionToStorage = ({ accessToken, refreshToken, email }: StoredSession) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  if (email) {
    window.localStorage.setItem(SESSION_EMAIL_KEY, email);
  } else {
    window.localStorage.removeItem(SESSION_EMAIL_KEY);
  }
};

export const clearStoredSession = () => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(SESSION_EMAIL_KEY);
};

export const readStoredSession = (): StoredSession | null => {
  if (typeof window === "undefined") return null;

  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) return null;

  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY) ?? undefined;
  const email = window.localStorage.getItem(SESSION_EMAIL_KEY) ?? undefined;

  return { accessToken, refreshToken, email };
};
