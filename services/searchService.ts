/**
 * Search Service
 * Provides search functionality with relevance scoring, fuzzy matching, and analytics
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Opportunity } from '../types';

const SEARCH_HISTORY_KEY = '@search_history';
const SEARCH_CACHE_KEY = '@search_cache';
const MAX_HISTORY_ITEMS = 10;
const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes

export interface SearchResult extends Opportunity {
  relevanceScore: number;
  matchedFields?: string[];
  highlightedTitle?: string;
  highlightedDescription?: string;
}

export interface SearchOptions {
  query: string;
  category?: string;
  dateRange?: 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'upcoming';
  maxDistance?: number;
  minSpotsAvailable?: number;
  organizationVerified?: boolean;
  sortBy?: 'relevance' | 'distance' | 'date' | 'spots';
  limit?: number;
  offset?: number;
}

export interface SearchCacheEntry {
  query: string;
  results: SearchResult[];
  timestamp: number;
  options: SearchOptions;
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  const len1 = str1.length;
  const len2 = str2.length;

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate relevance score for an opportunity
 */
export function calculateRelevance(
  opp: Opportunity,
  query: string,
  queryWords: string[]
): { score: number; matchedFields: string[] } {
  let score = 0;
  const matchedFields: string[] = [];
  const lowerQuery = query.toLowerCase().trim();
  
  const title = opp.title.toLowerCase();
  const desc = opp.description?.toLowerCase() || '';
  const org = opp.organizationName.toLowerCase();
  const loc = opp.location?.toLowerCase() || '';
  const category = opp.category.toLowerCase();

  // Exact matches (highest priority)
  if (title === lowerQuery) {
    score += 1000;
    matchedFields.push('title');
  }
  if (org === lowerQuery) {
    score += 800;
    matchedFields.push('organization');
  }

  // Starts with (high priority)
  if (title.startsWith(lowerQuery)) {
    score += 500;
    if (!matchedFields.includes('title')) matchedFields.push('title');
  }
  if (org.startsWith(lowerQuery)) {
    score += 400;
    if (!matchedFields.includes('organization')) matchedFields.push('organization');
  }

  // Contains (medium priority)
  if (title.includes(lowerQuery)) {
    score += 300;
    if (!matchedFields.includes('title')) matchedFields.push('title');
  }
  if (org.includes(lowerQuery)) {
    score += 200;
    if (!matchedFields.includes('organization')) matchedFields.push('organization');
  }
  if (desc.includes(lowerQuery)) {
    score += 100;
    if (!matchedFields.includes('description')) matchedFields.push('description');
  }
  if (loc.includes(lowerQuery)) {
    score += 50;
    if (!matchedFields.includes('location')) matchedFields.push('location');
  }
  if (category.includes(lowerQuery)) {
    score += 30;
    if (!matchedFields.includes('category')) matchedFields.push('category');
  }

  // Word matches (for multi-word queries)
  queryWords.forEach(word => {
    if (word.length < 2) return; // Skip single characters
    
    if (title.includes(word)) {
      score += 150;
      if (!matchedFields.includes('title')) matchedFields.push('title');
    }
    if (org.includes(word)) {
      score += 100;
      if (!matchedFields.includes('organization')) matchedFields.push('organization');
    }
    if (desc.includes(word)) {
      score += 50;
      if (!matchedFields.includes('description')) matchedFields.push('description');
    }
    if (loc.includes(word)) {
      score += 25;
      if (!matchedFields.includes('location')) matchedFields.push('location');
    }
  });

  // Fuzzy matching for typos (lower priority)
  const titleWords = title.split(/\s+/);
  const orgWords = org.split(/\s+/);
  
  queryWords.forEach(word => {
    if (word.length < 3) return; // Only fuzzy match words 3+ chars
    
    titleWords.forEach(titleWord => {
      if (titleWord.length > 0) {
        const distance = levenshteinDistance(word, titleWord);
        const maxDistance = Math.floor(word.length / 3); // Allow 1/3 of word length as typo
        
        if (distance <= maxDistance && distance > 0) {
          score += 50 - (distance * 10); // Decreasing score for more typos
          if (!matchedFields.includes('title')) matchedFields.push('title');
        }
      }
    });
    
    orgWords.forEach(orgWord => {
      if (orgWord.length > 0) {
        const distance = levenshteinDistance(word, orgWord);
        const maxDistance = Math.floor(word.length / 3);
        
        if (distance <= maxDistance && distance > 0) {
          score += 30 - (distance * 5);
          if (!matchedFields.includes('organization')) matchedFields.push('organization');
        }
      }
    });
  });

  return { score, matchedFields };
}

/**
 * Highlight search terms in text
 */
export function highlightSearchTerms(
  text: string,
  query: string,
  queryWords: string[]
): string {
  if (!text || !query) return text;
  
  let highlighted = text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Highlight exact phrase first
  if (lowerText.includes(lowerQuery)) {
    const regex = new RegExp(`(${escapeRegex(lowerQuery)})`, 'gi');
    highlighted = highlighted.replace(regex, '**$1**');
  }
  
  // Then highlight individual words
  queryWords.forEach(word => {
    if (word.length >= 2) {
      const regex = new RegExp(`(${escapeRegex(word)})`, 'gi');
      highlighted = highlighted.replace(regex, '**$1**');
    }
  });
  
  return highlighted;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Search opportunities with relevance scoring
 */
export function searchOpportunities(
  opportunities: Opportunity[],
  options: SearchOptions
): SearchResult[] {
  const { query, category, dateRange, maxDistance, minSpotsAvailable, organizationVerified, sortBy = 'relevance' } = options;
  
  let results: SearchResult[] = [];
  
  // Filter by category
  if (category && category !== 'all' && category !== 'nearMe') {
    results = opportunities.filter(opp => opp.category === category);
  } else {
    results = [...opportunities];
  }
  
  // Filter by date range
  if (dateRange && dateRange !== 'all') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    results = results.filter(opp => {
      const oppDate = opp.dateEnd ? new Date(opp.dateEnd) : opp.date ? new Date(opp.date) : null;
      if (!oppDate) return true;
      
      switch (dateRange) {
        case 'today':
          return oppDate.toDateString() === today.toDateString();
        case 'thisWeek':
          const weekFromNow = new Date(today);
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          return oppDate >= today && oppDate <= weekFromNow;
        case 'thisMonth':
          const monthFromNow = new Date(today);
          monthFromNow.setMonth(monthFromNow.getMonth() + 1);
          return oppDate >= today && oppDate <= monthFromNow;
        case 'upcoming':
          return oppDate >= today;
        default:
          return true;
      }
    });
  }
  
  // Filter by distance
  if (maxDistance !== undefined) {
    results = results.filter(opp => 
      opp.distance !== undefined && opp.distance <= maxDistance
    );
  }
  
  // Filter by spots available
  if (minSpotsAvailable !== undefined) {
    results = results.filter(opp => 
      opp.spotsAvailable >= minSpotsAvailable
    );
  }
  
  // Filter by organization verified
  if (organizationVerified !== undefined) {
    results = results.filter(opp => 
      opp.organizationVerified === organizationVerified
    );
  }
  
  // Apply search query
  if (query && query.trim()) {
    const trimmedQuery = query.trim();
    const queryWords = trimmedQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    results = results
      .map(opp => {
        const { score, matchedFields } = calculateRelevance(opp, trimmedQuery, queryWords);
        const highlightedTitle = highlightSearchTerms(opp.title, trimmedQuery, queryWords);
        const highlightedDescription = opp.description 
          ? highlightSearchTerms(opp.description, trimmedQuery, queryWords)
          : undefined;
        
        return {
          ...opp,
          relevanceScore: score,
          matchedFields,
          highlightedTitle,
          highlightedDescription,
        };
      })
      .filter(opp => opp.relevanceScore > 0);
  } else {
    // No query, assign default scores
    results = results.map(opp => ({
      ...opp,
      relevanceScore: 0,
      matchedFields: [],
    }));
  }
  
  // Sort results
  switch (sortBy) {
    case 'relevance':
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      break;
    case 'distance':
      results.sort((a, b) => {
        const distA = a.distance ?? Infinity;
        const distB = b.distance ?? Infinity;
        return distA - distB;
      });
      break;
    case 'date':
      results.sort((a, b) => {
        const dateA = a.dateEnd ? new Date(a.dateEnd).getTime() : a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.dateEnd ? new Date(b.dateEnd).getTime() : b.date ? new Date(b.date).getTime() : 0;
        return dateA - dateB;
      });
      break;
    case 'spots':
      results.sort((a, b) => b.spotsAvailable - a.spotsAvailable);
      break;
  }
  
  // Apply pagination
  if (options.offset !== undefined && options.limit !== undefined) {
    results = results.slice(options.offset, options.offset + options.limit);
  }
  
  return results;
}

/**
 * Get search history
 */
export async function getSearchHistory(): Promise<string[]> {
  try {
    const historyJson = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    if (!historyJson) return [];
    const history = JSON.parse(historyJson);
    return Array.isArray(history) ? history : [];
  } catch (error) {
    console.error('Error getting search history:', error);
    return [];
  }
}

/**
 * Save search to history
 */
export async function saveSearchToHistory(query: string): Promise<void> {
  try {
    if (!query || !query.trim()) return;
    
    const trimmedQuery = query.trim();
    let history = await getSearchHistory();
    
    // Remove if already exists
    history = history.filter(item => item.toLowerCase() !== trimmedQuery.toLowerCase());
    
    // Add to beginning
    history.unshift(trimmedQuery);
    
    // Limit to MAX_HISTORY_ITEMS
    history = history.slice(0, MAX_HISTORY_ITEMS);
    
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving search history:', error);
  }
}

/**
 * Clear search history
 */
export async function clearSearchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing search history:', error);
  }
}

/**
 * Get cached search results
 */
export async function getCachedSearch(options: SearchOptions): Promise<SearchResult[] | null> {
  try {
    const cacheJson = await AsyncStorage.getItem(SEARCH_CACHE_KEY);
    if (!cacheJson) return null;
    
    const cache: Record<string, SearchCacheEntry> = JSON.parse(cacheJson);
    const cacheKey = JSON.stringify(options);
    const entry = cache[cacheKey];
    
    if (!entry) return null;
    
    // Check if cache is still valid
    const now = Date.now();
    if (now - entry.timestamp > MAX_CACHE_AGE) {
      // Cache expired, remove it
      delete cache[cacheKey];
      await AsyncStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache));
      return null;
    }
    
    return entry.results;
  } catch (error) {
    console.error('Error getting cached search:', error);
    return null;
  }
}

/**
 * Cache search results
 */
export async function cacheSearchResults(
  options: SearchOptions,
  results: SearchResult[]
): Promise<void> {
  try {
    const cacheJson = await AsyncStorage.getItem(SEARCH_CACHE_KEY);
    const cache: Record<string, SearchCacheEntry> = cacheJson ? JSON.parse(cacheJson) : {};
    
    const cacheKey = JSON.stringify(options);
    cache[cacheKey] = {
      query: options.query,
      results,
      timestamp: Date.now(),
      options,
    };
    
    // Limit cache size (keep last 20 searches)
    const entries = Object.entries(cache);
    if (entries.length > 20) {
      // Remove oldest entries
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      entries.slice(0, entries.length - 20).forEach(([key]) => delete cache[key]);
    }
    
    await AsyncStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error caching search results:', error);
  }
}

/**
 * Generate search suggestions based on opportunities
 */
export function generateSearchSuggestions(
  opportunities: Opportunity[],
  query: string,
  limit: number = 5
): string[] {
  if (!query || query.trim().length < 2) return [];
  
  const lowerQuery = query.toLowerCase().trim();
  const suggestions = new Set<string>();
  
  // Extract unique titles, organizations, and locations
  const titles = new Set<string>();
  const organizations = new Set<string>();
  const locations = new Set<string>();
  
  opportunities.forEach(opp => {
    if (opp.title.toLowerCase().includes(lowerQuery)) {
      titles.add(opp.title);
    }
    if (opp.organizationName.toLowerCase().includes(lowerQuery)) {
      organizations.add(opp.organizationName);
    }
    if (opp.location?.toLowerCase().includes(lowerQuery)) {
      locations.add(opp.location);
    }
  });
  
  // Add suggestions in priority order
  Array.from(titles).slice(0, 3).forEach(title => suggestions.add(title));
  Array.from(organizations).slice(0, 2).forEach(org => suggestions.add(org));
  Array.from(locations).slice(0, 2).forEach(loc => suggestions.add(loc));
  
  return Array.from(suggestions).slice(0, limit);
}

/**
 * Track search analytics
 */
export function trackSearchAnalytics(
  query: string,
  resultCount: number,
  clickedResultId?: string
): void {
  // In a real app, this would send to analytics service
  console.log('[SEARCH_ANALYTICS]', {
    query,
    resultCount,
    clickedResultId,
    timestamp: new Date().toISOString(),
  });
  
  // You can integrate with your analytics service here
  // Example: Analytics.track('search_performed', { query, resultCount });
}

