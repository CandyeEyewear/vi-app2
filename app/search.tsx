/**
 * Search Screen
 * Search for users by full name, first name, or last name
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Search as SearchIcon, UserPlus } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SearchUser {
  id: string;
  full_name: string;
  location: string | null;
  avatar_url: string | null;
}

export default function SearchScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<SearchUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<SearchUser[]>([]);

  // Load all users and pending requests on mount
   useEffect(() => {
     loadAllUsers();
     loadPendingRequests();
   }, []);

  // Search when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    } else {
      setSearchResults(allUsers);
    }
  }, [searchQuery, allUsers]);

  const loadAllUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, location, avatar_url')
        .neq('id', user?.id) // Exclude current user
        .order('full_name', { ascending: true });


      if (error) throw error;

      setAllUsers(data || []);
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

const loadPendingRequests = async () => {
  try {
    // First, get the pending circle requests
    const { data: circleData, error: circleError } = await supabase
      .from('user_circles')
      .select('user_id')
      .eq('circle_user_id', user?.id)
      .eq('status', 'pending');

    if (circleError) throw circleError;

    if (!circleData || circleData.length === 0) {
      setPendingRequests([]);
      return;
    }

    // Extract user IDs
    const userIds = circleData.map(item => item.user_id);

    // Then, fetch user details for those IDs
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, location, avatar_url')
      .in('id', userIds);

    if (usersError) throw usersError;

    const requests: SearchUser[] = usersData?.map((user: any) => ({
      id: user.id,
      full_name: user.full_name,
      location: user.location,
      avatar_url: user.avatar_url,
    })) || [];

    setPendingRequests(requests);
  } catch (error) {
    console.error('Error loading pending requests:', error);
  }
};  const performSearch = (query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    
    const filtered = allUsers.filter(user => {
      const fullName = user.full_name.toLowerCase();
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts[nameParts.length - 1] || '';

      // Search by full name, first name, or last name
      return (
        fullName.includes(lowerQuery) ||
        firstName.includes(lowerQuery) ||
        lastName.includes(lowerQuery)
      );
    });



    setSearchResults(filtered);
  };

const handleAcceptRequest = async (requestUserId: string) => {
     try {
       // Step 1: Accept the incoming request (A→B)
       const { error: acceptError } = await supabase
         .from('user_circles')
         .update({ status: 'accepted' })
         .eq('user_id', requestUserId)
         .eq('circle_user_id', user?.id)
         .eq('status', 'pending');

       if (acceptError) throw acceptError;

       // Step 2: Create the reverse relationship (B→A)
       const { error: reverseError } = await supabase
         .from('user_circles')
         .insert({
           user_id: user?.id,
           circle_user_id: requestUserId,
           status: 'accepted',
         });

       if (reverseError) throw reverseError;

       // Reload pending requests to refresh the list
       await loadPendingRequests();
       
       // Show success message
       console.log('Request accepted!');
     } catch (error) {
       console.error('Error accepting request:', error);
     }
   };

   const handleRejectRequest = async (requestUserId: string) => {
     try {
       // Delete the incoming request (A→B)
       const { error: deleteError } = await supabase
         .from('user_circles')
         .delete()
         .eq('user_id', requestUserId)
         .eq('circle_user_id', user?.id);

       if (deleteError) throw deleteError;

       // Also delete any reverse relationship (B→A) if it exists
       await supabase
         .from('user_circles')
         .delete()
         .eq('user_id', user?.id)
         .eq('circle_user_id', requestUserId);

       // Reload pending requests to refresh the list
       await loadPendingRequests();
       
       // Show success message
       console.log('Request rejected!');
     } catch (error) {
       console.error('Error rejecting request:', error);
     }
   };

const renderPendingRequest = ({ item }: { item: SearchUser }) => (
     <View style={[styles.requestCard, { backgroundColor: colors.background, borderColor: colors.primary }]}>
       <View style={styles.requestInfo}>
         {item.avatar_url ? (
           <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
         ) : (
           <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
             <Text style={styles.avatarText}>
               {item.full_name.charAt(0).toUpperCase()}
             </Text>
           </View>
         )}
         <View style={styles.userDetails}>
           <Text style={[styles.userName, { color: colors.text }]}>{item.full_name}</Text>
           {item.location && (
             <Text style={[styles.userLocation, { color: colors.textSecondary }]}>{item.location}</Text>
           )}
           <Text style={[styles.requestLabel, { color: colors.primary }]}>wants to add you to their circle</Text>
         </View>
       </View>
       <View style={styles.requestActions}>
         <TouchableOpacity
           style={[styles.acceptButton, { backgroundColor: colors.primary }]}
           onPress={() => handleAcceptRequest(item.id)}
         >
           <Text style={styles.acceptButtonText}>Accept</Text>
         </TouchableOpacity>
         <TouchableOpacity
           style={[styles.rejectButton, { borderColor: colors.border }]}
           onPress={() => handleRejectRequest(item.id)}
         >
           <Text style={[styles.rejectButtonText, { color: colors.textSecondary }]}>Reject</Text>
         </TouchableOpacity>
       </View>
     </View>
   );

  const renderUser = ({ item }: { item: SearchUser }) => (
    <TouchableOpacity
      style={[styles.userCard, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
      onPress={() => router.push(`/profile/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.userInfo}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {item.full_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.userDetails}>
          <Text style={[styles.userName, { color: colors.text }]}>{item.full_name}</Text>
          {item.location && (
            <Text style={[styles.userLocation, { color: colors.textSecondary }]}>{item.location}</Text>
          )}
        </View>
      </View>
      <UserPlus size={20} color={colors.primary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Find Volunteers</Text>
        <View style={{ width: 40 }} />
      </View>

    {/* Search Input */}
   <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
     <View style={[styles.searchInputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
       <SearchIcon size={20} color={colors.textSecondary} />
       <TextInput
         style={[styles.searchInput, { color: colors.text }]}
         placeholder="Search by name..."
         placeholderTextColor={colors.textSecondary}
         value={searchQuery}
         onChangeText={(text) => {
           console.log('Typing:', text); // Debug log
           setSearchQuery(text);
         }}
         autoFocus
         returnKeyType="search"
       />
     </View>
   </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
       <FlatList
     data={searchResults}
     keyExtractor={(item) => item.id}
     renderItem={renderUser}
     contentContainerStyle={styles.listContent}
     ListHeaderComponent={
       pendingRequests.length > 0 ? (
         <View>
           <Text style={[styles.sectionHeader, { color: colors.text }]}>
             Circle Requests ({pendingRequests.length})
           </Text>
           {pendingRequests.map((request) => (
             <View key={request.id}>
               {renderPendingRequest({ item: request })}
             </View>
           ))}
           <Text style={[styles.sectionHeader, { color: colors.text, marginTop: 16 }]}>
             All Volunteers
           </Text>
         </View>
       ) : null
     }
     ListEmptyComponent={
       <View style={styles.emptyContainer}>
         <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
           {searchQuery ? 'No volunteers found' : 'No volunteers available'}
         </Text>
       </View>
     }
   />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
     paddingHorizontal: 16,
     paddingVertical: 12,
   },
   searchInputContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingHorizontal: 12,
     paddingVertical: 8,
     borderRadius: 8,
     borderWidth: 1,
     gap: 8,
   },
     searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
    borderRadius: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userLocation: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
  },
sectionHeader: {
     fontSize: 18,
     fontWeight: 'bold',
     paddingHorizontal: 4,
     paddingVertical: 12,
   },
   requestCard: {
     backgroundColor: Colors.light.background,
     padding: 16,
     borderRadius: 12,
     marginBottom: 12,
     borderWidth: 2,
   },
   requestInfo: {
     flexDirection: 'row',
     alignItems: 'center',
     marginBottom: 12,
   },
   requestLabel: {
     fontSize: 13,
     fontWeight: '600',
     marginTop: 4,
   },
   requestActions: {
     flexDirection: 'row',
     gap: 12,
   },
   acceptButton: {
     flex: 1,
     paddingVertical: 10,
     borderRadius: 8,
     alignItems: 'center',
   },
   acceptButtonText: {
     fontSize: 15,
     fontWeight: '600',
     color: '#FFFFFF',
   },
   rejectButton: {
     flex: 1,
     paddingVertical: 10,
     borderRadius: 8,
     alignItems: 'center',
     backgroundColor: Colors.light.card,
     borderWidth: 1,
   },
   rejectButtonText: {
     fontSize: 15,
     fontWeight: '600',
   },
});