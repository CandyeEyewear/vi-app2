/**
 * Image Upload Service
 * Handles multiple image uploads to Supabase Storage
 */

import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

interface UploadResult {
  urls: string[];
  errors: string[];
}

/**
 * Upload multiple images to Supabase Storage
 */
export async function uploadMultipleImages(
  imageUris: string[],
  userId: string,
  folder: string = 'posts'
): Promise<UploadResult> {
  const urls: string[] = [];
  const errors: string[] = [];

  for (const imageUri of imageUris) {
    try {
      // Get file extension
      const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `${userId}/${folder}/${fileName}`;

      // Read file as base64 using fetch + FileReader (SDK 54 compatible)
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1]; // Strip data URL prefix
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Convert base64 to ArrayBuffer
      const arrayBuffer = decode(base64);

      // Determine content type
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, arrayBuffer, {
          contentType: contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        errors.push(`Failed to upload image: ${uploadError.message}`);
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      urls.push(urlData.publicUrl);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      errors.push(`Failed to upload image: ${error.message || 'Unknown error'}`);
    }
  }

  return { urls, errors };
}


