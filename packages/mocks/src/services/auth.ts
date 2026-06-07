import { currentUser } from "../fixtures/current-user";

export function getMockCurrentUser() {
  return currentUser;
}

export function loginWithMockCode(code?: string) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    sessionToken: `mock-session-${code || "default"}`,
    expiresAt,
    user: currentUser
  };
}
