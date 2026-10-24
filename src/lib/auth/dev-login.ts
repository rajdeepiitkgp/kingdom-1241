/**
 * Local development only: an e-mail + password form on the admin login page,
 * so the admin area can be built and tested before the Discord application
 * exists. Never enabled in production builds, whatever the environment says.
 * Create the account with `npm run dev:admin`.
 */
export function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ADMIN_DEV_LOGIN === "1";
}
