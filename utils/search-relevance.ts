/** Rank search results by their similarity to the original search text. */
import { SearchResult } from '@/types/api';

function terms(value: string): string[] {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function isSeason(term: string): boolean {
  return /^s\d{1,2}(?:e\d{1,3})?$|^e\d{1,3}$/.test(term);
}

function isQuality(term: string): boolean {
  return /^(?:2160|1440|1080|720|480|360)p?$|^4k$|^uhd$|^hdr\d*$/.test(term);
}

function termWeight(term: string): number {
  return isSeason(term) ? 40 : isQuality(term) ? 20 : 100;
}

/** Adjacent swapped letters count as one edit. */
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

/** Longest uninterrupted sequence shared by two terms. */
function longestRun(a: string, b: string): number {
  let best = 0;
  let previous = Array<number>(b.length + 1).fill(0);
  for (const letter of a) {
    const current = Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (letter === b[j - 1]) {
        current[j] = previous[j - 1] + 1;
        best = Math.max(best, current[j]);
      }
    }
    previous = current;
  }
  return best;
}

function similarity(queryTerm: string, titleTerm: string): number {
  if (queryTerm === titleTerm) return 1;
  if (titleTerm.startsWith(queryTerm)) return 0.9;
  if (queryTerm.length < 4 || isSeason(queryTerm) || isQuality(queryTerm)) return 0;
  if (Math.abs(queryTerm.length - titleTerm.length) > Math.max(3, queryTerm.length / 3)) return 0;
  const distanceScore = 1 - editDistance(queryTerm, titleTerm) / Math.max(queryTerm.length, titleTerm.length);
  const runScore = longestRun(queryTerm, titleTerm) / queryTerm.length;
  return Math.max(0, distanceScore * 0.85 + runScore * 0.15);
}

function bestSimilarity(term: string, titleTerms: string[]): number {
  return titleTerms.reduce((best, titleTerm) => Math.max(best, similarity(term, titleTerm)), 0);
}

/** Match title words while leaving season and quality to the ranking. */
export function matchesTitleApproximately(fileName: string, query: string): boolean {
  const titleTerms = terms(fileName);
  const queryTitleTerms = terms(query).filter((term) => !isSeason(term) && !isQuality(term));
  return queryTitleTerms.every((term) => bestSimilarity(term, titleTerms) >= 0.65);
}

function relevanceScore(fileName: string, query: string): number {
  const titleTerms = terms(fileName);
  let score = 0;
  for (const term of new Set(terms(query))) {
    const closeness = bestSimilarity(term, titleTerms);
    score += termWeight(term) * closeness * closeness;
  }
  return score;
}

const scoreCache = new Map<string, number>();
function cachedScore(fileName: string, query: string): number {
  const key = `${query}\0${fileName}`;
  const cached = scoreCache.get(key);
  if (cached !== undefined) return cached;
  if (scoreCache.size > 5000) scoreCache.clear();
  const score = relevanceScore(fileName, query);
  scoreCache.set(key, score);
  return score;
}

/** Descending relevance, with seeders descending only when scores tie. */
export function compareByRelevance(a: SearchResult, b: SearchResult, query: string): number {
  const difference = cachedScore(b.fileName ?? '', query) - cachedScore(a.fileName ?? '', query);
  if (difference !== 0) return difference;
  return Math.max(0, b.nbSeeders ?? 0) - Math.max(0, a.nbSeeders ?? 0);
}

/** Drop quality words so other available versions of a title can be found. */
export function withoutQualityPattern(query: string): string | null {
  const words = terms(query);
  const relaxed = words.filter((word) => !isQuality(word)).join(' ');
  return relaxed && relaxed !== words.join(' ') ? relaxed : null;
}

/** Use a short title prefix to discover spelling variants. */
export function broaderSearchPattern(query: string): string | null {
  const titleTerm = terms(query).find((term) => term.length >= 5 && !isSeason(term) && !isQuality(term));
  if (!titleTerm) return null;
  const prefix = titleTerm.slice(0, Math.min(4, Math.max(3, Math.floor(titleTerm.length / 3))));
  return prefix === query.trim().toLowerCase() ? null : prefix;
}
