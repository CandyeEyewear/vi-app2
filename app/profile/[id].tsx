/**
 * View Profile Screen
 * View another user's profile (public or private)
 */

import React, { useState, useEffect } from 'react';
import {
     View,
     Text,
     ScrollView,
     TouchableOpacity,
     StyleSheet,
     Image,
     ActivityIndicator,
     RefreshControl,
     Linking,
   } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft, MessageCircle, Phone, Mail, UserPlus, UserCheck, Calendar } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useFeed } from '../../contexts/FeedContext';
import { useMessaging } from '../../contexts/MessagingContext';
import { User } from '../../types';
import { Colors } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import CustomAlert from '../../components/CustomAlert';
import { useAlert, showErrorAlert } from '../../hooks/useAlert';
import { sendNotificationToUser } from '../../services/pushNotifications';

export default function ViewProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const { refreshFeed } = useFeed();
  const { getOrCreateConversation } = useMessaging();
  const { alertProps, showAlert } = useAlert();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [circleStatus, setCircleStatus] = useState<'none' | 'pending' | 'accepted'>('none');
   const [circleLoading, setCircleLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadProfile();
    }
  }, [id]);

useEffect(() => {
     if (profileUser && !isOwnProfile) {
       checkCircleStatus();
     }
   }, [profileUser, currentUser?.id]);

// Auto-refresh when screen comes back into focus
useFocusEffect(
  React.useCallback(() => {
    if (id && !loading) {
      loadProfile();
    }
  }, [id])
);
  const loadProfile = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const userData: User = {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        phone: data.phone,
        location: data.location,
        country: data.country,
        bio: data.bio,
        areasOfExpertise: data.areas_of_expertise,
        education: data.education,
        avatarUrl: data.avatar_url,
        dateOfBirth: data.date_of_birth,
        role: data.role,
        isPrivate: data.is_private,
        totalHours: data.total_hours,
        activitiesCompleted: data.activities_completed,
        organizationsHelped: data.organizations_helped,
        achievements: [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setProfileUser(userData);
    } catch (error) {
      console.error('Error loading profile:', error);
      showAlert(showErrorAlert('Error', 'Failed to load profile'));
    } finally {
  setLoading(false);
  setRefreshing(false);
}
  };

const checkCircleStatus = async () => {
     if (!currentUser?.id || !id) return;

     try {
       const { data, error } = await supabase
         .from('user_circles')
         .select('status')
         .eq('user_id', currentUser.id)
         .eq('circle_user_id', id)
         .single();

       if (error && error.code !== 'PGRST116') {
         // PGRST116 means no rows found, which is okay
         console.error('Error checking circle status:', error);
       }

       if (data) {
         setCircleStatus(data.status as 'pending' | 'accepted');
       } else {
         setCircleStatus('none');
       }
     } catch (error) {
       console.error('Error checking circle status:', error);
     }
   };  const handleMessage = async () => {
    if (!profileUser) return;
    
    try {
      // Get or create conversation with this user
      const response = await getOrCreateConversation(profileUser.id);
      
      if (response.success && response.data) {
        // Navigate to the conversation
        router.push(`/conversation/${response.data.id}`);
      } else {
        showAlert(showErrorAlert('Error', response.error || 'Failed to start conversation'));
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      showAlert(showErrorAlert('Error', 'Failed to start conversation'));
    }
  };

const handleAddToCircle = async () => {
     if (!currentUser?.id || !profileUser) return;

     try {
       setCircleLoading(true);

       const { error } = await supabase
         .from('user_circles')
         .insert({
           user_id: currentUser.id,
           circle_user_id: profileUser.id,
           status: 'pending',
         });

       if (error) throw error;

       // Create notification for the recipient
       await supabase
         .from('notifications')
         .insert({
           user_id: profileUser.id,
           type: 'circle_request',
           title: 'New Circle Request',
           message: `${currentUser.fullName} wants to add you to their circle`,
           link: `/profile/${currentUser.id}`,
           related_id: currentUser.id,
         });

// Send push notification
try {
  console.log('[PROFILE] 📤 Sending circle request push notification to user:', profileUser.id.substring(0, 8) + '...');
  const pushResult = await sendNotificationToUser(profileUser.id, {
    type: 'circle_request',
    id: currentUser.id,
    title: 'New Circle Request',
    body: `${currentUser.fullName} wants to add you to their circle`,
  });
  if (pushResult) {
    console.log('[PROFILE] ✅ Push notification sent successfully');
  } else {
    console.error('[PROFILE] ❌ Failed to send push notification');
  }
} catch (pushError) {
  console.error('[PROFILE] ❌ Exception sending push notification:', pushError);
}

setCircleStatus('pending');


       setCircleStatus('pending');
       showAlert({
         title: 'Request Sent',
         message: `Circle request sent to ${profileUser.fullName}`,
         type: 'success',
       });
     } catch (error: any) {
       console.error('Error sending circle request:', error);
       showAlert(showErrorAlert('Error', 'Failed to send circle request'));
     } finally {
       setCircleLoading(false);
     }
   };
   const handleRemoveFromCircle = async () => {
     if (!currentUser?.id || !profileUser) return;

     try {
       setCircleLoading(true);

       // Delete the relationship YOU created (You→Them)
       const { error: deleteError1 } = await supabase
         .from('user_circles')
         .delete()
         .eq('user_id', currentUser.id)
         .eq('circle_user_id', profileUser.id);

       if (deleteError1) throw deleteError1;

       // Delete the reverse relationship (Them→You)
       const { error: deleteError2 } = await supabase
         .from('user_circles')
         .delete()
         .eq('user_id', profileUser.id)
         .eq('circle_user_id', currentUser.id);

       if (deleteError2) throw deleteError2;

       setCircleStatus('none');
       await refreshFeed(); // Refresh feed to remove their posts
       
       const message = circleStatus === 'pending' 
         ? 'Circle request cancelled' 
         : `${profileUser.fullName} removed from your circle`;
       
       showAlert({
         title: 'Success',
         message: message,
         type: 'success',
       });
     } catch (error: any) {
       console.error('Error removing from circle:', error);
       showAlert(showErrorAlert('Error', 'Failed to remove from circle'));
     } finally {
       setCircleLoading(false);
     }
   };
  const getAchievements = (user: User) => {
    const achievements = [];
    
    if (user.totalHours >= 10) {
      achievements.push({
        id: '1',
        name: 'Time Keeper',
        description: '10+ hours volunteered',
      });
    }
    
    if (user.activitiesCompleted >= 5) {
      achievements.push({
        id: '2',
        name: 'Community Hero',
        description: '5+ activities completed',
      });
    }
    
    if (user.organizationsHelped >= 3) {
      achievements.push({
        id: '3',
        name: 'Impact Maker',
        description: '3+ organizations helped',
      });
    }

    return achievements;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color={Colors.light.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </View>
    );
  }

  if (!profileUser) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color={Colors.light.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Profile not found</Text>
        </View>
      </View>
    );
  }

  // Check if viewing own profile
  const isOwnProfile = currentUser?.id === profileUser.id;
  
  // If it's a private profile and not the owner
  const isPrivateProfile = profileUser.isPrivate && !isOwnProfile;
  const canSeeContactInfo = currentUser?.role === 'admin' || isOwnProfile;

  const achievements = !isPrivateProfile ? getAchievements(profileUser) : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={Colors.light.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {!isOwnProfile && (
          <TouchableOpacity onPress={handleMessage} style={styles.messageButton}>
            <MessageCircle size={24} color={Colors.light.primary} />
          </TouchableOpacity>
        )}
        {isOwnProfile && <View style={{ width: 40 }} />}
      </View>

      <ScrollView 
  style={styles.scrollContent} 
  contentContainerStyle={styles.scrollContentContainer}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadProfile();
      }}
      tintColor={Colors.light.primary}
    />
  }
>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarSection}>
            {profileUser.avatarUrl ? (
              <Image source={{ uri: profileUser.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {profileUser.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{profileUser.fullName}</Text>
          {profileUser.location && (
            <Text style={styles.location}>{profileUser.location}</Text>
          )}
          {profileUser.dateOfBirth && (
            <View style={styles.ageRow}>
              <Calendar size={16} color={Colors.light.textSecondary} />
              <Text style={[styles.ageText, { color: Colors.light.textSecondary, marginLeft: 8 }]}>
                {(() => {
                  const calculateAge = (dob: string) => {
                    const today = new Date();
                    const birthDate = new Date(dob);
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                      age--;
                    }
                    return age;
                  };
                  return `${calculateAge(profileUser.dateOfBirth)} years old`;
                })()}
              </Text>
            </View>
          )}
          
          {isPrivateProfile && (
            <View style={styles.privateNotice}>
              <Text style={styles.privateNoticeText}>🔒 This profile is private</Text>
            </View>
          )}
        </View>

   {/* Add to Circle Button - Only for other users' profiles */}
   {!isOwnProfile && (
     <View style={styles.circleButtonSection}>
       <TouchableOpacity
         style={[
           styles.circleButton,
           (circleStatus === 'accepted' || circleStatus === 'pending') && styles.circleButtonActive,
         ]}
         onPress={circleStatus !== 'none' ? handleRemoveFromCircle : handleAddToCircle}
         disabled={circleLoading}
       >
         {circleLoading ? (
           <ActivityIndicator size="small" color={Colors.light.primary} />
         ) : (
           <>
             {circleStatus === 'accepted' ? (
               <UserCheck size={20} color={Colors.light.primary} />
             ) : circleStatus === 'pending' ? (
               <UserPlus size={20} color={Colors.light.primary} />
             ) : (
               <UserPlus size={20} color="#FFFFFF" />
             )}
             <Text
               style={[
                 styles.circleButtonText,
                 (circleStatus === 'accepted' || circleStatus === 'pending') && styles.circleButtonTextActive,
               ]}
             >
               {circleStatus === 'accepted' ? 'In Circle' : circleStatus === 'pending' ? 'Request Sent' : 'Add to Circle'}
             </Text>
           </>
         )}
       </TouchableOpacity>
     </View>
   )}

        {/* Private Profile - Limited View */}
        {isPrivateProfile ? (
          <View style={styles.section}>
            <Text style={styles.privateMessage}>
              This user has set their profile to private. Only basic information is visible.
            </Text>
            <TouchableOpacity style={styles.messageButtonLarge} onPress={handleMessage}>
              <MessageCircle size={20} color="#FFFFFF" />
              <Text style={styles.messageButtonText}>Send Message</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Bio */}
            {profileUser.bio && (
              <View style={styles.section}>
                <Text style={styles.bio}>{profileUser.bio}</Text>
              </View>
            )}
{/* Contact Info - Admins and Own Profile Only */}
            {canSeeContactInfo && (profileUser.phone || profileUser.email) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact Info</Text>
                
                {profileUser.phone && (
                  <TouchableOpacity 
                    style={styles.contactRow}
                    onPress={() => Linking.openURL(`tel:${profileUser.phone}`)}
                  >
                    <Phone size={20} color={Colors.light.primary} />
                    <Text style={styles.contactText}>{profileUser.phone}</Text>
                  </TouchableOpacity>
                )}

                {profileUser.email && (
                  <TouchableOpacity 
                    style={styles.contactRow}
                    onPress={() => Linking.openURL(`mailto:${profileUser.email}`)}
                  >
                    <Mail size={20} color={Colors.light.primary} />
                    <Text style={styles.contactText}>{profileUser.email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Impact Statistics</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{profileUser.totalHours}</Text>
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit={true}>Hours</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{profileUser.activitiesCompleted}</Text>
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit={true}>
                    {profileUser.activitiesCompleted === 1 ? 'Activity' : 'Activities'}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{profileUser.organizationsHelped}</Text>
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit={true}>Entity/Org</Text>
                </View>
              </View>
            </View>

            {/* Achievements */}
            {achievements.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Achievements</Text>
                <View style={styles.achievementsGrid}>
                  {achievements.map((achievement) => (
                    <View key={achievement.id} style={styles.achievementCard}>
                      <Text style={styles.achievementName}>{achievement.name}</Text>
                      <Text style={styles.achievementDescription}>
                        {achievement.description}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Professional Info */}
            {(profileUser.education || (profileUser.areasOfExpertise && profileUser.areasOfExpertise.length > 0)) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Professional Info</Text>
                
                {profileUser.education && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Education</Text>
                    <Text style={styles.infoValue}>{profileUser.education}</Text>
                  </View>
                )}
                
                {profileUser.areasOfExpertise && profileUser.areasOfExpertise.length > 0 && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Areas of Expertise</Text>
                    <View style={styles.expertiseContainer}>
                      {profileUser.areasOfExpertise.map((expertise, index) => (
                        <View key={index} style={styles.expertiseChip}>
                          <Text style={styles.expertiseText}>{expertise}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Message Button */}
            {!isOwnProfile && (
              <View style={styles.section}>
                <TouchableOpacity style={styles.messageButtonLarge} onPress={handleMessage}>
                  <MessageCircle size={20} color="#FFFFFF" />
                  <Text style={styles.messageButtonText}>Send Message</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Member Since */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Member since {new Date(profileUser.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>

      {/* Custom Alert */}
      <CustomAlert {...alertProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  messageButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.error,
    textAlign: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 32,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  avatarSection: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.light.primary,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ageText: {
    fontSize: 14,
  },
  privateNotice: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  privateNoticeText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  section: {
    backgroundColor: Colors.light.background,
    padding: 16,
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
  },
  privateMessage: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  bio: {
    fontSize: 16,
    color: Colors.light.text,
    lineHeight: 24,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.light.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    minHeight: 16,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementCard: {
    width: '48%',
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  achievementDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.light.text,
  },
  expertiseContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expertiseChip: {
    backgroundColor: Colors.light.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },

  expertiseText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  messageButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
contactRow: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingVertical: 12,
     paddingHorizontal: 16,
     backgroundColor: Colors.light.card,
     borderRadius: 8,
     marginBottom: 8,
     borderWidth: 1,
     borderColor: Colors.light.border,
     gap: 12,
   },
   contactText: {
     fontSize: 16,
     color: Colors.light.primary,
     fontWeight: '600',
   },
circleButtonSection: {
     paddingHorizontal: 16,
     paddingVertical: 12,
     backgroundColor: Colors.light.background,
     borderBottomWidth: 1,
     borderBottomColor: Colors.light.border,
   },
   circleButton: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     backgroundColor: Colors.light.primary,
     paddingVertical: 14,
     paddingHorizontal: 24,
     borderRadius: 12,
     gap: 8,
   },
   circleButtonActive: {
     backgroundColor: Colors.light.background,
     borderWidth: 2,
     borderColor: Colors.light.primary,
   },
   circleButtonText: {
     fontSize: 16,
     fontWeight: '600',
     color: '#FFFFFF',
   },
   circleButtonTextActive: {
     color: Colors.light.primary,
   },
});