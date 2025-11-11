// components/MediaUploader.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadToStorage } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { Camera, X } from 'lucide-react-native';

interface MediaUploaderProps {
  onUploadComplete: (url: string) => void;
  onUploadError?: (error: string) => void;
  bucket: 'post_images' | 'avatars' | 'opportunities';
  maxFiles?: number;
  existingUrls?: string[];
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  onUploadComplete,
  onUploadError,
  bucket,
  maxFiles = 1,
  existingUrls = []
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<string[]>(existingUrls);

  const pickImage = async () => {
    if (selectedUrls.length >= maxFiles) {
      Alert.alert('Limit reached', `You can only upload ${maxFiles} image(s)`);
      return;
    }

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to upload images.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && user) {
        setUploading(true);
        const url = await uploadToStorage(result.assets[0].uri, bucket, user.id);
        
        const newUrls = [...selectedUrls, url];
        setSelectedUrls(newUrls);
        onUploadComplete(url);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      onUploadError?.(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (urlToRemove: string) => {
    const newUrls = selectedUrls.filter(url => url !== urlToRemove);
    setSelectedUrls(newUrls);
    // Optionally delete from storage
    // deleteFromStorage(urlToRemove, bucket);
  };

  return (
    <View className="flex-row flex-wrap gap-2">
      {/* Selected Images */}
      {selectedUrls.map((url, index) => (
        <View key={index} className="relative">
          <Image 
            source={{ uri: url }} 
            className="w-20 h-20 rounded-lg"
          />
          <TouchableOpacity 
            onPress={() => removeImage(url)}
            className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
          >
            <X size={16} color="white" />
          </TouchableOpacity>
        </View>
      ))}

      {/* Upload Button */}
      {selectedUrls.length < maxFiles && (
        <TouchableOpacity 
          onPress={pickImage}
          disabled={uploading}
          className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg justify-center items-center"
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : (
            <Camera size={24} color="#9E9E9E" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};