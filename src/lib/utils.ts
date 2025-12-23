import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { DelimiterType } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching in translation memory
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate match rate between source text and TM entry
 * Returns percentage (0-100)
 */
export function calculateMatchRate(source: string, tmSource: string): number {
  if (source === tmSource) return 100;

  const maxLen = Math.max(source.length, tmSource.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(
    source.toLowerCase(),
    tmSource.toLowerCase()
  );

  return Math.max(0, Math.round((1 - distance / maxLen) * 100));
}

/**
 * Segment text based on delimiter type
 */
export function segmentText(text: string, delimiter: DelimiterType): string[] {
  const delimiters: Record<DelimiterType, RegExp> = {
    sentence: /(?<=[.!?。！？])\s+/,
    newline: /\n+/,
    paragraph: /\n\n+/,
  };

  return text
    .split(delimiters[delimiter])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Get match rate badge color based on percentage
 */
export function getMatchRateColor(rate: number): string {
  if (rate === 100) return 'bg-green-600';
  if (rate >= 85) return 'bg-yellow-600';
  return 'bg-orange-600';
}

/**
 * Get status badge color
 */
export function getStatusColor(status: 'new' | 'translated' | 'confirmed'): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-600';
    case 'translated':
      return 'bg-yellow-600';
    default:
      return 'bg-slate-600';
  }
}

/**
 * Count words in a text string
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}
