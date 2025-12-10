/**
 * Mention Utilities
 * Functions for parsing, detecting, and handling @mentions
 */

export interface ParsedMention {
  userId: string;
  username: string;
  fullName: string;
  startIndex: number;
  endIndex: number;
}

export interface MentionUser {
  id: string;
  fullName: string;
  username?: string;
}

/**
 * Regex to match @mentions
 * Matches @username or @"Full Name" format
 */
export const MENTION_REGEX = /@(\w+|\[[^\]]+\])/g;

/**
 * Regex to detect if user is currently typing a mention
 * Returns the partial text after @
 */
export const TYPING_MENTION_REGEX = /@(\w*)$/;

/**
 * Check if the user is currently typing a mention
 * Returns the search query if they are, null otherwise
 */
export const getTypingMention = (text: string, cursorPosition: number): string | null => {
  // Get text up to cursor
  const textBeforeCursor = text.slice(0, cursorPosition);
  
  // Check if there's an @ being typed
  const match = textBeforeCursor.match(TYPING_MENTION_REGEX);
  
  if (match) {
    return match[1]; // Return the partial username being typed
  }
  
  return null;
};

/**
 * Insert a mention into text at the current cursor position
 * Replaces the @partial with @[Full Name](userId)
 */
export const insertMention = (
  text: string,
  cursorPosition: number,
  user: MentionUser
): { newText: string; newCursorPosition: number } => {
  const textBeforeCursor = text.slice(0, cursorPosition);
  const textAfterCursor = text.slice(cursorPosition);
  
  // Find the @ symbol position
  const atIndex = textBeforeCursor.lastIndexOf('@');
  
  if (atIndex === -1) {
    return { newText: text, newCursorPosition: cursorPosition };
  }
  
  // Create the mention text - using format @[Full Name](userId)
  const mentionText = `@[${user.fullName}](${user.id}) `;
  
  // Build new text
  const newText = textBeforeCursor.slice(0, atIndex) + mentionText + textAfterCursor;
  const newCursorPosition = atIndex + mentionText.length;
  
  return { newText, newCursorPosition };
};

/**
 * Extract all user IDs that were mentioned in text
 * Looks for pattern @[Full Name](userId)
 */
export const extractMentionedUserIds = (text: string): string[] => {
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const userIds: string[] = [];
  let match;
  
  while ((match = mentionPattern.exec(text)) !== null) {
    userIds.push(match[2]); // match[2] is the userId
  }
  
  return [...new Set(userIds)]; // Remove duplicates
};

/**
 * Convert mention markup to display text
 * @[Full Name](userId) -> @Full Name
 */
export const mentionToDisplayText = (text: string): string => {
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
};

/**
 * Parse text and return segments for rendering
 * Each segment is either plain text or a mention
 */
export interface TextSegment {
  type: 'text' | 'mention';
  content: string;
  userId?: string;
}

export const parseTextWithMentions = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    // Add text before this mention
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add the mention
    segments.push({
      type: 'mention',
      content: `@${match[1]}`, // @Full Name
      userId: match[2],
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
