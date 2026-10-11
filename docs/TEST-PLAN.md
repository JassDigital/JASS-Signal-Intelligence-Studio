# Test plan

## Automated
- Database creates required tables and schema marker.
- Demonstration records are present and explicitly labelled.
- Records survive closing and reopening SQLite.
- Topic uniqueness is enforced.
- Run `npm test` and retain the terminal output in the release notes.

## Manual Windows smoke test
1. Run `npm run dev`.
2. Open all six sidebar pages.
3. Add, edit, search and delete an event.
4. Add, edit and delete a source definition.
5. Add, edit and delete a watchlist topic.
6. Change AI provider settings and restart the app.
7. Confirm all records/settings persist.
8. Run `npm run build`.
9. Run `npm run dist:win`, install on a clean Windows test profile and launch.
10. Confirm no demo data is described as live and no network collection is implied.
