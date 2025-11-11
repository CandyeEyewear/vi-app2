// services/storage.ts
import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';

export const uploadToStorage = async (
  fileUri: string, 
  bucket: 'post_images' | 'avatars' | 'opportunities', // Use your existing bucket
  userId: string
): Promise<string> => {
  try {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

    // Read file as base64
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create filename
    const fileExt = fileUri.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, FileSystem.EncodingType.Base64.encode(fileContent), {
        contentType: `image/${fileExt}`,
        upsert: false
      });

    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);
      
    return publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

export const deleteFromStorage = async (url: string, bucket: string) => {
  try {
    // Extract path from URL
    const path = url.split('/').pop();
    if (!path) throw new Error('Invalid URL');

    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
  } catch (error) {
    console.error('Delete error:', error);
    throw error;
  }
};