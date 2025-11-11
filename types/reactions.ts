// Add this to your types.ts file

export type ReactionType = 'heart' | 'thumbsup' | 'clap' | 'fire' | 'star';

export interface PostReaction {
  id: string;
  postId: string;
  userId: string;
  user?: User; // Optional user details
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

// Update your existing Post interface to include reactions:
export interface Post {
  id: string;
  userId: string;
  user: User;
  text: string;
  mediaUrls: string[];
  mediaTypes: ('image' | 'video')[];
  likes: string[]; // Keep for backward compatibility
  comments: Comment[];
  shares: number;
  isHidden?: boolean;
  isAnnouncement?: boolean;
  isPinned?: boolean;
  reactions?: PostReaction[]; // NEW: Array of reactions
  reactionSummary?: ReactionSummary; // NEW: Reaction counts
  createdAt: string;
  updatedAt: string;
}
