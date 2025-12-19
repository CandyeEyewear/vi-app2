/**
 * Assignment Manager Component
 * Allows admins to assign events/opportunities to sup roles
 * File: components/AssignmentManager.tsx
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { UserPlus, X, User, Trash2 } from 'lucide-react-native';
import { Colors } from '../constants/colors';
import { useColorScheme } from 'react-native';
import {
  assignEventToSup,
  assignOpportunityToSup,
  unassignEventFromSup,
  unassignOpportunityFromSup,
  getEventAssignments,
  getOpportunityAssignments,
  getSupUsers,
  EventAssignment,
  OpportunityAssignment,
} from '../services/assignmentService';

interface AssignmentManagerProps {
  type: 'event' | 'opportunity';
  itemId: string;
  itemTitle: string;
}

export default function AssignmentManager({ type, itemId, itemTitle }: AssignmentManagerProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [modalVisible, setModalVisible] = useState(false);
  const [assignments, setAssignments] = useState<(EventAssignment | OpportunityAssignment)[]>([]);
  const [supUsers, setSupUsers] = useState<Array<{ id: string; fullName: string; email: string; avatarUrl?: string }>>([]);
  const [selectedSupId, setSelectedSupId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  useEffect(() => {
    if (modalVisible) {
      loadAssignments();
      loadSupUsers();
    }
  }, [modalVisible, itemId]);

  const loadAssignments = async () => {
    try {
      setLoadingAssignments(true);
      const response = type === 'event'
        ? await getEventAssignments(itemId)
        : await getOpportunityAssignments(itemId);
      
      if (response.success && response.data) {
        setAssignments(response.data);
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const loadSupUsers = async () => {
    try {
      const response = await getSupUsers();
      if (response.success && response.data) {
        setSupUsers(response.data);
      }
    } catch (error) {
      console.error('Error loading sup users:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedSupId) {
      Alert.alert('Error', 'Please select a supervisor to assign');
      return;
    }

    try {
      setLoading(true);
      const response = type === 'event'
        ? await assignEventToSup({
            eventId: itemId,
            assignedTo: selectedSupId,
            notes: notes.trim() || undefined,
          })
        : await assignOpportunityToSup({
            opportunityId: itemId,
            assignedTo: selectedSupId,
            notes: notes.trim() || undefined,
          });

      if (response.success) {
        Alert.alert('Success', 'Assignment created successfully');
        setSelectedSupId('');
        setNotes('');
        loadAssignments();
      } else {
        Alert.alert('Error', response.error || 'Failed to create assignment');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async (assignmentId: string) => {
    Alert.alert(
      'Confirm Removal',
      'Are you sure you want to remove this assignment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = type === 'event'
                ? await unassignEventFromSup(assignmentId)
                : await unassignOpportunityFromSup(assignmentId);

              if (response.success) {
                Alert.alert('Success', 'Assignment removed successfully');
                loadAssignments();
              } else {
                Alert.alert('Error', response.error || 'Failed to remove assignment');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove assignment');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.assignButton,
          {
            backgroundColor: colors.primarySoft,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        onPress={() => setModalVisible(true)}
      >
        <UserPlus size={16} color={colors.primary} />
        <Text style={[styles.assignButtonText, { color: colors.primary }]}>
          Manage Assignments
        </Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Assign {type === 'event' ? 'Event' : 'Opportunity'}
            </Text>
            <Pressable
              onPress={() => setModalVisible(false)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <X size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.itemTitle, { color: colors.text }]}>{itemTitle}</Text>

            {/* Current Assignments */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Current Assignments
              </Text>
              {loadingAssignments ? (
                <ActivityIndicator color={colors.primary} />
              ) : assignments.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No assignments yet
                </Text>
              ) : (
                assignments.map((assignment) => (
                  <View
                    key={assignment.id}
                    style={[styles.assignmentItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.assignmentInfo}>
                      <User size={16} color={colors.primary} />
                      <View style={styles.assignmentDetails}>
                        <Text style={[styles.assignmentName, { color: colors.text }]}>
                          {assignment.assignedToUser?.fullName || 'Unknown User'}
                        </Text>
                        <Text style={[styles.assignmentEmail, { color: colors.textSecondary }]}>
                          {assignment.assignedToUser?.email || ''}
                        </Text>
                        {assignment.notes && (
                          <Text style={[styles.assignmentNotes, { color: colors.textSecondary }]}>
                            {assignment.notes}
                          </Text>
                        )}
                        <Text style={[styles.assignmentDate, { color: colors.textTertiary }]}>
                          Assigned {new Date(assignment.assignedAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => handleUnassign(assignment.id)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Trash2 size={18} color={colors.error} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>

            {/* Add New Assignment */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Assign to Supervisor
              </Text>

              {/* Sup User Selector */}
              <View style={[styles.inputContainer, { borderColor: colors.border }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Select Supervisor</Text>
                <ScrollView style={styles.selectorContainer}>
                  {supUsers.map((user) => (
                    <Pressable
                      key={user.id}
                      onPress={() => setSelectedSupId(user.id)}
                      style={[
                        styles.selectorItem,
                        {
                          backgroundColor: selectedSupId === user.id ? colors.primarySoft : colors.card,
                          borderColor: selectedSupId === user.id ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectorText,
                          {
                            color: selectedSupId === user.id ? colors.primary : colors.text,
                            fontWeight: selectedSupId === user.id ? '600' : '400',
                          },
                        ]}
                      >
                        {user.fullName} ({user.email})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Notes Input */}
              <View style={[styles.inputContainer, { borderColor: colors.border }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Add any notes about this assignment..."
                  placeholderTextColor={colors.textSecondary}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Assign Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.assignSubmitButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : loading ? 0.6 : 1,
                  },
                ]}
                onPress={handleAssign}
                disabled={loading || !selectedSupId}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.assignSubmitButtonText}>Assign</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  assignButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  assignmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  assignmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  assignmentDetails: {
    flex: 1,
  },
  assignmentName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  assignmentEmail: {
    fontSize: 13,
    marginBottom: 4,
  },
  assignmentNotes: {
    fontSize: 12,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  assignmentDate: {
    fontSize: 11,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  inputContainer: {
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectorContainer: {
    maxHeight: 200,
  },
  selectorItem: {
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  selectorText: {
    fontSize: 14,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  assignSubmitButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignSubmitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

