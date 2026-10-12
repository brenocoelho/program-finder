# Known issues

Corners cut on purpose. One line each: what, and why.

- **Migrations have no checksum.** `schema_migrations` stores only the filename and the time, so an edited old migration is not detected by the runner (the spec's schema, kept simple). The rule "never edit a migration that already ran" is by hand and in review.
