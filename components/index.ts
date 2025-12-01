// Export all badge-related components (legacy - for backward compatibility)
export { VerifiedBadge } from './VerifiedBadge';
export { AvatarWithBadge } from './AvatarWithBadge';

// Export new centralized components
export { default as UserAvatar } from './UserAvatar';
export type { UserAvatarProps } from './UserAvatar';
export { default as UserNameWithBadge } from './UserNameWithBadge';
export type { UserNameWithBadgeProps } from './UserNameWithBadge';

// Export messaging components
export { default as OnlineStatusDot } from './OnlineStatusDot';
export { default as TypingIndicator } from './TypingIndicator';
export { default as MessageStatus } from './MessageStatus';

