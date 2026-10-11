import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { classifyRegion, normalizeItem, isPrivateAddress } = require('../electron/feed-service.cjs');

describe('RSS normalization and regional tagging', () => {
  it('classifies India–Canada articles as bilateral', () => {
    expect(classifyRegion('Canada', 'India and Canada discuss trade', '')).toBe('India–Canada');
  });

  it('retains a source region when an article is not bilateral', () => {
    expect(classifyRegion('India', 'New infrastructure programme announced', '')).toBe('India');
  });

  it('normalizes source links and leaves missing publication dates unknown', () => {
    const item = normalizeItem({ title: 'Example headline', link: 'https://example.org/story', pubDate: '2026-01-02T03:04:05Z' });
    expect(item.title).toBe('Example headline');
    expect(item.link).toBe('https://example.org/story');
    expect(item.publishedAt).toBe('2026-01-02T03:04:05.000Z');
    expect(normalizeItem({ title: 'Undated' }).publishedAt).toBe(null);
  });

  it('identifies private and public IPv4 address ranges', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('192.168.1.12')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
  });
});
