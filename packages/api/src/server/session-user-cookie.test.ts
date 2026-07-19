import { describe, expect, it } from "vitest";
import {
  createSessionUserCookie,
  getSessionCookieSecret,
  readSessionUserCookie,
} from "./session-user-cookie";

const user = {
  id: "42",
  name: "OAuth 用户",
  avatarUrl: "https://example.feishu.cn/avatar.png",
};
const expiresAt = "2099-01-01T00:00:00.000Z";
const sessionSecret = "test-session-cookie-secret-at-least-32-chars";

describe("session user cookie", () => {
  it("round-trips the OAuth user when bound to the same session token", async () => {
    const cookie = await createSessionUserCookie(
      user,
      "session-token",
      expiresAt,
      sessionSecret,
    );
    await expect(
      readSessionUserCookie(cookie, "session-token", sessionSecret),
    ).resolves.toEqual(user);
  });

  it("rejects a cookie copied to another session", async () => {
    const cookie = await createSessionUserCookie(
      user,
      "session-token",
      expiresAt,
      sessionSecret,
    );
    await expect(
      readSessionUserCookie(cookie, "other-session-token", sessionSecret),
    ).resolves.toBeNull();
  });

  it("rejects a modified payload", async () => {
    const cookie = await createSessionUserCookie(
      user,
      "session-token",
      expiresAt,
      sessionSecret,
    );
    const [payload, signature] = cookie.split(".");
    const modified = `${payload?.replace(/.$/, "A")}.${signature}`;
    await expect(
      readSessionUserCookie(modified, "session-token", sessionSecret),
    ).resolves.toBeNull();
  });

  it.each(["", "invalid", "payload.signature.extra"])(
    "rejects malformed cookie %s",
    async (cookie) => {
      await expect(
        readSessionUserCookie(cookie, "session-token", sessionSecret),
      ).resolves.toBeNull();
    },
  );

  it("rejects malformed OAuth user data", async () => {
    await expect(
      createSessionUserCookie(
        { ...user, id: "" },
        "session-token",
        expiresAt,
        sessionSecret,
      ),
    ).rejects.toThrow("OAuth user");
  });

  it("rejects an expired OAuth user session", async () => {
    const cookie = await createSessionUserCookie(
      user,
      "session-token",
      expiresAt,
      sessionSecret,
    );
    await expect(
      readSessionUserCookie(
        cookie,
        "session-token",
        sessionSecret,
        Date.parse("2100-01-01T00:00:00.000Z"),
      ),
    ).resolves.toBeNull();
  });

  it("rejects a cookie signed with an attacker-selected secret", async () => {
    const attackerSecret = "attacker-selected-secret-at-least-32-chars";
    const cookie = await createSessionUserCookie(
      user,
      "attacker-token",
      expiresAt,
      attackerSecret,
    );
    await expect(
      readSessionUserCookie(cookie, "attacker-token", sessionSecret),
    ).resolves.toBeNull();
  });

  it("requires a sufficiently long server-only secret", () => {
    expect(() => getSessionCookieSecret("short")).toThrow(
      "SESSION_COOKIE_SECRET",
    );
  });
});
