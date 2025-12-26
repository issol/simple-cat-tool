// Translation segment types
export interface Segment {
  id: number;
  source: string;
  target: string;
  status: 'new' | 'translated' | 'confirmed';
  matchRate: number;
}

// Translation Memory entry
export interface TMEntry {
  source: string;
  target: string;
  // Context for 101% matching (previous and next segment sources)
  prevSource?: string;
  nextSource?: string;
}

// Translation Memory match with calculated match rate
export interface TMMatch extends TMEntry {
  matchRate: number;
}

// Termbase entry
export interface TermbaseEntry {
  source: string;
  target: string;
  note: string;
}

// Supported languages (ISO 639-1)
export type LanguageCode = string;

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

// Segmentation delimiter types
export type DelimiterType = 'sentence' | 'newline' | 'paragraph';

// View types
export type ViewType = 'editor' | 'analysis' | 'qa' | 'tm' | 'termbase';

// QA issue types
export type QAIssueType =
  | 'empty_target'
  | 'numbers_mismatch'
  | 'trailing_punctuation'
  | 'leading_trailing_spaces'
  | 'double_spaces'
  | 'repeated_words'
  | 'inconsistent_translation'
  | 'terminology_not_used'
  | 'target_same_as_source';

export type QASeverity = 'error' | 'warning';

export interface QAIssue {
  type: QAIssueType;
  severity: QASeverity;
  message: string;
  segmentId: number;
  ignored?: boolean;
}

export interface QACheck {
  type: QAIssueType;
  name: string;
  description: string;
  severity: QASeverity;
  enabled: boolean;
}

// Statistics
export interface TranslationStats {
  total: number;
  translated: number;
  confirmed: number;
  new: number;
}

// Match tier for analysis
export interface MatchTier {
  name: string;
  label: string;
  min: number;
  max: number;
  rate: number;
  color: string;
}

// Match tier with calculated results
export interface MatchTierResult extends MatchTier {
  segments: number;
  words: number;
  cost: number;
}

// Analysis data
export interface AnalysisData {
  tiers: MatchTierResult[];
  totalSegments: number;
  totalWords: number;
  totalCost: number;
  fullCost: number;
  savings: number;
  savingsPercent: number;
}
