# Known Issues / Limitations (MVP)

- **HealthKit & Google Calendar are mocked by default.** Real device sync requires an Expo
  Dev Client build + Apple/Google credentials (see docs/MOBILE_BUILD.md). The full app flow
  works end-to-end in mock mode with no credentials.
- **AI providers are mock by default** (`AI_PROVIDER=mock`). Real Vision/Nutrition/Coaching/
  Transcription adapters are stubbed and guarded behind env vars; wiring a real key is a small
  change isolated to `app/ai/providers/`.
- **SQLite for local demo.** Row Level Security is expressed in `supabase/rls.sql` and applied
  only when running against Supabase/Postgres. On SQLite, isolation is enforced in the API layer
  by `user_id` scoping.
- **Alembic** is scaffolded; local demo uses `create_all()` for zero-friction startup. The first
  migration is generated from the models.
- **Mobile cannot be launched in this CI container** (no iOS simulator). It typechecks and runs
  Jest component tests here; run instructions for a Mac/simulator are in docs/MOBILE_BUILD.md.
- Nutrition/vision estimates are **approximations**, always shown as editable with confidence.
- Not HIPAA compliant. Architecture is HIPAA-*conscious* (audit logs, least privilege, encrypted
  transport expectation, sensitive-field isolation) but controls are not fully verified.
