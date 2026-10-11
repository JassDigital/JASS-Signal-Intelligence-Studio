const Database = require('better-sqlite3');
function createDatabase(filename) {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sources(id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT, type TEXT NOT NULL DEFAULT 'Manual', enabled INTEGER NOT NULL DEFAULT 1, notes TEXT NOT NULL DEFAULT '', last_checked_at TEXT, last_status TEXT NOT NULL DEFAULT 'Not checked', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS topics(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, description TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', source_name TEXT NOT NULL DEFAULT 'Manual entry', source_url TEXT, severity TEXT NOT NULL DEFAULT 'Moderate', region TEXT NOT NULL DEFAULT 'Global', status TEXT NOT NULL DEFAULT 'New', published_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS event_topics(event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE, topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE, PRIMARY KEY(event_id,topic_id));
    CREATE TABLE IF NOT EXISTS collection_runs(id INTEGER PRIMARY KEY, source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TEXT, status TEXT NOT NULL, items_found INTEGER NOT NULL DEFAULT 0, message TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS saved_items(id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE, note TEXT NOT NULL DEFAULT '', saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_events_published ON events(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
    CREATE INDEX IF NOT EXISTS idx_events_region ON events(region);
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version) VALUES (1)').run();
  const count = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
  if (count === 0) {
    const seed = db.transaction(() => {
      const topic = db.prepare('INSERT OR IGNORE INTO topics(name,description) VALUES(?,?)');
      ['Geopolitics','Energy','Technology','Economy'].forEach(t => topic.run(t, 'Demonstration watchlist topic'));
      const source = db.prepare('INSERT INTO sources(name,url,type,enabled,notes) VALUES(?,?,?,?,?)');
      source.run('Manual observation',null,'Manual',1,'Built-in source for manually entered events');
      const insert = db.prepare('INSERT INTO events(title,summary,source_name,source_url,severity,region,status,published_at) VALUES(?,?,?,?,?,?,?,?)');
      const samples = [
        ['Global shipping lanes remain a monitoring priority','Demonstration record illustrating a global logistics topic. Replace with verified reporting when live sources are configured.','Demo dataset',null,'Moderate','Global','Demo',new Date(Date.now()-3600000).toISOString()],
        ['Energy market developments warrant source verification','Demonstration record for energy-related monitoring; this is not a live market alert.','Demo dataset',null,'Low','Global','Demo',new Date(Date.now()-7200000).toISOString()],
        ['Technology policy continues to shape international competition','Demonstration record for policy and technology tracking. Verify all claims against original sources.','Demo dataset',null,'High','Asia-Pacific','Demo',new Date(Date.now()-86400000).toISOString()]
      ];
      for (const row of samples) insert.run(...row);
    });
    seed();
  }
  // v2: introduce India and Canada as priority monitoring areas without replacing existing user data.
  const focusMigrationApplied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 2').get();
  if (!focusMigrationApplied) {
    const applyFocusMigration = db.transaction(() => {
      const topic = db.prepare('INSERT OR IGNORE INTO topics(name,description) VALUES(?,?)');
      [
        ['India', 'Priority region: government policy, economy, infrastructure, climate, technology and regional developments.'],
        ['Canada', 'Priority region: economy, energy, Arctic affairs, public policy, technology and climate.'],
        ['India–Canada Relations', 'Bilateral diplomacy, trade, education, mobility, technology and people-to-people links.'],
        ['Trade & Investment', 'Trade policy, investment, supply chains and economic cooperation.'],
        ['Energy & Critical Minerals', 'Energy security, electricity, oil and gas, critical minerals and transition technologies.'],
        ['Technology & AI', 'Technology policy, research, digital infrastructure and artificial intelligence.']
      ].forEach(row => topic.run(...row));

      const addDemo = db.prepare(`
        INSERT INTO events(title,summary,source_name,source_url,severity,region,status,published_at)
        SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (
          SELECT 1 FROM events WHERE title = ? AND status = 'Demo'
        )
      `);
      const now = Date.now();
      const examples = [
        ['India monitoring focus: economy, infrastructure and policy', 'Demonstration placeholder for India-focused monitoring categories. This is not a report of a specific current event; verify all developments against original sources when live feeds are added.', 'Demo dataset', null, 'Moderate', 'India', 'Demo', new Date(now - 20 * 60 * 1000).toISOString()],
        ['Canada monitoring focus: energy, Arctic affairs and economy', 'Demonstration placeholder for Canada-focused monitoring categories. This is not a report of a specific current event; verify all developments against original sources when live feeds are added.', 'Demo dataset', null, 'Moderate', 'Canada', 'Demo', new Date(now - 40 * 60 * 1000).toISOString()],
        ['India–Canada monitoring focus: trade, technology and bilateral relations', 'Demonstration placeholder for bilateral monitoring. It makes no claim about current diplomatic conditions or a specific event; verify developments against original sources.', 'Demo dataset', null, 'Low', 'India–Canada', 'Demo', new Date(now - 60 * 60 * 1000).toISOString()]
      ];
      for (const row of examples) addDemo.run(...row, row[0]);
      db.prepare('INSERT OR IGNORE INTO schema_migrations(version) VALUES (2)').run();
    });
    applyFocusMigration();
  }
  // v3: local RSS collection metadata, source regions, and starter feeds.
  const migrationV3Done = db.prepare('SELECT 1 FROM schema_migrations WHERE version = 3').get();
  if (!migrationV3Done) {
    const sourceColumns = db.prepare('PRAGMA table_info(sources)').all().map(c => c.name);
    if (!sourceColumns.includes('region')) {
      db.exec("ALTER TABLE sources ADD COLUMN region TEXT NOT NULL DEFAULT 'Global'");
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS feed_items (
        id INTEGER PRIMARY KEY,
        source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
        guid TEXT NOT NULL,
        event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
        canonical_url TEXT,
        published_at TEXT,
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_id, guid)
      );
      CREATE INDEX IF NOT EXISTS idx_feed_items_event ON feed_items(event_id);
      CREATE INDEX IF NOT EXISTS idx_sources_enabled_type ON sources(enabled,type);
    `);

    const seedSource = db.prepare(`
      INSERT INTO sources(name,url,type,enabled,notes,region)
      SELECT ?, ?, 'RSS', 1, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM sources WHERE url = ?)
    `);
    const starterFeeds = [
      ['Press Information Bureau — India', 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1',
       'Official Government of India press releases. Public feed; manually refreshed.', 'India'],
      ['Global Affairs Canada — All News', 'https://api.io.canada.ca/io-server/gc/news/en/v2?atomtitle=Global+Affairs+Canada+news&dept=departmentofforeignaffairstradeanddevelopment&format=atom&orderBy=desc&pick=100&publishedDate%3E=2025-01-01&sort=publishedDate',
       'Official Global Affairs Canada Atom feed. Public feed; manually refreshed.', 'Canada'],
      ['Government of Canada — National News', 'https://api.io.canada.ca/io-server/gc/news/en/v2?atomtitle=National+News&format=atom&orderBy=desc&pick=100&publishedDate%3E=2021-10-25&sort=publishedDate',
       'Official Government of Canada national news Atom feed. Public feed; manually refreshed.', 'Canada'],
      ['Immigration, Refugees and Citizenship Canada — News', 'https://api.io.canada.ca/io-server/gc/news/en/v2?dept=departmentofcitizenshipandimmigration&sort=publishedDate&orderBy=desc&publishedDate%3E=2021-07-23&pick=50&format=atom&atomtitle=Immigration%2C%20Refugees%20and%20Citizenship%20Canada',
       'Official IRCC news Atom feed. Public feed; manually refreshed.', 'Canada'],
      ['The Hindu — India National News', 'https://www.thehindu.com/news/national/feeder/default.rss',
       'Indian newspaper national news feed. Headlines retain links to original articles.', 'India'],
      ['CBC News — Top Stories', 'https://www.cbc.ca/webfeed/rss/rss-topstories',
       'Canadian public broadcaster news feed. Headlines retain links to original articles.', 'Canada'],
      ['BBC News — World', 'https://feeds.bbci.co.uk/news/world/rss.xml',
       'International world-news feed for wider context.', 'Global']
    ];
    for (const feed of starterFeeds) seedSource.run(feed[0], feed[1], feed[2], feed[3], feed[1]);

    db.prepare('INSERT OR IGNORE INTO schema_migrations(version) VALUES (3)').run();
  }
  return db;
}
module.exports = { createDatabase };

