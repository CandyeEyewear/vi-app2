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
} from 'react-native';
import { Heart, MessageCircle, Share2, Trash2, Megaphone, Pin, Flag } from 'lucide-react-native';
import { Post } from '../../types';
import { Colors } from '../../constants/colors';
import { useFeed } from '../../contexts/FeedContext';
import { useAuth } from '../../contexts/AuthContext';
import ProfileActionSheet from '../ProfileActionSheet';
import { supabase } from '../../services/supabase';
import CustomAlert from '../CustomAlert';
import ReactionBar from '../ReactionBar';
import ReactionPicker from '../ReactionPicker';
import ShareModal from '../ShareModal';
import ShareCommentModal from '../ShareCommentModal';
import SharedPostCard from '../SharedPostCard';
import ImageCollage from '../ImageCollage';
import VideoPlayer from '../VideoPlayer';
import LinkText from '../LinkText';

const { width } = Dimensions.get('window');

interface FeedPostCardProps {
  post: Post;
}

export default function FeedPostCard({ post }: FeedPostCardProps) {
  const { user, isAdmin } = useAuth();
  const { likePost, unlikePost, addComment, sharePost, shareToFeed, deletePost, addReaction } = useFeed();
  
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
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showShareCommentModal, setShowShareCommentModal] = useState(false);
  const [postToShare, setPostToShare] = useState<Post | null>(null);

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
          {post.user.avatarUrl ? (
            <Image source={{ uri: post.user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {post.user.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerInfo}
          onPress={() => handleUserTap(post.user.id, post.user.fullName)}
          activeOpacity={0.7}
        >
          <Text style={styles.userName}>{post.user.fullName}</Text>
          <Text style={styles.timestamp}>{formatTimeAgo(post.createdAt)}</Text>
        </TouchableOpacity>
        {isPinned && (
          <View style={styles.pinIcon}>
            <Pin size={18} color={Colors.light.primary} fill={Colors.light.primary} />
          </View>
        )}
        {/* Report button - for volunteers on other people's posts (not announcements) */}
        {!isAnnouncement && user && post.userId !== user.id && !isAdmin && (
          <TouchableOpacity onPress={() => setShowReportModal(true)} style={styles.reportButton}>
            <Flag size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        )}
        {canDelete && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
            <Trash2 size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Announcement Badge */}
      {isAnnouncement && (
        <View style={styles.announcementBadge}>
          <Megaphone size={16} color={Colors.light.primary} />
          <Text style={styles.announcementBadgeText}>ANNOUNCEMENT</Text>
        </View>
      )}

      {/* Content */}
      <LinkText text={post.text} style={styles.text} />

      {/* NEW: Render Shared Post if this is a share */}
      {post.sharedPost && (
        <SharedPostCard
          originalPost={post.sharedPost}
          onUserTap={handleUserTap}
        />
      )}

      {/* Media - Videos and Images */}
      {!post.sharedPost && post.mediaUrls && post.mediaUrls.length > 0 && (
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

      {/* Stats - Hidden for announcements */}
      {!isAnnouncement && (
        <View style={styles.stats}>
          <Text style={styles.statText}>
            {post.likes.length} {post.likes.length === 1 ? 'like' : 'likes'}
          </Text>
          <Text style={styles.statText}>
            {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}
          </Text>
          <Text style={styles.statText}>
            {post.shares} {post.shares === 1 ? 'share' : 'shares'}
          </Text>
        </View>
      )}

      {/* Actions - Hidden for announcements */}
      {!isAnnouncement && (
        <>
          <View style={styles.actions}>
            {/* OLD LIKE BUTTON - Keep for backward compatibility */}
            <TouchableOpacity
              onPress={handleLike}
              style={[styles.actionButton, isLiked && styles.actionButtonActive]}
            >
              <Heart 
                size={22} 
                color={isLiked ? Colors.light.primary : Colors.light.textSecondary}
                fill={isLiked ? Colors.light.primary : 'transparent'}
              />
              <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>Like</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleComment} style={styles.actionButton}>
              <MessageCircle size={22} color={Colors.light.textSecondary} />
              <Text style={styles.actionText}>Comment</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
              <Share2 size={22} color={Colors.light.textSecondary} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* ✨ REACTION BAR */}
          <View style={styles.reactionBarContainer}>
            <ReactionBar
              reactionSummary={post.reactionSummary || {
                heart: 0,
                thumbsup: 0,
                clap: 0,
                fire: 0,
                star: 0,
                total: 0,
              }}
              onReactionPress={() => setShowReactionPicker(true)}
              onReactionCountPress={() => {
                console.log('Show who reacted to post:', post.id);
              }}
            />
          </View>
        </>
      )}

      {/* Comments ONLY in modal - not in feed */}

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCommentModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setShowCommentModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalCommentsList}>
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
                          <Text style={[
                            styles.modalCommentUser,
                            isOwnComment && styles.modalCommentUserOwn
                          ]}>
                            {comment.user.fullName}
                          </Text>
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

            <View style={styles.modalInput}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor={Colors.light.textSecondary}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                onSubmitEditing={handleSubmitComment}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!commentText.trim() || submitting) && styles.sendButtonDisabled]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || submitting}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

      {/* ✨ REACTION PICKER MODAL */}
      <ReactionPicker
        visible={showReactionPicker}
        onClose={() => setShowReactionPicker(false)}
        onSelectReaction={async (reactionType) => {
          await addReaction(post.id, reactionType);
        }}
        currentReaction={post.reactionSummary?.userReaction}
      />

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
    backgroundColor: Colors.light.background,
    marginBottom: 8,
    paddingBottom: 8,
  },
  announcementCard: {
    backgroundColor: Colors.light.primary + '08',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
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
  reportButton: {
    padding: 4,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
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
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  media: {
    width: width - 2,
    height: 300,
    backgroundColor: Colors.light.card,
  },
  mediaContainer: {
    marginVertical: 8,
  },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  statText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginRight: 16,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  actionButtonActive: {
    backgroundColor: Colors.light.card,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  actionTextActive: {
    color: Colors.light.primary,
  },
  reactionBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
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
    maxHeight: 400,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  modalInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.light.text,
    maxHeight: 80,
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