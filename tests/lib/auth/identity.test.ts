import { describe, expect, it } from "vitest";
import { identityFromUser, normalizeEmail, normalizeHandle } from "@/lib/auth/identity";

describe("normalizeHandle", () => {
  it("lower-cases and strips @ and discriminators", () => {
    expect(normalizeHandle("@Rudy")).toBe("rudy");
    expect(normalizeHandle("Rudy#0")).toBe("rudy");
    expect(normalizeHandle("rudy#1234 ")).toBe("rudy");
    expect(normalizeHandle("")).toBeNull();
    expect(normalizeHandle(null)).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("requires an @ and lower-cases", () => {
    expect(normalizeEmail(" Dev@Example.com ")).toBe("dev@example.com");
    expect(normalizeEmail("nope")).toBeNull();
  });
});

describe("identityFromUser", () => {
  it("reads a Discord sign-in", () => {
    const identity = identityFromUser({
      id: "u1",
      email: "rudy@example.com",
      app_metadata: { provider: "discord", providers: ["discord"] },
      user_metadata: {
        avatar_url: "https://cdn.discordapp.com/avatars/1/abc.png",
        custom_claims: { global_name: "Rudy" },
        email: "rudy@example.com",
        full_name: "Rudy",
        name: "rudy_1241",
        provider_id: "123456789",
        sub: "123456789",
      },
      identities: [
        {
          id: "123456789",
          identity_id: "i1",
          user_id: "u1",
          provider: "discord",
          identity_data: { name: "rudy_1241" },
          created_at: "",
          last_sign_in_at: "",
          updated_at: "",
        },
      ],
    });
    expect(identity).toEqual({
      provider: "discord",
      displayName: "Rudy",
      discordId: "123456789",
      discordUsername: "rudy_1241",
      email: "rudy@example.com",
      avatarUrl: "https://cdn.discordapp.com/avatars/1/abc.png",
    });
  });

  it("reads an e-mail sign-in and derives a name", () => {
    const identity = identityFromUser({
      id: "u2",
      email: "Dev-Admin@kingdom1241.local",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
    });
    expect(identity.provider).toBe("email");
    expect(identity.displayName).toBe("dev-admin");
    expect(identity.discordId).toBeNull();
    expect(identity.discordUsername).toBeNull();
    expect(identity.email).toBe("dev-admin@kingdom1241.local");
  });
});
