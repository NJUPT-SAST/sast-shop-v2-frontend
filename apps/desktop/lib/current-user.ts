import {
  AuthRequiredError,
  getCurrentUser,
  type CurrentUser,
  type ServiceOptions,
} from "@sast-shop/api";

export async function loadCurrentUser(
  options: ServiceOptions,
  authRequired: boolean,
): Promise<CurrentUser> {
  if (!authRequired) return getCurrentUser(options);
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) throw new Error("个人资料暂不可用，请稍后再试");
  const session: unknown = await response.json();
  if (
    !session ||
    typeof session !== "object" ||
    !("authenticated" in session) ||
    session.authenticated !== true ||
    !("user" in session)
  ) {
    window.dispatchEvent(new Event(AuthRequiredError.browserEventName));
    throw new AuthRequiredError();
  }
  const user = session.user;
  if (
    !user ||
    typeof user !== "object" ||
    !("id" in user) ||
    typeof user.id !== "string" ||
    !user.id ||
    !("name" in user) ||
    typeof user.name !== "string" ||
    !("avatarUrl" in user) ||
    typeof user.avatarUrl !== "string"
  ) {
    window.dispatchEvent(new Event(AuthRequiredError.browserEventName));
    throw new AuthRequiredError();
  }
  return { id: user.id, name: user.name, avatarUrl: user.avatarUrl };
}
