/**
 * Hashtag Utilities
 * Functions for parsing, detecting, and handling #hashtags
 * Links to events, causes, and opportunities
 */

export type HashtagType = 'event' | 'cause' | 'opportunity';

export interface ParsedHashtag {
  id: string;
  name: string;
  type: HashtagType;
  startIndex: number;
  endIndex: number;
}

export interface HashtagItem {
  id: string;
  name: string;
  type: HashtagType;
  description?: string;
  imageUrl?: string;
}

/**
 * Regex to detect if user is currently typing a hashtag
 * Returns the partial text after #
 */
export const TYPING_HASHTAG_REGEX = /#(\w*)$/;

/**
 * Check if the user is currently typing a hashtag
 * Returns the search query if they are, null otherwise
 */
export const getTypingHashtag = (text: string, cursorPosition: number): string | null => {
  // Get text up to cursor
  const textBeforeCursor = text.slice(0, cursorPosition);
  
  // Check if there's a # being typed
  const match = textBeforeCursor.match(TYPING_HASHTAG_REGEX);
  
  if (match) {
    return match[1]; // Return the partial name being typed
  }
  
  return null;
};

/**
 * Insert a hashtag into text at the current cursor position
 * Replaces the #partial with #[Name](type:id)
 */
export const insertHashtag = (
  text: string,
  cursorPosition: number,
  item: HashtagItem
): { newText: string; newCursorPosition: number } => {
  const textBeforeCursor = text.slice(0, cursorPosition);
  const textAfterCursor = text.slice(cursorPosition);
  
  // Find the # symbol position
  const hashIndex = textBeforeCursor.lastIndexOf('#');
  
  if (hashIndex === -1) {
    return { newText: text, newCursorPosition: cursorPosition };
  }
  
  // Create the hashtag text - using format #[Name](item.type:item.id)
  const hashtagText = `#[${item.name}](${item.type}:${item.id}) `;
  
  // Build new text
  const newText = textBeforeCursor.slice(0, hashIndex) + hashtagText + textAfterCursor;
  const newCursorPosition = hashIndex + hashtagText.length;
  
  return { newText, newCursorPosition };
};

/**
 * Extract all tagged items from text
 * Returns arrays of event, cause, and opportunity IDs
 */
export const extractHashtagIds = (text: string): {
  eventIds: string[];
  causeIds: string[];
  opportunityIds: string[];
} => {
  const hashtagPattern = /#\[([^\]]+)\]\((event|cause|opportunity):([^)]+)\)/g;
  const eventIds: string[] = [];
  const causeIds: string[] = [];
  const opportunityIds: string[] = [];
  let match;
  
  while ((match = hashtagPattern.exec(text)) !== null) {
    const type = match[2] as HashtagType;
    const id = match[3];
    
    if (type === 'event') {
      eventIds.push(id);
    } else if (type === 'cause') {
      causeIds.push(id);
    } else if (type === 'opportunity') {
      opportunityIds.push(id);
    }
  }
  
  return {
    eventIds: [...new Set(eventIds)],
    causeIds: [...new Set(causeIds)],
    opportunityIds: [...new Set(opportunityIds)],
  };
};

/**
 * Convert hashtag markup to display text
 * #[Event Name](event:uuid) -> #Event Name
 */
export const hashtagToDisplayText = (text: string): string => {
  return text.replace(/#\[([^\]]+)\]\((event|cause|opportunity):[^)]+\)/g, '#$1');
};

/**
 * Parse text and return segments for rendering
 * Each segment is either plain text or a hashtag
 */
export interface HashtagSegment {
  type: 'text' | 'hashtag';
  content: string;
  hashtagType?: HashtagType;
  hashtagId?: string;
}

export const parseTextWithHashtags = (text: string): HashtagSegment[] => {
  const segments: HashtagSegment[] = [];
  const hashtagPattern = /#\[([^\]]+)\]\((event|cause|opportunity):([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = hashtagPattern.exec(text)) !== null) {
    // Add text before this hashtag
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add the hashtag
    segments.push({
      type: 'hashtag',
      content: `#${match[1]}`, // #Event Name
      hashtagType: match[2] as HashtagType,
      hashtagId: match[3],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
};
