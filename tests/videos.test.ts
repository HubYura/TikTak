import { describe, expect, it } from 'vitest';
import { STAGES } from '../src/core/content';
import { TRAPS } from '../src/core/questions';
import { ALL_VIDEOS, STAGE_VIDEOS, TRAP_VIDEOS } from '../src/core/videos';
import { parseManifest } from '../src/lib/video';

describe('каталог відео', () => {
  it('по кліпу на кожен етап і кожну пастку, id унікальні', () => {
    expect(STAGE_VIDEOS).toHaveLength(STAGES.length);
    for (const t of TRAPS) expect(TRAP_VIDEOS[t]).toBeDefined();
    const ids = ALL_VIDEOS.map(v => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of ALL_VIDEOS) {
      expect(v.id).toMatch(/^[a-z0-9-]+$/i);
      expect(v.say.length).toBeGreaterThan(40);
      // ~15–35 с озвучки: діти не дивляться довгих пояснень
      expect(v.say.split(/\s+/).length).toBeLessThan(75);
    }
  });
});

describe('parseManifest', () => {
  it('розв’язує шляхи відносно сховища й відкидає сміття', () => {
    const m = parseManifest({
      clips: {
        'stage-1': { src: 'stage-1.mp4', poster: 'p/stage-1.jpg' },
        'bad id!': { src: 'x.mp4' },
        'stage-2': { poster: 'no-src.jpg' },
        'intro': { src: 'https://cdn.example.com/intro.mp4', vtt: 'intro.vtt' }
      }
    }, 'https://blob.example.com/videos');
    expect([...m.keys()]).toEqual(['stage-1', 'intro']);
    expect(m.get('stage-1')!.src).toBe('https://blob.example.com/videos/stage-1.mp4');
    expect(m.get('stage-1')!.poster).toBe('https://blob.example.com/videos/p/stage-1.jpg');
    expect(m.get('intro')!.src).toBe('https://cdn.example.com/intro.mp4');
    expect(m.get('intro')!.vtt).toBe('https://blob.example.com/videos/intro.vtt');
    expect(parseManifest(null, 'https://x/').size).toBe(0);
    expect(parseManifest({ clips: 5 }, 'https://x/').size).toBe(0);
  });
});

import { MOTION, sentences } from '../src/core/video-beats';

describe('партитура руху', () => {
  it('кожен кліп має біт на кожне речення й коректний час', () => {
    const t = /^([01]?\d|2[0-3]):[0-5]\d$/;
    for (const v of ALL_VIDEOS) {
      const m = MOTION[v.id];
      expect(m, v.id).toBeDefined();
      expect(m.beats.length, v.id + ': ' + sentences(v.say).join(' | ')).toBe(sentences(v.say).length);
      expect(m.start).toMatch(t);
      for (const b of m.beats) {
        if (b.clock) expect(b.clock).toMatch(t);
        expect(b.clock && b.turn).toBeFalsy();
        if (b.label) expect(b.label).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
    expect(Object.keys(MOTION).sort()).toEqual(ALL_VIDEOS.map(v => v.id).sort());
  });
});
