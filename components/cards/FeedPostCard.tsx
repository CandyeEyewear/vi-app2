/**
 * Feed Post Card Component - WITH REACTIONS
 * Displays a single post with reactions, comment, share actions
 * Special styling for announcements with megaphone badge and blue tint
 * Facebook-style comment bubbles ONLY in modal (not in feed)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ScrollView,
  Dimensions,
  Keyboard,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Heart, MessageCircle, Share2, Trash2, Megaphone, Pin, Flag, MoreVertical, Copy, Edit } from 'lucide-react-native';
import { Post } from '../../types';
import { Colors } from '../../constants/colors';
import { useFeed } from '../../contexts/FeedContext';
import { useAuth } from '../../contexts/AuthContext';
import ProfileActionSheet from '../ProfileActionSheet';
import { supabase } from '../../services/supabase';
import CustomAlert from '../CustomAlert';
import ShareModal from '../ShareModal';
import ShareCommentModal from '../ShareCommentModal';
import SharedPostCard from '../SharedPostCard';
import SharedOpportunityCard from '../SharedOpportunityCard';
import ImageCollage from '../ImageCollage';
import VideoPlayer from '../VideoPlayer';
import LinkText from '../LinkText';
import { AvatarWithBadge, UserNameWithBadge } from '../index';

const { width } = Dimensions.get('window');

interface FeedPostCardProps {
  post: Post;
}

export default function FeedPostCard({ post }: FeedPostCardProps) {
  const { user, isAdmin } = useAuth();
  const { likePost, unlikePost, addComment, sharePost, shareToFeed, deletePost } = useFeed();
  const insets = useSafeAreaInsets();
  
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showProfileActionSheet, setShowProfileActionSheet] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<string>('');
  const [reportDetails, setReportDetails] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
  });
  const [showShareModal, setShowShareModal] = useState(false);
  const [showShareCommentModal, setShowShareCommentModal] = useState(false);
  const [postToShare, setPostToShare] = useState<Post | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isLiked = user ? post.likes.includes(user.id) : false;
  const canDelete = user && (isAdmin || post.userId === user.id);
  const isAnnouncement = post.isAnnouncement || false;
  const isPinned = post.isPinned || false;

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  const handleLike = () => {
    if (isLiked) {
      unlikePost(post.id);
    } else {
      likePost(post.id);
    }
  };

  const handleUserTap = (userId: string, userName: string) => {
    // Don't show action sheet for your own posts
    if (user && userId === user.id) {
      return;
    }
    setSelectedUser({ id: userId, name: userName });
    setShowProfileActionSheet(true);
  };

  const handleCommentUserTap = (userId: string, userName: string) => {
    // Don't show action sheet for yourself
    if (user && userId === user.id) {
      return;
    }
    setSelectedUser({ id: userId, name: userName });
    setShowProfileActionSheet(true);
  };

  const handleComment = () => {
    setShowCommentModal(true);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;

    // Dismiss keyboard immediately so the tap registers
    Keyboard.dismiss();

    setSubmitting(true);
    const response = await addComment(post.id, commentText);
    setSubmitting(false);

    if (response.success) {
      setCommentText('');
      setShowCommentModal(false);
    } else {
      showAlert('Error', response.error || 'Failed to add comment', 'error');
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleShareToFeed = () => {
    // Close main share modal
    setShowShareModal(false);
    // Set post and open comment modal
    setPostToShare(post);
    setShowShareCommentModal(true);
  };

  const handleConfirmShare = async (comment: string) => {
    if (!postToShare) return;
    
    const response = await shareToFeed(postToShare.id, comment);
    if (response.success) {
      showAlert('Success', 'Post shared to your feed!', 'success');
    } else {
      showAlert('Error', response.error || 'Failed to share post', 'error');
    }
    setPostToShare(null);
  };

  const handleShareExternal = async () => {
    try {
      const postUrl = `https://volunteersinc.org/post?id=${post.id}`;
      const shareMessage = `Check out this post from ${post.user.fullName} on VIbe:\n\n${post.text}\n\n${postUrl}`;
      
      await Share.share({
        message: shareMessage,
        url: postUrl,
        title: 'Share from VIbe',
      });

      // Increment share count
      sharePost(post.id);
    } catch (error: any) {
      console.error('Error sharing externally:', error);
      if (error.message !== 'User did not share') {
        showAlert('Error', 'Failed to share post', 'error');
      }
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const response = await deletePost(post.id);
    setShowDeleteConfirm(false);
    if (!response.success) {
      showAlert('Error', response.error || 'Failed to delete post', 'error');
    }
  };

  const handleReport = async () => {
    if (!reportReason) {
      showAlert('Error', 'Please select a reason for reporting', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('post_reports')
        .insert({
          post_id: post.id,
          reporter_id: user?.id,
          reason: reportReason,
          details: reportDetails.trim() || null,
          status: 'pending',
        });

      if (error) throw error;

      showAlert('Success', 'Post reported. Our moderators will review it shortly.', 'success');
      setShowReportModal(false);
      setReportReason('');
      setReportDetails('');
    } catch (error: any) {
      console.error('Error reporting post:', error);
      showAlert('Error', 'Failed to report post', 'error');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={[
      styles.card,
      isAnnouncement && styles.announcementCard
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={() => handleUserTap(post.user.id, post.user.fullName)}
          activeOpacity={0.7}
        >
          <AvatarWithBadge
            uri={post.user.avatarUrl || null}
            name={post.user.fullName}
            size={40}
            role={post.user.role || 'volunteer'}
            membershipTier={post.user.membershipTier || 'free'}
            membershipStatus={post.user.membershipStatus || 'inactive'}
          />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerInfo}
          onPress={() => handleUserTap(post.user.id, post.user.fullName)}
          activeOpacity={0.7}
        >
          <UserNameWithBadge
            name={post.user.fullName}
            role={post.user.role || 'volunteer'}
            membershipTier={post.user.membershipTier || 'free'}
            membershipStatus={post.user.membershipStatus || 'inactive'}
            style={styles.userName}
          />
          <Text style={styles.timestamp}>{formatTimeAgo(post.createdAt)}</Text>
        </TouchableOpacity>
        {isPinned && (
          <View style={styles.pinIcon}>
            <Pin size={18} color={Colors.light.primary} fill={Colors.light.primary} />
          </View>
        )}
        {/* More Options Menu */}
        <TouchableOpacity onPress={() => setShowMoreMenu(true)} style={styles.moreButton}>
          <MoreVertical size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
      </View>

      {/* Announcement Badge */}
      {isAnnouncement && (
        <View style={styles.announcementBadge}>
          <Megaphone size={16} color={Colors.light.primary} />
          <Text style={styles.announcementBadgeText}>ANNOUNCEMENT</Text>
        </View>
      )}

      {/* Content - Text Only (username already in header) */}
      <LinkText text={post.text} style={styles.text} />

      {/* NEW: Render Shared Post if this is a share */}
      {post.sharedPost && (
        <SharedPostCard
          originalPost={post.sharedPost}
          onUserTap={handleUserTap}
        />
      )}

      {/* NEW: Render Shared Opportunity if this post references an opportunity */}
      {post.opportunity && !post.sharedPost && (
        <SharedOpportunityCard opportunity={post.opportunity} />
      )}

      {/* Media - Videos and Images */}
      {!post.sharedPost && !post.opportunity && post.mediaUrls && post.mediaUrls.length > 0 && (
        <View style={styles.mediaContainer}>
          {post.mediaUrls.map((url, index) => {
            const mediaType = post.mediaTypes?.[index] || 'image';
            
            // Render video
            if (mediaType === 'video') {
              return (
                <VideoPlayer
                  key={`video-${index}`}
                  uri={url}
                  style={{ marginBottom: 8 }}
                />
              );
            }
            return null;
          })}
          
          {/* Render images with ImageCollage */}
          {(() => {
            const imageUrls = post.mediaUrls.filter((_, i) => 
              (post.mediaTypes?.[i] || 'image') === 'image'
            );
            return imageUrls.length > 0 ? <ImageCollage images={imageUrls} /> : null;
          })()}
        </View>
      )}

      {/* Action Icons Row - With Counts */}
      {!isAnnouncement && (
        <View style={styles.actionIconsRow}>
          <View style={styles.actionIconsLeft}>
            <TouchableOpacity onPress={handleLike} style={styles.actionIconWithCount}>
              <Heart 
                size={24} 
                color={isLiked ? Colors.light.primary : Colors.light.textSecondary}
                fill={isLiked ? Colors.light.primary : 'none'}
              />
              {post.likes.length > 0 && (
                <Text style={[styles.actionCount, isLiked && { color: Colors.light.primary }]}>
                  {post.likes.length.toLocaleString()}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleComment} style={styles.actionIconWithCount}>
              <MessageCircle size={24} color={Colors.light.textSecondary} />
              {post.comments.length > 0 && (
                <Text style={styles.actionCount}>
                  {post.comments.length.toLocaleString()}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.actionIconWithCount}>
              <Share2 size={24} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Comments Section - Instagram Style (Show last comment with "more" option) */}
      {!isAnnouncement && post.comments.length > 0 && (
        <View style={styles.commentsContainer}>
          {/* Show "View all X comments" if more than 1 comment */}
          {post.comments.length > 1 && (
            <TouchableOpacity
              onPress={handleComment}
              style={styles.viewAllComments}
            >
              <Text style={[styles.viewAllCommentsText, { color: Colors.light.primary, fontWeight: '500' }]}>
                View all {post.comments.length} comments
              </Text>
            </TouchableOpacity>
          )}
          
          {/* Show last comment with "more" option if long */}
          {(() => {
            const lastComment = post.comments[post.comments.length - 1];
            const commentId = lastComment.id;
            const isExpanded = expandedComments[commentId] || false;
            const MAX_COMMENT_LENGTH = 100;
            const isLongComment = lastComment.text.length > MAX_COMMENT_LENGTH;
            const displayText = isExpanded || !isLongComment 
              ? lastComment.text 
              : lastComment.text.substring(0, MAX_COMMENT_LENGTH) + '...';
            
            return (
              <View key={lastComment.id} style={styles.commentItem}>
                <View style={styles.commentContent}>
                  <TouchableOpacity
                    onPress={() => handleCommentUserTap(lastComment.user.id, lastComment.user.fullName)}
                    activeOpacity={0.7}
                    style={styles.commentUsernameContainer}
                  >
                    <UserNameWithBadge
                      name={lastComment.user.fullName}
                      role={lastComment.user.role || 'volunteer'}
                      membershipTier={lastComment.user.membershipTier || 'free'}
                      style={styles.commentUsername}
                      badgeSize={14}
                    />
                  </TouchableOpacity>
                  <View style={styles.commentTextContainer}>
                    <Text style={styles.commentText}>{displayText}</Text>
                    {isLongComment && !isExpanded && (
                      <TouchableOpacity
                        onPress={() => setExpandedComments(prev => ({ ...prev, [commentId]: true }))}
                        style={styles.moreButton}
                      >
                        <Text style={styles.moreText}>more</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })()}
        </View>
      )}


      {/* Comments Modal - For full comment view */}

      {/* Comment Modal - Facebook-style with proper keyboard handling */}
      <Modal
        visible={showCommentModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowCommentModal(false);
        }}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top']}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                {/* Header - Fixed at top */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Comments</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowCommentModal(false);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.modalClose}>×</Text>
                  </TouchableOpacity>
                </View>

                {/* Scrollable Comments List */}
                <ScrollView 
                  style={styles.modalCommentsList}
                  contentContainerStyle={styles.modalCommentsListContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  showsVerticalScrollIndicator={true}
                >
                  {post.comments.map((comment) => {
                    const isOwnComment = user && comment.userId === user.id;
                    return (
                      <View 
                        key={comment.id}
                        style={[
                          styles.modalCommentBubbleContainer,
                          isOwnComment && styles.modalCommentBubbleContainerOwn
                        ]}
                      >
                        <TouchableOpacity
                          onPress={() => {
                            setShowCommentModal(false);
                            handleCommentUserTap(comment.user.id, comment.user.fullName);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={[
                            styles.modalCommentBubble,
                            isOwnComment && styles.modalCommentBubbleOwn
                          ]}>
                            <View style={styles.modalCommentHeader}>
                              <UserNameWithBadge
                                name={comment.user.fullName}
                                role={comment.user.role || 'volunteer'}
                                membershipTier={comment.user.membershipTier || 'free'}
                                style={[
                                styles.modalCommentUser,
                                isOwnComment && styles.modalCommentUserOwn
                                ]}
                                badgeSize={14}
                              />
                              <Text style={[
                                styles.modalCommentTime,
                                isOwnComment && styles.modalCommentTimeOwn
                              ]}>
                                {formatTimeAgo(comment.createdAt)}
                              </Text>
                            </View>
                            <LinkText
                              text={comment.text}
                              style={[
                                styles.modalCommentText,
                                isOwnComment && styles.modalCommentTextOwn
                              ]}
                            />
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Input Container - Fixed at bottom, above keyboard and nav bar */}
                <SafeAreaView edges={['bottom']} style={styles.modalInputSafeArea}>
                  <View style={[
                    styles.modalInput,
                    {
                      paddingBottom: Math.max(insets.bottom, 8),
                      paddingTop: 8,
                    }
                  ]}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Write a comment..."
                      placeholderTextColor={Colors.light.textSecondary}
                      value={commentText}
                      onChangeText={setCommentText}
                      multiline
                      maxLength={500}
                      textAlignVertical="center"
                      onSubmitEditing={handleSubmitComment}
                      returnKeyType="default"
                      blurOnSubmit={false}
                    />
                    <TouchableOpacity
                      style={[styles.sendButton, (!commentText.trim() || submitting) && styles.sendButtonDisabled]}
                      onPress={handleSubmitComment}
                      disabled={!commentText.trim() || submitting}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.sendButtonText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </SafeAreaView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Post</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.reportModalBody}>
              <Text style={styles.reportLabel}>Why are you reporting this post?</Text>
              
              {['spam', 'inappropriate', 'harassment', 'misinformation', 'offensive', 'other'].map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reportReasonButton,
                    reportReason === reason && styles.reportReasonButtonActive
                  ]}
                  onPress={() => setReportReason(reason)}
                >
                  <View style={[
                    styles.reportRadio,
                    reportReason === reason && styles.reportRadioActive
                  ]}>
                    {reportReason === reason && <View style={styles.reportRadioInner} />}
                  </View>
                  <Text style={[
                    styles.reportReasonText,
                    reportReason === reason && styles.reportReasonTextActive
                  ]}>
                    {reason.charAt(0).toUpperCase() + reason.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.reportLabel, { marginTop: 16 }]}>
                Additional details (optional)
              </Text>
              <TextInput
                style={styles.reportDetailsInput}
                placeholder="Provide more context..."
                placeholderTextColor={Colors.light.textSecondary}
                value={reportDetails}
                onChangeText={setReportDetails}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[
                  styles.reportSubmitButton,
                  !reportReason && styles.reportSubmitButtonDisabled
                ]}
                onPress={handleReport}
                disabled={!reportReason}
              >
                <Flag size={20} color="#FFFFFF" />
                <Text style={styles.reportSubmitText}>Submit Report</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>


      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShareToFeed={handleShareToFeed}
        onShareExternal={handleShareExternal}
        postAuthorName={post.user.fullName}
      />

      {/* Share Comment Modal */}
      {postToShare && (
        <ShareCommentModal
          visible={showShareCommentModal}
          onClose={() => {
            setShowShareCommentModal(false);
            setPostToShare(null);
          }}
          onShare={handleConfirmShare}
          originalPost={postToShare}
        />
      )}

      {/* Delete Confirmation */}
      <CustomAlert
        visible={showDeleteConfirm}
        title="Delete Post"
        message="Are you sure? This cannot be undone."
        type="error"
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        showCancel
      />

      {/* More Options Menu Modal */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <TouchableOpacity
          style={styles.moreMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowMoreMenu(false)}
        >
          <View style={styles.moreMenuContent}>
            {canDelete && (
              <TouchableOpacity
                style={styles.moreMenuItem}
                onPress={() => {
                  setShowMoreMenu(false);
                  handleDelete();
                }}
              >
                <Trash2 size={20} color={Colors.light.error} />
                <Text style={[styles.moreMenuText, { color: Colors.light.error }]}>Delete</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity
                style={styles.moreMenuItem}
                onPress={() => {
                  setShowMoreMenu(false);
                  // TODO: Implement edit functionality
                }}
              >
                <Edit size={20} color={Colors.light.text} />
                <Text style={styles.moreMenuText}>Edit</Text>
              </TouchableOpacity>
            )}
            {!isAnnouncement && user && post.userId !== user.id && !isAdmin && (
              <TouchableOpacity
                style={styles.moreMenuItem}
                onPress={() => {
                  setShowMoreMenu(false);
                  setShowReportModal(true);
                }}
              >
                <Flag size={20} color={Colors.light.text} />
                <Text style={styles.moreMenuText}>Report</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.moreMenuItem}
              onPress={async () => {
                setShowMoreMenu(false);
                try {
                  const postUrl = `https://volunteersinc.org/post?id=${post.id}`;
                  await Share.share({
                    message: postUrl,
                    url: postUrl,
                  });
                } catch (error) {
                  // User cancelled or error
                }
              }}
            >
              <Copy size={20} color={Colors.light.text} />
              <Text style={styles.moreMenuText}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.moreMenuItem, styles.moreMenuCancel]}
              onPress={() => setShowMoreMenu(false)}
            >
              <Text style={[styles.moreMenuText, { fontWeight: '600' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* General Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />

      {/* Profile Action Sheet */}
      {selectedUser && (
        <ProfileActionSheet
          visible={showProfileActionSheet}
          onClose={() => {
            setShowProfileActionSheet(false);
            setSelectedUser(null);
          }}
          userId={selectedUser.id}
          userName={selectedUser.name}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  announcementCard: {
    backgroundColor: Colors.light.primary + '08',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  pinIcon: {
    marginRight: 8,
  },
  moreButton: {
    padding: 4,
  },
  moreMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  moreMenuContent: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  moreMenuCancel: {
    borderBottomWidth: 0,
    justifyContent: 'center',
    marginTop: 8,
  },
  moreMenuText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  announcementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.light.primary + '15',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  announcementBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.light.primary,
    letterSpacing: 0.5,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.light.text,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  media: {
    width: width - 2,
    height: 300,
    backgroundColor: Colors.light.card,
  },
  mediaContainer: {
    marginVertical: 8,
  },
  actionIconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionIconsLeft: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  actionIconWithCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
  },
  actionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  commentTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  moreButton: {
    marginLeft: 4,
  },
  moreText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  commentsContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  commentItem: {
    marginBottom: 8,
  },
  commentContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  commentUsernameContainer: {
    marginRight: 6,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    alignItems: 'baseline',
  },
  commentText: {
    fontSize: 14,
    color: Colors.light.text,
    flexShrink: 1,
  },
  viewAllComments: {
    marginTop: 4,
  },
  viewAllCommentsText: {
    fontSize: 14,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalKeyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    flex: 1,
    justifyContent: 'space-between',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  modalClose: {
    fontSize: 24,
    color: Colors.light.textSecondary,
  },
  modalCommentsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  modalCommentsListContent: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  modalCommentBubbleContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  modalCommentBubbleContainerOwn: {
    alignItems: 'flex-end',
  },
  modalCommentBubble: {
    backgroundColor: Colors.light.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '75%',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  modalCommentBubbleOwn: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  modalCommentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  modalCommentUser: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  modalCommentUserOwn: {
    color: '#FFFFFF',
  },
  modalCommentTime: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  modalCommentTimeOwn: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  modalCommentText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 18,
  },
  modalCommentTextOwn: {
    color: '#FFFFFF',
  },
  modalInputSafeArea: {
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  modalInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 60,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.text,
    minHeight: 44,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.light.border,
    textAlignVertical: 'center',
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reportModalBody: {
    padding: 16,
  },
  reportLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  reportReasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  reportReasonButtonActive: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primary + '10',
  },
  reportRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reportRadioActive: {
    borderColor: Colors.light.primary,
  },
  reportRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.primary,
  },
  reportReasonText: {
    fontSize: 15,
    color: Colors.light.text,
    flex: 1,
  },
  reportReasonTextActive: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  reportDetailsInput: {
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: Colors.light.text,
    minHeight: 100,
    marginBottom: 20,
  },
  reportSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  reportSubmitButtonDisabled: {
    opacity: 0.5,
  },
  reportSubmitText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});