// services/storage.ts
import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export const uploadToStorage = async (
  fileUri: string, 
  bucket: 'post_images' | 'avatars' | 'opportunities', // Use your existing bucket
  userId: string
): Promise<string> => {
  try {
    // SDK 54: Use fetch + blob to validate and get size
    const headResponse = await fetch(fileUri);
    if (!headResponse.ok) {
      throw new Error('File does not exist or cannot be read');
    }
    const headBlob = await headResponse.blob();
    const _size = headBlob.size; // available if needed

    // Read file as base64 using fetch + FileReader (SDK 54 compatible)
    const response = headResponse;
    const blob = headBlob;
    const fileContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Create filename
    const fileExt = fileUri.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, decode(fileContent), {
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