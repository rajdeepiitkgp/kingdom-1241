/**
 * Local development only: creates (or re-passwords) an e-mail account so the
 * admin area can be used before the Discord application exists. Reads
 * DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD from .env.local; enable the form with
 * ADMIN_DEV_LOGIN=1 and make the account the owner with SITE_OWNER=<that e-mail>.
 *
 *   npm run dev:admin
 */
import { loadEnv } from "./env";

loadEnv();

async function main() {
  const [{ createAdminClient }, { normalizeEmail }, { isOwnerIdentity }] = await Promise.all([
    import("@/lib/supabase/admin"),
    import("@/lib/auth/identity"),
    import("@/lib/auth/owner"),
  ]);
  const email = normalizeEmail(process.env.DEV_ADMIN_EMAIL) ?? "dev-admin@kingdom1241.local";
  const password = process.env.DEV_ADMIN_PASSWORD ?? "";
  if (password.length < 12) throw new Error("Set DEV_ADMIN_PASSWORD (12+ characters) in .env.local first.");

  const supabase = createAdminClient();
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Dev admin" },
  });
  if (created.error) {
    if (!/already|exists|registered/i.test(created.error.message)) throw created.error;
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const existing = data.users.find((u) => u.email?.toLowerCase() === email);
    if (!existing) throw new Error(`Could not find the existing account for ${email}`);
    const updated = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (updated.error) throw updated.error;
    console.log(`Account exists, password updated: ${email}`);
  } else {
    console.log(`Account created: ${email}`);
  }

  if (isOwnerIdentity({ discordUsername: null, email })) {
    console.log("SITE_OWNER matches this account: it is the owner (administrator).");
  } else {
    console.log(`Add SITE_OWNER=${email} to .env.local so this account is the owner, or sign in and have the owner grant a role.`);
  }
  console.log("Sign in at http://localhost:3000/en/admin/login (needs ADMIN_DEV_LOGIN=1).");
}

main().catch((error) => {
  console.error("dev-admin failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
