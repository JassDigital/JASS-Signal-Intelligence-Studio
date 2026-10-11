const Parser = require('rss-parser');
const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const net = require('node:net');

const parser = new Parser({ timeout: 15000, maxRedirects: 0 });
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_ITEMS = 100;
const TIMEOUT_MS = 15000;

function isPrivateAddress(address) {
  const ip = String(address || '').split('%')[0].toLowerCase();
  const family = net.isIP(ip);
  if (family === 4) {
    const n = ip.split('.').map(Number);
    const a = n[0], b = n[1], c = n[2];
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113);
  }
  if (family === 6) {
    if (ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') ||
        ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') ||
        ip.startsWith('feb') || ip.startsWith('ff') || ip.startsWith('2001:db8:')) return true;
    if (ip.startsWith('::ffff:')) return isPrivateAddress(ip.slice(7));
    return false;
  }
  return true;
}

async function validatePublicUrl(value) {
  let url;
  try { url = new URL(String(value)); } catch { throw new Error('Feed URL is not a valid URL.'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS feed URLs are supported.');
  if (url.username || url.password) throw new Error('Feed URLs must not contain embedded credentials.');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Only standard HTTP/HTTPS ports are allowed.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error('Local-network feed URLs are not allowed.');
  }
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('Private or reserved IP addresses are not allowed.');
  } else {
    const addresses = await dns.lookup(host, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(x => isPrivateAddress(x.address))) {
      throw new Error('Feed host resolves to a private or reserved address.');
    }
  }
  url.hash = '';
  return url;
}

async function fetchFeedXml(initialUrl) {
  let url = await validatePublicUrl(initialUrl);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'JASS-Signal-Intelligence-Studio/0.2 (+local desktop RSS reader)',
          'Accept': 'application/atom+xml, application/rss+xml, application/xml, text/xml, */*'
        }
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (response.body) await response.body.cancel();
        if (!location || redirects === 3) throw new Error('Feed redirected too many times.');
        url = await validatePublicUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}.`);
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > MAX_BYTES) throw new Error('Feed exceeds the 4 MB response limit.');
      if (!response.body) throw new Error('Feed response was empty.');

      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new Error('Feed exceeds the 4 MB response limit.');
        }
        chunks.push(Buffer.from(value));
      }
      const xml = Buffer.concat(chunks).toString('utf8');
      if (!xml.trim()) throw new Error('Feed response was empty.');
      return xml;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Feed request timed out after 15 seconds.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Could not resolve feed redirects.');
}
function cleanText(value, max = 5000) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

function isWebLink(value) {
  try { const u = new URL(String(value)); return ['https:', 'http:'].includes(u.protocol) ? u.toString() : null; }
  catch { return null; }
}

function normalizeItem(item) {
  const title = cleanText(item.title || 'Untitled feed item', 300);
  const summary = cleanText(item.contentSnippet || item.summary || item.content || item['content:encoded'] || '', 5000);
  const link = isWebLink(item.link) || isWebLink(item.guid) || null;
  const rawDate = item.isoDate || item.pubDate || item.published || item.updated || null;
  const parsedDate = rawDate ? new Date(rawDate) : null;
  const publishedAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;
  const sourceGuid = String(item.guid || item.id || link || '').trim();
  const guid = (sourceGuid || crypto.createHash('sha256').update(`${title}\n${publishedAt || ''}`).digest('hex')).slice(0, 1000);
  return { guid, title, summary, link, publishedAt };
}

function classifyRegion(sourceRegion, title, summary) {
  const text = `${title || ''} ${summary || ''}`;
  const hasIndia = /\bindia\b|\bindian\b/i.test(text);
  const hasCanada = /\bcanada\b|\bcanadian\b/i.test(text);
  if (hasIndia && hasCanada) return 'India–Canada';
  if (hasIndia) return 'India';
  if (hasCanada) return 'Canada';
  return ['India', 'Canada', 'India–Canada', 'Global', 'Asia-Pacific', 'North America'].includes(sourceRegion)
    ? sourceRegion : 'Global';
}

function topicMatches(name, text) {
  const n = String(name || '').toLowerCase();
  if (n.includes('india') && n.includes('canada')) return /\bindia\b|\bindian\b/i.test(text) && /\bcanada\b|\bcanadian\b/i.test(text);
  if (n === 'india') return /\bindia\b|\bindian\b/i.test(text);
  if (n === 'canada') return /\bcanada\b|\bcanadian\b/i.test(text);
  if (n.includes('trade') || n.includes('investment')) return /\btrade\b|investment|tariff|export|import|supply chain/i.test(text);
  if (n.includes('energy') || n.includes('critical minerals')) return /\benergy\b|oil|natural gas|critical mineral|lithium|electricity|renewable/i.test(text);
  if (n.includes('technology') || n.includes('artificial intelligence')) return /\btechnology\b|artificial intelligence|\bAI\b|semiconductor|cybersecurity|digital infrastructure/i.test(text);
  const words = n.split(/[^a-z0-9]+/).filter(x => x.length > 2);
  return words.length > 0 && words.some(word => text.toLowerCase().includes(word));
}

async function refreshRssFeeds(db) {
  const sources = db.prepare("SELECT * FROM sources WHERE enabled=1 AND upper(type)='RSS' AND COALESCE(url,'')<>'' ORDER BY id").all();
  const results = [];
  let inserted = 0;
  let duplicates = 0;
  let failed = 0;
  const startRun = db.prepare("INSERT INTO collection_runs(source_id,status,message) VALUES(?,'Running','Manual RSS refresh')");
  const finishRun = db.prepare('UPDATE collection_runs SET finished_at=CURRENT_TIMESTAMP,status=?,items_found=?,message=? WHERE id=?');
  const updateSource = db.prepare('UPDATE sources SET last_checked_at=?,last_status=? WHERE id=?');
  const existingItem = db.prepare('SELECT id FROM feed_items WHERE source_id=? AND guid=?');
  const insertFeedItem = db.prepare('INSERT INTO feed_items(source_id,guid,event_id,canonical_url,published_at) VALUES(?,?,?,?,?)');
  const topicList = db.prepare('SELECT id,name FROM topics WHERE enabled=1').all();
  const linkTopic = db.prepare('INSERT OR IGNORE INTO event_topics(event_id,topic_id) VALUES(?,?)');

  for (const source of sources) {
    const runId = Number(startRun.run(source.id).lastInsertRowid);
    const checkedAt = new Date().toISOString();
    try {
      const xml = await fetchFeedXml(source.url);
      const parsed = await parser.parseString(xml);
      const normalized = (parsed.items || []).slice(0, MAX_ITEMS).map(normalizeItem).filter(x => x.title);
      let newCount = 0;
      let duplicateCount = 0;

      const persist = db.transaction(() => {
        for (const item of normalized) {
          const old = existingItem.get(source.id, item.guid);
          if (old) {
            db.prepare('UPDATE feed_items SET fetched_at=CURRENT_TIMESTAMP WHERE id=?').run(old.id);
            duplicateCount++;
            continue;
          }
          const text = `${item.title} ${item.summary}`;
          const region = classifyRegion(source.region, item.title, item.summary);
          const eventResult = db.prepare(`INSERT INTO events(title,summary,source_name,source_url,severity,region,status,published_at)
            VALUES(?,?,?,?,?,?,?,?)`).run(
              item.title, item.summary, source.name, item.link, 'Low', region, 'New', item.publishedAt
            );
          const eventId = Number(eventResult.lastInsertRowid);
          insertFeedItem.run(source.id, item.guid, eventId, item.link, item.publishedAt);
          for (const topic of topicList) {
            if (topicMatches(topic.name, text)) linkTopic.run(eventId, topic.id);
          }
          newCount++;
        }
      });
      persist();
      inserted += newCount;
      duplicates += duplicateCount;
      updateSource.run(checkedAt, `OK · ${newCount} new, ${duplicateCount} already seen`, source.id);
      finishRun.run('Success', newCount, `${newCount} new; ${duplicateCount} duplicate; ${normalized.length} items parsed.`, runId);
      results.push({ sourceId: source.id, source: source.name, status: 'Success', parsed: normalized.length, inserted: newCount, duplicates: duplicateCount, error: '' });
    } catch (error) {
      failed++;
      const message = String(error && error.message || error).slice(0, 240);
      updateSource.run(checkedAt, `Error: ${message}`, source.id);
      finishRun.run('Failure', 0, message, runId);
      results.push({ sourceId: source.id, source: source.name, status: 'Failure', parsed: 0, inserted: 0, duplicates: 0, error: message });
    }
  }
  return { attempted: sources.length, succeeded: results.filter(x => x.status === 'Success').length, failed, inserted, duplicates, results };
}

module.exports = { refreshRssFeeds, classifyRegion, normalizeItem, cleanText, isPrivateAddress };
