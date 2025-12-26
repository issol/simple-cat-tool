import type { Segment, TMEntry } from '@/types';
import { calculateMatchRate } from './utils';

/**
 * 101% Context Match
 *
 * 컨텍스트 매치는 현재 세그먼트가 100% 매치이면서
 * 이전 세그먼트 또는 다음 세그먼트도 TM의 컨텍스트와 100% 일치할 때 발생합니다.
 *
 * 조건:
 * 1. 현재 세그먼트의 source가 TM entry의 source와 100% 일치
 * 2. 이전 세그먼트의 source가 TM entry의 prevSource와 100% 일치 OR
 *    다음 세그먼트의 source가 TM entry의 nextSource와 100% 일치
 */

/**
 * Calculate match rate with context (101% support)
 * @param segmentIndex - Current segment index
 * @param segments - All segments
 * @param tm - Translation Memory
 * @returns Match rate (0-100, or 101 for context match)
 */
export function calculateContextMatchRate(
  segmentIndex: number,
  segments: Segment[],
  tm: TMEntry[]
): number {
  const currentSegment = segments[segmentIndex];
  if (!currentSegment) return 0;

  const prevSegment = segmentIndex > 0 ? segments[segmentIndex - 1] : null;
  const nextSegment = segmentIndex < segments.length - 1 ? segments[segmentIndex + 1] : null;

  let bestMatchRate = 0;
  let hasContextMatch = false;

  for (const entry of tm) {
    const matchRate = calculateMatchRate(currentSegment.source, entry.source);

    if (matchRate === 100) {
      // Check for context match (101%)
      const prevMatches = prevSegment && entry.prevSource
        ? calculateMatchRate(prevSegment.source, entry.prevSource) === 100
        : false;

      const nextMatches = nextSegment && entry.nextSource
        ? calculateMatchRate(nextSegment.source, entry.nextSource) === 100
        : false;

      if (prevMatches || nextMatches) {
        hasContextMatch = true;
        break; // Found 101% match, no need to continue
      }
    }

    if (matchRate > bestMatchRate) {
      bestMatchRate = matchRate;
    }
  }

  return hasContextMatch ? 101 : bestMatchRate;
}

/**
 * Find best TM match with context support
 * @param segmentIndex - Current segment index
 * @param segments - All segments
 * @param tm - Translation Memory
 * @returns Best matching TM entry with match rate
 */
export function findBestMatchWithContext(
  segmentIndex: number,
  segments: Segment[],
  tm: TMEntry[]
): { entry: TMEntry | null; matchRate: number } {
  const currentSegment = segments[segmentIndex];
  if (!currentSegment) return { entry: null, matchRate: 0 };

  const prevSegment = segmentIndex > 0 ? segments[segmentIndex - 1] : null;
  const nextSegment = segmentIndex < segments.length - 1 ? segments[segmentIndex + 1] : null;

  let bestEntry: TMEntry | null = null;
  let bestMatchRate = 0;

  for (const entry of tm) {
    const matchRate = calculateMatchRate(currentSegment.source, entry.source);

    if (matchRate === 100) {
      // Check for context match (101%)
      const prevMatches = prevSegment && entry.prevSource
        ? calculateMatchRate(prevSegment.source, entry.prevSource) === 100
        : false;

      const nextMatches = nextSegment && entry.nextSource
        ? calculateMatchRate(nextSegment.source, entry.nextSource) === 100
        : false;

      if (prevMatches || nextMatches) {
        return { entry, matchRate: 101 }; // Found 101% match
      }

      if (matchRate > bestMatchRate) {
        bestMatchRate = matchRate;
        bestEntry = entry;
      }
    } else if (matchRate > bestMatchRate) {
      bestMatchRate = matchRate;
      bestEntry = entry;
    }
  }

  return { entry: bestEntry, matchRate: bestMatchRate };
}

/**
 * Create TM entry with context from segments
 * Called when confirming a segment to add to TM with context
 */
export function createTMEntryWithContext(
  segmentIndex: number,
  segments: Segment[]
): TMEntry {
  const currentSegment = segments[segmentIndex];
  const prevSegment = segmentIndex > 0 ? segments[segmentIndex - 1] : null;
  const nextSegment = segmentIndex < segments.length - 1 ? segments[segmentIndex + 1] : null;

  return {
    source: currentSegment.source,
    target: currentSegment.target,
    prevSource: prevSegment?.source,
    nextSource: nextSegment?.source,
  };
}

/**
 * Get match rate badge color (updated for 101%)
 */
export function getMatchRateColorWithContext(rate: number): string {
  if (rate === 101) return 'bg-purple-600'; // Context match
  if (rate === 100) return 'bg-green-600';  // Exact match
  if (rate >= 85) return 'bg-yellow-600';   // High fuzzy
  if (rate >= 75) return 'bg-orange-600';   // Low fuzzy
  return 'bg-red-600';                       // No match
}
