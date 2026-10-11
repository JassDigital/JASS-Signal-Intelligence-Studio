const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const { createDatabase } = require('./store.cjs');

// Compatibility test for machines where Chromium graphics services fail.
app.disableHardwareAcceleration();

let db;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#0b1020',
    title: 'JASS Signal Intelligence Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('[renderer] Failed to load:', code, description, url);
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer] Process exited:', details);
  });

  win.webContents.on('did-finish-load', () => {
    console.log('[renderer] Page loaded successfully.');
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  console.log('[startup] Loading:', devUrl || 'local production build');

  if (devUrl) {
    win.loadURL(devUrl).catch(err => console.error('[startup] loadURL failed:', err));
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
      .catch(err => console.error('[startup] loadFile failed:', err));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  return win;
}

app.whenReady().then(() => {
  try {
    console.log('[startup] Electron ready; opening SQLite database.');
    db = createDatabase(path.join(app.getPath('userData'), 'jass-signal.sqlite'));
    console.log('[startup] SQLite opened successfully.');

    registerHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (err) {
    console.error('[startup] Fatal error:', err);
    dialog.showErrorBox(
      'JASS Signal Intelligence Studio could not start',
      String(err?.stack || err)
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (db) db.close();
});

function registerHandlers() {
  const safe = (fn) => (_event, payload) => fn(payload);

  ipcMain.handle('dashboard:get', () => ({
    events: db.prepare('SELECT COUNT(*) AS n FROM events').get().n,
    sources: db.prepare('SELECT COUNT(*) AS n FROM sources WHERE enabled = 1').get().n,
    topics: db.prepare('SELECT COUNT(*) AS n FROM topics').get().n,
    recent: db.prepare("SELECT COUNT(*) AS n FROM events WHERE created_at >= datetime('now', '-24 hours')").get().n
  }));

  ipcMain.handle('events:list', safe((p = {}) => {
    const where = [];
    const args = {};
    if (p.query) {
      where.push('(e.title LIKE @q OR e.summary LIKE @q OR e.source_name LIKE @q)');
      args.q = `%${String(p.query).slice(0, 200)}%`;
    }
    if (p.severity && p.severity !== 'All') {
      where.push('e.severity = @severity');
      args.severity = p.severity;
    }
    if (p.topicId) {
      where.push('EXISTS (SELECT 1 FROM event_topics et WHERE et.event_id=e.id AND et.topic_id=@topicId)');
      args.topicId = Number(p.topicId);
    }
    const sql = `SELECT e.* FROM events e ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(e.published_at,e.created_at) DESC LIMIT 500`;
    return db.prepare(sql).all(args);
  }));

  ipcMain.handle('events:save', safe((p) => {
    if (!p || !String(p.title || '').trim()) throw new Error('Event title is required.');
    const d = {
      title: String(p.title).trim().slice(0, 300),
      summary: String(p.summary || '').slice(0, 5000),
      source_name: String(p.source_name || 'Manual entry').slice(0, 200),
      source_url: validUrl(p.source_url),
      severity: ['Low', 'Moderate', 'High', 'Critical'].includes(p.severity) ? p.severity : 'Moderate',
      region: String(p.region || 'Global').slice(0, 100),
      status: String(p.status || 'New').slice(0, 40),
      published_at: p.published_at || null
    };
    if (p.id) {
      db.prepare('UPDATE events SET title=@title,summary=@summary,source_name=@source_name,source_url=@source_url,severity=@severity,region=@region,status=@status,published_at=@published_at,updated_at=CURRENT_TIMESTAMP WHERE id=@id')
        .run({ ...d, id: Number(p.id) });
      return Number(p.id);
    }
    return Number(db.prepare('INSERT INTO events(title,summary,source_name,source_url,severity,region,status,published_at) VALUES(@title,@summary,@source_name,@source_url,@severity,@region,@status,@published_at)').run(d).lastInsertRowid);
  }));

  ipcMain.handle('events:delete', safe((p) => db.prepare('DELETE FROM events WHERE id=?').run(Number(p.id)).changes > 0));

  ipcMain.handle('sources:list', () => db.prepare('SELECT * FROM sources ORDER BY name COLLATE NOCASE').all());
  ipcMain.handle('sources:save', safe((p) => {
    if (!p || !String(p.name || '').trim()) throw new Error('Source name is required.');
    const url = validUrl(p.url);
    const type = ['RSS', 'API', 'Manual'].includes(p.type) ? p.type : 'Manual';
    if (p.id) {
      db.prepare('UPDATE sources SET name=?,url=?,type=?,enabled=?,notes=? WHERE id=?')
        .run(String(p.name).trim().slice(0, 200), url, type, p.enabled ? 1 : 0, String(p.notes || '').slice(0, 2000), Number(p.id));
      return Number(p.id);
    }
    return Number(db.prepare('INSERT INTO sources(name,url,type,enabled,notes) VALUES(?,?,?,?,?)')
      .run(String(p.name).trim().slice(0, 200), url, type, p.enabled === false ? 0 : 1, String(p.notes || '').slice(0, 2000)).lastInsertRowid);
  }));
  ipcMain.handle('sources:delete', safe((p) => db.prepare('DELETE FROM sources WHERE id=?').run(Number(p.id)).changes > 0));

  ipcMain.handle('topics:list', () => db.prepare('SELECT t.*, (SELECT COUNT(*) FROM event_topics et WHERE et.topic_id=t.id) AS event_count FROM topics t ORDER BY t.name COLLATE NOCASE').all());
  ipcMain.handle('topics:save', safe((p) => {
    if (!p || !String(p.name || '').trim()) throw new Error('Topic name is required.');
    if (p.id) {
      db.prepare('UPDATE topics SET name=?,description=?,enabled=? WHERE id=?')
        .run(String(p.name).trim().slice(0, 200), String(p.description || '').slice(0, 1000), p.enabled === false ? 0 : 1, Number(p.id));
      return Number(p.id);
    }
    return Number(db.prepare('INSERT INTO topics(name,description,enabled) VALUES(?,?,?)')
      .run(String(p.name).trim().slice(0, 200), String(p.description || '').slice(0, 1000), 1).lastInsertRowid);
  }));
  ipcMain.handle('topics:delete', safe((p) => db.prepare('DELETE FROM topics WHERE id=?').run(Number(p.id)).changes > 0));

  ipcMain.handle('settings:get', () => Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x => [x.key, x.value])));
  ipcMain.handle('settings:save', safe((p) => {
    const allowed = ['theme', 'aiProvider', 'aiEndpoint', 'aiModel', 'refreshMinutes'];
    const stmt = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    for (const key of allowed) if (p && p[key] !== undefined) stmt.run(key, String(p[key]).slice(0, 500));
    return Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(x => [x.key, x.value]));
  }));

  ipcMain.handle('timeline:list', () => db.prepare("SELECT id,title,source_name,severity,region,COALESCE(published_at,created_at) AS event_time,status FROM events ORDER BY event_time DESC LIMIT 200").all());
  ipcMain.handle('app:version', () => app.getVersion());
}

function validUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(String(value));
    return ['http:', 'https:'].includes(u.protocol) ? u.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
}
