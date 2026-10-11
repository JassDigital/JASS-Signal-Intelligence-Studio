# v0.2 — Manual RSS/Atom collection

## Starter sources
- Press Information Bureau (Government of India) — official press releases.
- Global Affairs Canada — official diplomatic and foreign-affairs news.
- Government of Canada — official national news.
- Immigration, Refugees and Citizenship Canada — official immigration news.
- The Hindu — India national news.
- CBC News — Canadian top stories.
- BBC News — world news for wider context.

The set combines official announcements with news coverage; it is a starter portfolio, not a complete or viewpoint-balanced media universe. Feed URLs are configured locally and can be reviewed on the Sources screen.

## Collection behaviour
- Collection is manual only: the user clicks **Refresh feeds**.
- RSS and Atom responses are limited to 4 MB, with a 15-second request timeout, up to three validated public redirects, and at most 100 items processed per source refresh.
- Feed items are deduplicated by the feed-provided ID/GUID or a stable fallback hash per source.
- Original article links, publication timestamps where supplied, source identity and fetch status are retained.
- Repeated items update their last-fetched marker instead of creating a duplicate event.
- A source failure is recorded on that source and in collection history; other feeds continue processing.
- Items are initially assigned Low severity; the app does not infer the importance or truth of a report.
- Bilateral tagging is a simple keyword heuristic when both India and Canada appear. Verify tags and claims against the original source.
- The app does not fetch full article pages and does not use AI for this collection step.

## Limitations
This initial selection remains small and cannot represent all viewpoints or all news. v0.2 is a foundation for a broader, balanced source portfolio, not a comprehensive global-intelligence service.
