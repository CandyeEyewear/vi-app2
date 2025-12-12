

import React, { useState } from 'react';
import {
        View,
        Text,
        ScrollView,
        TouchableOpacity,
        StyleSheet,
        Switch,
        Alert,
        Modal,
        TextInput,
        ActivityIndicator,
        Linking,
      } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Lock, Trash2, HelpCircle, FileText, Shield, X, Mail, UserPlus, ChevronRight } from 'lucide-react-native';
import CustomAlert from '../components/CustomAlert';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { useEffect } from 'react';
import { useReminderSettings } from '../hooks/useReminderSettings';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, updateProfile, isAdmin } = useAuth();
  const { settings: reminderSettings, loading: reminderLoading, updateSettings: updateReminderSettings, updating: reminderUpdating } = useReminderSettings();

const insets = useSafeAreaInsets();
  
  const [notificationSettings, setNotificationSettings] = useState({
     circle_requests_enabled: true,
     announcements_enabled: true,
     opportunities_enabled: true,
     messages_enabled: true,
     opportunity_proposals_enabled: true,
     causes_enabled: true,
     events_enabled: true,
   });

   const [loading, setLoading] = useState(true);

// Change Password Modal State
   const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
   const [currentPassword, setCurrentPassword] = useState('');
   const [newPassword, setNewPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [changingPassword, setChangingPassword] = useState(false);
   
   // Custom Alert State
   const [alertVisible, setAlertVisible] = useState(false);
   const [alertConfig, setAlertConfig] = useState({
     title: '',
     message: '',
     type: 'success' as 'success' | 'error' | 'warning',
   });
   
   const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' = 'success') => {
     setAlertConfig({ title, message, type });
     setAlertVisible(true);
   };

// Delete Account State
   const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
   const [deleteConfirmText, setDeleteConfirmText] = useState('');
   const [deletingAccount, setDeletingAccount] = useState(false);
 
  // Help & Support Modal State
   const [helpModalVisible, setHelpModalVisible] = useState(false);
    
 const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
  
  // Load notification settings from database
   useEffect(() => {
     if (user) {
       loadNotificationSettings();
     }
   }, [user]);

   const loadNotificationSettings = async () => {
     try {
       setLoading(true);
       const { data, error } = await supabase
         .from('user_notification_settings')
         .select('*')
         .eq('user_id', user?.id)
         .single();

       if (error && error.code !== 'PGRST116') {
         console.error('Error loading settings:', error);
         return;
       }

       if (data) {
         setNotificationSettings({
           circle_requests_enabled: data.circle_requests_enabled,
           announcements_enabled: data.announcements_enabled,
           opportunities_enabled: data.opportunities_enabled,
           messages_enabled: data.messages_enabled,
           opportunity_proposals_enabled: data.opportunity_proposals_enabled,
           causes_enabled: data.causes_enabled ?? true,
           events_enabled: data.events_enabled ?? true,
         });
       }
     } catch (error) {
       console.error('Error loading notification settings:', error);
     } finally {
       setLoading(false);
     }
   };

   const updateNotificationSetting = async (field: string, value: boolean) => {
     try {
       const { error } = await supabase
         .from('user_notification_settings')
         .update({ [field]: value })
         .eq('user_id', user?.id);

       if (error) throw error;

       setNotificationSettings(prev => ({
         ...prev,
         [field]: value,
       }));
     } catch (error) {
       console.error('Error updating notification setting:', error);
       Alert.alert('Error', 'Failed to update notification setting');
     }
   };

 
  const handlePrivacyToggle = async () => {
    const newPrivacyValue = !isPrivate;
    setIsPrivate(newPrivacyValue);
    
    const response = await updateProfile({ isPrivate: newPrivacyValue });
    
    if (!response.success) {
      // Revert on error
      setIsPrivate(!newPrivacyValue);
      Alert.alert('Error', response.error || 'Failed to update privacy setting');
    }
  };

  const handleChangePassword = () => {
     setChangePasswordModalVisible(true);
   };

   const submitPasswordChange = async () => {
     // Validation
     if (!currentPassword || !newPassword || !confirmPassword) {
       showAlert('Error', 'Please fill in all password fields', 'error');
       return;
     }

     if (newPassword.length < 6) {
       showAlert('Error', 'New password must be at least 6 characters', 'error');
       return;
     }

     if (newPassword !== confirmPassword) {
       showAlert('Error', 'New passwords do not match', 'error');
       return;
     }

     try {
       setChangingPassword(true);

       // First, verify current password by trying to sign in
       const { error: signInError } = await supabase.auth.signInWithPassword({
         email: user?.email || '',
         password: currentPassword,
       });

       if (signInError) {
         showAlert('Error', 'Current password is incorrect', 'error');
         return;
       }

       // Update password
       const { error: updateError } = await supabase.auth.updateUser({
         password: newPassword,
       });

       if (updateError) throw updateError;

       // Success!
       showAlert('Success', 'Password changed successfully', 'success');
       setChangePasswordModalVisible(false);
       setCurrentPassword('');
       setNewPassword('');
       setConfirmPassword('');
     } catch (error: any) {
       console.error('Error changing password:', error);
       showAlert('Error', error.message || 'Failed to change password', 'error');
     } finally {
       setChangingPassword(false);
     }
   };

  const handlePrivacy = () => {
    Alert.alert('Privacy Settings', 'This feature will be implemented soon');
  };

  

  const handleHelp = () => {
     setHelpModalVisible(true);
   };

   const handleEmailSupport = () => {
     const email = 'info@volunteersinc.org';
     const subject = 'VIbe App Support Request';
     const body = 'Hi Volunteers Incorporated team,\n\nI need help with:\n\n';
     
     Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
   };

  const handleTerms = () => {
     Linking.openURL('https://volunteersinc.org/terms-and-conditions');
   };

  const handlePrivacyPolicy = () => {
     Linking.openURL('https://volunteersinc.org/vibe-privacy-policy');
   };

const handleDeleteAccount = async () => {
     // Validate confirmation text
     if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
       showAlert('Error', 'Please type DELETE to confirm', 'error');
       return;
     }

     try {
       setDeletingAccount(true);

       if (!user?.id) {
         showAlert('Error', 'User not found', 'error');
         return;
       }

       // Get the current session token
       const { data: { session } } = await supabase.auth.getSession();
       if (!session?.access_token) {
         showAlert('Error', 'You must be logged in to delete your account', 'error');
         return;
       }

       // Call the delete account API (handles auth + cascade cleanup server-side)
       const response = await fetch('/api/auth/delete-account', {
         method: 'DELETE',
         headers: {
           'Authorization': `Bearer ${session.access_token}`,
           'Content-Type': 'application/json',
         },
       });

       const result = await response.json().catch(() => null);

       if (!response.ok) {
         throw new Error(result?.error || `Failed to delete account (${response.status})`);
       }

       if (!result?.success) {
         throw new Error(result?.error || 'Failed to delete account');
       }

       // Sign out
       await supabase.auth.signOut();

       showAlert('Account Deleted', 'Your account has been permanently deleted', 'success');

       // Navigate to login after a delay
       setTimeout(() => {
         router.replace('/login');
       }, 2000);
     } catch (error: any) {
       console.error('Error deleting account:', error);
       showAlert('Error', error.message || 'Failed to delete account', 'error');
     } finally {
       setDeletingAccount(false);
     }
   };
  return (
     <View style={styles.container}>
       {/* Header */}
       <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
           <ChevronLeft size={28} color={Colors.light.primary} />
         </TouchableOpacity>
         <Text style={styles.headerTitle}>Settings</Text>
         <View style={{ width: 40 }} />
       </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: (styles.scrollContent.paddingBottom || 32) + insets.bottom + 20 }
        ]}
      >
        {/* Notifications */}
   <View style={styles.section}>
     <Text style={styles.sectionTitle}>Notifications</Text>
     
     <View style={styles.settingRow}>
       <View style={styles.settingInfo}>
         <Text style={styles.settingLabel}>Circle Requests</Text>
         <Text style={styles.settingDescription}>
           Get notified when someone wants to add you to their circle
         </Text>
       </View>
       <Switch
         value={notificationSettings.circle_requests_enabled}
         onValueChange={(value) => updateNotificationSetting('circle_requests_enabled', value)}
         trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
         thumbColor="#FFFFFF"
         disabled={loading}
       />
     </View>

     <View style={styles.settingRow}>
       <View style={styles.settingInfo}>
         <Text style={styles.settingLabel}>Announcements</Text>
         <Text style={styles.settingDescription}>
           Receive notifications about new announcements
         </Text>
       </View>
       <Switch
         value={notificationSettings.announcements_enabled}
         onValueChange={(value) => updateNotificationSetting('announcements_enabled', value)}
         trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
         thumbColor="#FFFFFF"
         disabled={loading}
       />
     </View>

    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>Opportunities</Text>
        <Text style={styles.settingDescription}>
          Get notified about new volunteer opportunities
        </Text>
      </View>
      <Switch
        value={notificationSettings.opportunities_enabled}
        onValueChange={(value) => updateNotificationSetting('opportunities_enabled', value)}
        trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
        thumbColor="#FFFFFF"
        disabled={loading}
      />
    </View>

    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>Fundraising Causes</Text>
        <Text style={styles.settingDescription}>
          Get notified about new fundraising causes
        </Text>
      </View>
      <Switch
        value={notificationSettings.causes_enabled}
        onValueChange={(value) => updateNotificationSetting('causes_enabled', value)}
        trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
        thumbColor="#FFFFFF"
        disabled={loading}
      />
    </View>

    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>Events</Text>
        <Text style={styles.settingDescription}>
          Get notified about new community events
        </Text>
      </View>
      <Switch
        value={notificationSettings.events_enabled}
        onValueChange={(value) => updateNotificationSetting('events_enabled', value)}
        trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
        thumbColor="#FFFFFF"
        disabled={loading}
      />
    </View>

    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>Messages</Text>
        <Text style={styles.settingDescription}>
          Receive notifications for new messages
        </Text>
      </View>
      <Switch
        value={notificationSettings.messages_enabled}
        onValueChange={(value) => updateNotificationSetting('messages_enabled', value)}
        trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
        thumbColor="#FFFFFF"
        disabled={loading}
      />
    </View>

     {isAdmin && (
       <View style={styles.settingRow}>
         <View style={styles.settingInfo}>
           <Text style={styles.settingLabel}>Opportunity Proposals</Text>
           <Text style={styles.settingDescription}>
             Get notified when volunteers submit opportunity proposals
           </Text>
         </View>
         <Switch
           value={notificationSettings.opportunity_proposals_enabled}
           onValueChange={(value) => updateNotificationSetting('opportunity_proposals_enabled', value)}
           trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
           thumbColor="#FFFFFF"
           disabled={loading}
         />
       </View>
     )}
   </View>

        {/* Reminder Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reminder Preferences</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Event & Opportunity Reminders</Text>
              <Text style={styles.settingDescription}>
                Receive automatic reminders before events and opportunities you've signed up for
              </Text>
            </View>
            <Switch
              value={reminderSettings?.remindersEnabled ?? true}
              onValueChange={async (value) => {
                const result = await updateReminderSettings({ remindersEnabled: value });
                if (result.success) {
                  showAlert('Success', 'Reminder preferences saved', 'success');
                } else {
                  showAlert('Error', result.error || 'Failed to update preferences', 'error');
                }
              }}
              trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
              thumbColor="#FFFFFF"
              disabled={reminderLoading || reminderUpdating}
            />
          </View>

          {reminderSettings?.remindersEnabled !== false && (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, !reminderSettings?.remindersEnabled && { opacity: 0.5 }]}>
                    1 day before
                  </Text>
                  <Text style={[styles.settingDescription, !reminderSettings?.remindersEnabled && { opacity: 0.5 }]}>
                    Get a reminder the day before at 9:00 AM
                  </Text>
                </View>
                <Switch
                  value={reminderSettings?.remindDayBefore ?? true}
                  onValueChange={async (value) => {
                    const result = await updateReminderSettings({ remindDayBefore: value });
                    if (result.success) {
                      showAlert('Success', 'Reminder preferences saved', 'success');
                    } else {
                      showAlert('Error', result.error || 'Failed to update preferences', 'error');
                    }
                  }}
                  trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
                  thumbColor="#FFFFFF"
                  disabled={reminderLoading || reminderUpdating || !reminderSettings?.remindersEnabled}
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, !reminderSettings?.remindersEnabled && { opacity: 0.5 }]}>
                    Day of event
                  </Text>
                  <Text style={[styles.settingDescription, !reminderSettings?.remindersEnabled && { opacity: 0.5 }]}>
                    Get a reminder on the day of at 8:00 AM
                  </Text>
                </View>
                <Switch
                  value={reminderSettings?.remindDayOf ?? true}
                  onValueChange={async (value) => {
                    const result = await updateReminderSettings({ remindDayOf: value });
                    if (result.success) {
                      showAlert('Success', 'Reminder preferences saved', 'success');
                    } else {
                      showAlert('Error', result.error || 'Failed to update preferences', 'error');
                    }
                  }}
                  trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
                  thumbColor="#FFFFFF"
                  disabled={reminderLoading || reminderUpdating || !reminderSettings?.remindersEnabled}
                />
              </View>

              <View style={[styles.settingRow, { paddingVertical: 16 }]}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, !reminderSettings?.remindersEnabled && { opacity: 0.5 }]}>
                    Hours before
                  </Text>
                  <Text style={[styles.settingDescription, !reminderSettings?.remindersEnabled && { opacity: 0.5 }]}>
                    Get an additional reminder X hours before the start time
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    onPress={async () => {
                      const hoursOptions = [null, 1, 2, 3, 6, 12];
                      const currentIndex = hoursOptions.findIndex(h => h === reminderSettings?.remindHoursBefore);
                      const nextIndex = (currentIndex + 1) % hoursOptions.length;
                      const result = await updateReminderSettings({ remindHoursBefore: hoursOptions[nextIndex] });
                      if (result.success) {
                        showAlert('Success', 'Reminder preferences saved', 'success');
                      } else {
                        showAlert('Error', result.error || 'Failed to update preferences', 'error');
                      }
                    }}
                    disabled={reminderLoading || reminderUpdating || !reminderSettings?.remindersEnabled}
                    style={[
                      {
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: Colors.light.border,
                        backgroundColor: Colors.light.card,
                        minWidth: 100,
                        alignItems: 'center',
                      },
                      (!reminderSettings?.remindersEnabled || reminderLoading || reminderUpdating) && { opacity: 0.5 }
                    ]}
                  >
                    <Text style={{ color: Colors.light.text, fontSize: 14, fontWeight: '600' }}>
                      {reminderSettings?.remindHoursBefore 
                        ? `${reminderSettings.remindHoursBefore} hour${reminderSettings.remindHoursBefore !== 1 ? 's' : ''}`
                        : 'None'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Account */}
   <View style={styles.section}>
     <Text style={styles.sectionTitle}>Account</Text>
     
     <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
       <Lock size={20} color={Colors.light.text} />
       <Text style={styles.menuItemText}>Change Password</Text>
       <ChevronLeft size={20} color={Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
     </TouchableOpacity>

     <TouchableOpacity 
       style={styles.menuItem} 
       onPress={() => router.push('/invite-friends')}
     >
       <UserPlus size={24} color="#2196F3" />
       <View style={styles.menuItemContent}>
         <Text style={styles.menuItemTitle}>Invite Friends</Text>
         <Text style={styles.menuItemSubtitle}>Share your invite link</Text>
       </View>
       <ChevronRight size={20} color="#9E9E9E" />
     </TouchableOpacity>

     <View style={styles.settingRow}>
     <View style={styles.settingInfo}>
       <Text style={styles.settingLabel}>Private Profile</Text>
       <Text style={styles.settingDescription}>
         Hide your stats and professional info
       </Text>
     </View>
     <Switch
       value={isPrivate}
       onValueChange={handlePrivacyToggle}
       trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
       thumbColor="#FFFFFF"
     />
   </View>

     <TouchableOpacity 
       style={[styles.menuItem, styles.deleteButton]} 
       onPress={() => setDeleteAccountModalVisible(true)}
     >
       <Trash2 size={20} color={Colors.light.error} />
       <Text style={[styles.menuItemText, { color: Colors.light.error }]}>
         Delete Account
       </Text>
       <ChevronLeft size={20} color={Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
     </TouchableOpacity>
   </View>

  
        {/* About */}
<View style={styles.section}>
  <Text style={styles.sectionTitle}>About</Text>
  
  <TouchableOpacity style={styles.menuItem} onPress={handleHelp}>
    <Text style={styles.menuItemText}>Help & Support</Text>
    <ChevronLeft size={20} color={Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
  </TouchableOpacity>

  <TouchableOpacity style={styles.menuItem} onPress={handleTerms}>
    <Text style={styles.menuItemText}>Terms of Service</Text>
    <ChevronLeft size={20} color={Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
  </TouchableOpacity>

  <TouchableOpacity style={styles.menuItem} onPress={handlePrivacyPolicy}>
    <Text style={styles.menuItemText}>Privacy Policy</Text>
    <ChevronLeft size={20} color={Colors.light.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
  </TouchableOpacity>
</View>

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>VIbe v1.0.0</Text>
          <Text style={styles.footerSubtext}>
            Changing Communities Through Volunteerism
          </Text>
        </View>
       </ScrollView>

       {/* Change Password Modal */}
       <Modal
         visible={changePasswordModalVisible}
         transparent
         animationType="slide"
         onRequestClose={() => setChangePasswordModalVisible(false)}
       >
         <View style={styles.modalOverlay}>
           <View style={[styles.modalContent, { backgroundColor: Colors.light.background }]}>
             {/* Header */}
             <View style={styles.modalHeader}>
               <Lock size={24} color={Colors.light.primary} />
               <Text style={[styles.modalTitle, { color: Colors.light.text }]}>
                 Change Password
               </Text>
               <TouchableOpacity
                 onPress={() => setChangePasswordModalVisible(false)}
                 style={styles.modalCloseButton}
               >
                 <X size={24} color={Colors.light.text} />
               </TouchableOpacity>
             </View>

             {/* Form */}
             <View style={styles.modalForm}>
               <View style={styles.inputGroup}>
                 <Text style={[styles.inputLabel, { color: Colors.light.text }]}>
                   Current Password
                 </Text>
                 <TextInput
                   style={[styles.input, { backgroundColor: Colors.light.card, borderColor: Colors.light.border, color: Colors.light.text }]}
                   value={currentPassword}
                   onChangeText={setCurrentPassword}
                   placeholder="Enter current password"
                   placeholderTextColor={Colors.light.textSecondary}
                   secureTextEntry
                   autoCapitalize="none"
                 />
               </View>

               <View style={styles.inputGroup}>
                 <Text style={[styles.inputLabel, { color: Colors.light.text }]}>
                   New Password
                 </Text>
                 <TextInput
                   style={[styles.input, { backgroundColor: Colors.light.card, borderColor: Colors.light.border, color: Colors.light.text }]}
                   value={newPassword}
                   onChangeText={setNewPassword}
                   placeholder="Enter new password (min 6 characters)"
                   placeholderTextColor={Colors.light.textSecondary}
                   secureTextEntry
                   autoCapitalize="none"
                 />
               </View>

               <View style={styles.inputGroup}>
                 <Text style={[styles.inputLabel, { color: Colors.light.text }]}>
                   Confirm New Password
                 </Text>
                 <TextInput
                   style={[styles.input, { backgroundColor: Colors.light.card, borderColor: Colors.light.border, color: Colors.light.text }]}
                   value={confirmPassword}
                   onChangeText={setConfirmPassword}
                   placeholder="Confirm new password"
                   placeholderTextColor={Colors.light.textSecondary}
                   secureTextEntry
                   autoCapitalize="none"
                 />
               </View>

               {/* Buttons */}
               <View style={styles.modalButtons}>
                 <TouchableOpacity
                   style={[styles.modalButton, styles.modalButtonSecondary, { borderColor: Colors.light.border }]}
                   onPress={() => setChangePasswordModalVisible(false)}
                   disabled={changingPassword}
                 >
                   <Text style={[styles.modalButtonText, { color: Colors.light.text }]}>
                     Cancel
                   </Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                   style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: Colors.light.primary }]}
                   onPress={submitPasswordChange}
                   disabled={changingPassword}
                 >
                   {changingPassword ? (
                     <ActivityIndicator color="#FFFFFF" />
                   ) : (
                     <Text style={styles.modalButtonTextPrimary}>
                       Change Password
                     </Text>
                   )}
                 </TouchableOpacity>
               </View>
             </View>
           </View>
         </View>
       </Modal>

{/* Delete Account Modal */}
       <Modal
         visible={deleteAccountModalVisible}
         transparent
         animationType="slide"
         onRequestClose={() => setDeleteAccountModalVisible(false)}
       >
         <View style={styles.modalOverlay}>
           <View style={[styles.modalContent, styles.deleteModalContent, { backgroundColor: Colors.light.background }]}>
             {/* Header */}
             <View style={styles.modalHeader}>
               <Trash2 size={24} color={Colors.light.error} />
               <Text style={[styles.modalTitle, { color: Colors.light.error }]}>
                 Delete Account
               </Text>
               <TouchableOpacity
                 onPress={() => setDeleteAccountModalVisible(false)}
                 style={styles.modalCloseButton}
               >
                 <X size={24} color={Colors.light.text} />
               </TouchableOpacity>
             </View>

             {/* Warning */}
             <View style={[styles.warningBox, { backgroundColor: Colors.light.error + '15', borderColor: Colors.light.error }]}>
               <Text style={[styles.warningTitle, { color: Colors.light.error }]}>
                 ⚠️ This action is permanent and cannot be undone!
               </Text>
               <Text style={[styles.warningText, { color: Colors.light.text }]}>
                 Deleting your account will:
               </Text>
               <Text style={[styles.warningBullet, { color: Colors.light.text }]}>
                 • Permanently delete all your posts and comments
               </Text>
               <Text style={[styles.warningBullet, { color: Colors.light.text }]}>
                 • Remove you from all opportunities
               </Text>
               <Text style={[styles.warningBullet, { color: Colors.light.text }]}>
                 • Delete all your messages and conversations
               </Text>
               <Text style={[styles.warningBullet, { color: Colors.light.text }]}>
                 • Erase your volunteer history and achievements
               </Text>
             </View>

             {/* Confirmation Input */}
             <View style={styles.modalForm}>
               <View style={styles.inputGroup}>
                 <Text style={[styles.inputLabel, { color: Colors.light.text }]}>
                   Type <Text style={{ fontWeight: 'bold' }}>DELETE</Text> to confirm
                 </Text>
                 <TextInput
                   style={[styles.input, { backgroundColor: Colors.light.card, borderColor: Colors.light.border, color: Colors.light.text }]}
                   value={deleteConfirmText}
                   onChangeText={setDeleteConfirmText}
                   placeholder="Type DELETE in capital letters"
                   placeholderTextColor={Colors.light.textSecondary}
                   autoCapitalize="characters"
                 />
               </View>

               {/* Buttons */}
               <View style={styles.modalButtons}>
                 <TouchableOpacity
                   style={[styles.modalButton, styles.modalButtonSecondary, { borderColor: Colors.light.border }]}
                   onPress={() => {
                     setDeleteAccountModalVisible(false);
                     setDeleteConfirmText('');
                   }}
                   disabled={deletingAccount}
                 >
                   <Text style={[styles.modalButtonText, { color: Colors.light.text }]}>
                     Cancel
                   </Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                   style={[styles.modalButton, styles.modalButtonDanger, { backgroundColor: Colors.light.error }]}
                   onPress={handleDeleteAccount}
                   disabled={deletingAccount}
                 >
                   {deletingAccount ? (
                     <ActivityIndicator color="#FFFFFF" />
                   ) : (
                     <Text style={styles.modalButtonTextPrimary}>
                       Delete Forever
                     </Text>
                   )}
                 </TouchableOpacity>
               </View>
             </View>
           </View>
         </View>
       </Modal>

{/* Help & Support Modal */}
       <Modal
         visible={helpModalVisible}
         transparent
         animationType="fade"
         onRequestClose={() => setHelpModalVisible(false)}
       >
         <View style={styles.modalOverlay}>
           <View style={[styles.modalContent, { backgroundColor: Colors.light.background }]}>
             {/* Header */}
             <View style={styles.modalHeader}>
               <HelpCircle size={24} color={Colors.light.primary} />
               <Text style={[styles.modalTitle, { color: Colors.light.text }]}>
                 Help & Support
               </Text>
               <TouchableOpacity
                 onPress={() => setHelpModalVisible(false)}
                 style={styles.modalCloseButton}
               >
                 <X size={24} color={Colors.light.textSecondary} />
               </TouchableOpacity>
             </View>

             {/* Support Options */}
             <View style={styles.modalForm}>
               <Text style={[styles.settingDescription, { textAlign: 'center', marginBottom: 16 }]}>
                 Need help? We're here for you! Contact us via email and we'll get back to you as soon as possible.
               </Text>

               {/* Email Support Button */}
               <TouchableOpacity
                 style={[styles.supportButton, { backgroundColor: Colors.light.primary }]}
                 onPress={() => {
                   handleEmailSupport();
                   setHelpModalVisible(false);
                 }}
               >
                 <Mail size={20} color="#FFFFFF" />
                 <View style={styles.supportButtonTextContainer}>
                   <Text style={styles.supportButtonTitle}>Email Support</Text>
                   <Text style={styles.supportButtonSubtitle}>info@volunteersinc.org</Text>
                 </View>
               </TouchableOpacity>
             </View>
           </View>
         </View>
       </Modal>


       {/* Custom Alert */}
       <CustomAlert
         visible={alertVisible}
         title={alertConfig.title}
         message={alertConfig.message}
         type={alertConfig.type}
         onClose={() => setAlertVisible(false)}
       />
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
  backButtonText: {
    fontSize: 32,
    color: Colors.light.primary,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    backgroundColor: Colors.light.background,
    marginTop: 12,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuItemIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  menuItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  menuItemChevron: {
    fontSize: 24,
    color: Colors.light.textSecondary,
    fontWeight: '300',
  },
deleteButton: {
     borderTopWidth: 1,
     borderTopColor: Colors.light.error + '20',
     marginTop: 8,
   },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  footerSubtext: {
      fontSize: 12,
      color: Colors.light.textSecondary,
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 20,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 24,
    },
    modalTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: 'bold',
    },
    modalCloseButton: {
      padding: 4,
    },
    modalForm: {
      gap: 16,
    },
    inputGroup: {
      gap: 8,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    modalButton: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    modalButtonSecondary: {
      borderWidth: 1,
    },
    modalButtonPrimary: {
      // backgroundColor set inline
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonTextPrimary: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
deleteModalContent: {
     maxWidth: 450,
   },
   warningBox: {
     padding: 16,
     borderRadius: 12,
     borderWidth: 1,
     marginBottom: 20,
   },
   warningTitle: {
     fontSize: 16,
     fontWeight: 'bold',
     marginBottom: 12,
   },
   warningText: {
     fontSize: 14,
     marginBottom: 8,
     fontWeight: '600',
   },
   warningBullet: {
     fontSize: 14,
     lineHeight: 22,
     marginLeft: 8,
   },
   modalButtonDanger: {
     // backgroundColor set inline to error color
   },
supportButton: {
     flexDirection: 'row',
     alignItems: 'center',
     padding: 18,
     borderRadius: 12,
     marginTop: 8,
   },
   supportButtonTextContainer: {
     flex: 1,
     marginLeft: 12,
   },
   supportButtonTitle: {
     fontSize: 16,
     fontWeight: '600',
     color: '#FFFFFF',
     marginBottom: 4,
   },
   supportButtonSubtitle: {
     fontSize: 13,
     color: '#FFFFFF',
     opacity: 0.9,
   },
  });