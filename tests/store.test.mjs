import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createDatabase } = require('../electron/store.cjs');

let temp;
let db;

afterEach(() => {
  if (db) {
    db.close();
    db = null;
  }
  if (temp) {
    fs.rmSync(temp, { recursive: true, force: true });
    temp = null;
  }
});

describe('local database foundation', () => {
  it('creates schema and seeds demonstration records', () => {
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jass-signal-'));
    db = createDatabase(path.join(temp, 'test.sqlite'));

    expect(db.prepare('SELECT COUNT(*) n FROM events').get().n).toBeGreaterThan(0);
    expect(db.prepare("SELECT COUNT(*) n FROM events WHERE status='Demo'").get().n).toBeGreaterThan(0);
    expect(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n).toBe(3);
    expect(db.prepare("SELECT COUNT(*) n FROM sources WHERE type='RSS'").get().n).toBe(7);
  });

  it('preserves records after closing and reopening SQLite', () => {
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jass-signal-'));
    const file = path.join(temp, 'test.sqlite');
    db = createDatabase(file);

    db.prepare("INSERT INTO events(title,summary) VALUES(?,?)")
      .run('Persistence test', 'test record');

    db.close();
    db = null;
    db = createDatabase(file);

    expect(
      db.prepare("SELECT COUNT(*) n FROM events WHERE title='Persistence test'").get().n
    ).toBe(1);
  });

  it('enforces unique watchlist topics', () => {
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jass-signal-'));
    db = createDatabase(path.join(temp, 'test.sqlite'));

    db.prepare('INSERT INTO topics(name) VALUES(?)').run('Unique topic');

    expect(() => {
      db.prepare('INSERT INTO topics(name) VALUES(?)').run('Unique topic');
    }).toThrow();
  });
});


