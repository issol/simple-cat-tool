import type { Segment, TermbaseEntry, QAIssue, QACheck, QAIssueType } from '@/types';

// Default QA checks configuration
export const DEFAULT_QA_CHECKS: QACheck[] = [
  {
    type: 'empty_target',
    name: 'Empty Target',
    description: 'Target segment is empty',
    severity: 'error',
    enabled: true,
  },
  {
    type: 'numbers_mismatch',
    name: 'Numbers Mismatch',
    description: 'Numbers in source and target do not match',
    severity: 'warning',
    enabled: true,
  },
  {
    type: 'trailing_punctuation',
    name: 'Trailing Punctuation',
    description: 'Trailing punctuation differs between source and target',
    severity: 'warning',
    enabled: true,
  },
  {
    type: 'leading_trailing_spaces',
    name: 'Leading/Trailing Spaces',
    description: 'Target has unexpected leading or trailing spaces',
    severity: 'warning',
    enabled: true,
  },
  {
    type: 'double_spaces',
    name: 'Double Spaces',
    description: 'Target contains multiple consecutive spaces',
    severity: 'warning',
    enabled: true,
  },
  {
    type: 'repeated_words',
    name: 'Repeated Words',
    description: 'Same word appears consecutively in target',
    severity: 'warning',
    enabled: true,
  },
  {
    type: 'inconsistent_translation',
    name: 'Inconsistent Translation',
    description: 'Same source has different translations',
    severity: 'warning',
    enabled: true,
  },
  {
    type: 'terminology_not_used',
    name: 'Terminology Not Used',
    description: 'Term from termbase not found in target',
    severity: 'warning',
    enabled: true,
  },
  {
    type: 'target_same_as_source',
    name: 'Target Same as Source',
    description: 'Target is identical to source',
    severity: 'warning',
    enabled: true,
  },
];

// Extract numbers from text
function extractNumbers(text: string): string[] {
  const matches = text.match(/\d+([.,]\d+)?/g);
  return matches ? matches.sort() : [];
}

// Get trailing punctuation
function getTrailingPunctuation(text: string): string {
  const match = text.trim().match(/[.!?。！？:;,،؛]+$/);
  return match ? match[0] : '';
}

// Check for empty target
function checkEmptyTarget(segment: Segment): QAIssue | null {
  if (segment.status !== 'new' && !segment.target.trim()) {
    return {
      type: 'empty_target',
      severity: 'error',
      message: 'Target segment is empty',
      segmentId: segment.id,
    };
  }
  return null;
}

// Check for numbers mismatch
function checkNumbersMismatch(segment: Segment): QAIssue | null {
  if (!segment.target) return null;

  const sourceNumbers = extractNumbers(segment.source);
  const targetNumbers = extractNumbers(segment.target);

  if (JSON.stringify(sourceNumbers) !== JSON.stringify(targetNumbers)) {
    const missing = sourceNumbers.filter(n => !targetNumbers.includes(n));
    const extra = targetNumbers.filter(n => !sourceNumbers.includes(n));

    let message = 'Numbers mismatch:';
    if (missing.length > 0) message += ` missing [${missing.join(', ')}]`;
    if (extra.length > 0) message += ` extra [${extra.join(', ')}]`;

    return {
      type: 'numbers_mismatch',
      severity: 'warning',
      message,
      segmentId: segment.id,
    };
  }
  return null;
}

// Check trailing punctuation
function checkTrailingPunctuation(segment: Segment): QAIssue | null {
  if (!segment.target) return null;

  const sourcePunct = getTrailingPunctuation(segment.source);
  const targetPunct = getTrailingPunctuation(segment.target);

  // Only check if source has punctuation
  if (sourcePunct && sourcePunct !== targetPunct) {
    return {
      type: 'trailing_punctuation',
      severity: 'warning',
      message: `Trailing punctuation mismatch: source "${sourcePunct}" vs target "${targetPunct || '(none)'}"`,
      segmentId: segment.id,
    };
  }
  return null;
}

// Check leading/trailing spaces
function checkLeadingTrailingSpaces(segment: Segment): QAIssue | null {
  if (!segment.target) return null;

  const hasLeadingSpace = segment.target.startsWith(' ') && !segment.source.startsWith(' ');
  const hasTrailingSpace = segment.target.endsWith(' ') && !segment.source.endsWith(' ');

  if (hasLeadingSpace || hasTrailingSpace) {
    const issues = [];
    if (hasLeadingSpace) issues.push('leading');
    if (hasTrailingSpace) issues.push('trailing');

    return {
      type: 'leading_trailing_spaces',
      severity: 'warning',
      message: `Unexpected ${issues.join(' and ')} space(s) in target`,
      segmentId: segment.id,
    };
  }
  return null;
}

// Check double spaces
function checkDoubleSpaces(segment: Segment): QAIssue | null {
  if (!segment.target) return null;

  if (/\s{2,}/.test(segment.target)) {
    return {
      type: 'double_spaces',
      severity: 'warning',
      message: 'Target contains multiple consecutive spaces',
      segmentId: segment.id,
    };
  }
  return null;
}

// Check repeated words
function checkRepeatedWords(segment: Segment): QAIssue | null {
  if (!segment.target) return null;

  const words = segment.target.toLowerCase().split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1] && words[i].length > 1) {
      return {
        type: 'repeated_words',
        severity: 'warning',
        message: `Repeated word: "${words[i]}"`,
        segmentId: segment.id,
      };
    }
  }
  return null;
}

// Check inconsistent translations
function checkInconsistentTranslation(
  segment: Segment,
  allSegments: Segment[]
): QAIssue | null {
  if (!segment.target) return null;

  const sameSourceSegments = allSegments.filter(
    (s) => s.source === segment.source && s.target && s.id !== segment.id
  );

  const differentTargets = sameSourceSegments.filter(
    (s) => s.target !== segment.target
  );

  if (differentTargets.length > 0) {
    return {
      type: 'inconsistent_translation',
      severity: 'warning',
      message: `Inconsistent translation: same source has ${differentTargets.length + 1} different translations`,
      segmentId: segment.id,
    };
  }
  return null;
}

// Check terminology usage (whole word matching)
function checkTerminologyUsage(
  segment: Segment,
  termbase: TermbaseEntry[]
): QAIssue | null {
  if (!segment.target) return null;

  const sourceLower = segment.source.toLowerCase();
  const targetLower = segment.target.toLowerCase();

  for (const term of termbase) {
    const termSourceLower = term.source.toLowerCase();
    // Use word boundary regex to match whole words only
    // This prevents matching "cloud" inside "CloudSync"
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(termSourceLower)}\\b`, 'i');

    if (wordBoundaryRegex.test(segment.source)) {
      if (!targetLower.includes(term.target.toLowerCase())) {
        return {
          type: 'terminology_not_used',
          severity: 'warning',
          message: `Term "${term.source}" found in source but "${term.target}" not in target`,
          segmentId: segment.id,
        };
      }
    }
  }
  return null;
}

// Escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Check if target is same as source
function checkTargetSameAsSource(segment: Segment): QAIssue | null {
  if (!segment.target) return null;

  // Skip if source is very short (might be intentional, like numbers or codes)
  if (segment.source.length <= 3) return null;

  if (segment.source === segment.target) {
    return {
      type: 'target_same_as_source',
      severity: 'warning',
      message: 'Target is identical to source (not translated?)',
      segmentId: segment.id,
    };
  }
  return null;
}

// Run single segment QA check
export function runSegmentQA(
  segment: Segment,
  allSegments: Segment[],
  termbase: TermbaseEntry[],
  enabledChecks: QAIssueType[]
): QAIssue[] {
  const issues: QAIssue[] = [];

  if (enabledChecks.includes('empty_target')) {
    const issue = checkEmptyTarget(segment);
    if (issue) issues.push(issue);
  }

  if (enabledChecks.includes('numbers_mismatch')) {
    const issue = checkNumbersMismatch(segment);
    if (issue) issues.push(issue);
  }

  if (enabledChecks.includes('trailing_punctuation')) {
    const issue = checkTrailingPunctuation(segment);
    if (issue) issues.push(issue);
  }

  if (enabledChecks.includes('leading_trailing_spaces')) {
    const issue = checkLeadingTrailingSpaces(segment);
    if (issue) issues.push(issue);
  }

  if (enabledChecks.includes('double_spaces')) {
    const issue = checkDoubleSpaces(segment);
    if (issue) issues.push(issue);
  }

  if (enabledChecks.includes('repeated_words')) {
    const issue = checkRepeatedWords(segment);
    if (issue) issues.push(issue);
  }

  if (enabledChecks.includes('inconsistent_translation')) {
    const issue = checkInconsistentTranslation(segment, allSegments);
    if (issue) issues.push(issue);
  }

  if (enabledChecks.includes('terminology_not_used')) {
    const issue = checkTerminologyUsage(segment, termbase);
    if (issue) issues.push(issue);
  }

  if (enabledChecks.includes('target_same_as_source')) {
    const issue = checkTargetSameAsSource(segment);
    if (issue) issues.push(issue);
  }

  return issues;
}

// Run QA on all segments
export function runFullQA(
  segments: Segment[],
  termbase: TermbaseEntry[],
  enabledChecks: QAIssueType[]
): QAIssue[] {
  const allIssues: QAIssue[] = [];

  for (const segment of segments) {
    // Only check confirmed or translated segments
    if (segment.status === 'new') continue;

    const issues = runSegmentQA(segment, segments, termbase, enabledChecks);
    allIssues.push(...issues);
  }

  return allIssues;
}

// Get issue type display name
export function getIssueTypeName(type: QAIssueType): string {
  const check = DEFAULT_QA_CHECKS.find((c) => c.type === type);
  return check?.name || type;
}

// Get issue severity color
export function getIssueSeverityColor(severity: 'error' | 'warning'): string {
  return severity === 'error' ? 'bg-red-500' : 'bg-yellow-500';
}
