// Read-only guard for progress sync.
//
// When enabled, EVERY write to user_progress / user_devices is suppressed. The
// client still READS remote progress (so the legacy→content.id backward-compat
// display path can be verified), but never mutates the shared database.
//
// Purpose: a preview deployment points at the SAME Supabase instance as
// production. Without this guard, any logged-in tester who opens the preview URL
// would trigger the automatic legacy→content.id migration upload against real
// user_progress rows — effectively going live before the migration is promoted
// (and before the #16 rollback tool exists). Read-only mode keeps preview purely
// observational.
//
// Default (unset) → writes ENABLED, so production behaviour is unchanged.
// Set NEXT_PUBLIC_PROGRESS_READONLY=enabled in the Vercel *Preview* env scope.
export function isProgressWriteFrozen(): boolean {
  return process.env.NEXT_PUBLIC_PROGRESS_READONLY === "enabled";
}
