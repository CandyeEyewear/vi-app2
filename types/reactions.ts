/**
 * Reaction Types for Posts
 */

export type ReactionType = 'heart' | 'thumbsup' | 'clap' | 'fire' | 'star';

export interface PostReaction {
  id: string;
  postId: string;
  userId: string;
  user?: any; // Optional user details (will be typed as User when imported)
  reactionType: ReactionType;
  createdAt: string;
}

export interface ReactionSummary {
  heart: number;
  thumbsup: number;
  clap: number;
  fire: number;
  star: number;
  total: number;
  userReaction?: ReactionType; // Current user's reaction
}
