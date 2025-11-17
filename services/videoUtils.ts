/**
 * Video Utilities
 * Compress and upload videos efficiently
 */

import * as VideoThumbnails from 'expo-video-thumbnails';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

interface VideoUploadResult {
  success: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

/**
 * Generate thumbnail for video
 */
export async function generateVideoThumbnail(videoUri: string): Promise<string | null> {
  try {
    console.log('📸 [VIDEO] Generating thumbnail...');
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 1000, // 1 second into video
    });
    
    // Compress thumbnail
    const compressed = await manipulateAsync(
      uri,
      [{ resize: { width: 640 } }],
      { compress: 0.7, format: SaveFormat.JPEG }
    );
    
    console.log('✅ [VIDEO] Thumbnail generated');
    return compressed.uri;
  } catch (error) {
    console.error('❌ [VIDEO] Thumbnail generation failed:', error);
    return null;
  }
}

/**
 * Get video file size
 */
export async function getVideoSize(uri: string): Promise<number> {
  try {
    // SDK 54: Use fetch + blob to get size
    const response = await fetch(uri);
    if (!response.ok) return 0;
    const blob = await response.blob();
    return blob.size || 0;
  } catch {
    return 0;
  }
}

/**
 * Check if video is too large
 */
export function isVideoTooLarge(sizeInBytes: number): boolean {
  const maxSize = 50 * 1024 * 1024; // 50MB
  return sizeInBytes > maxSize;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Upload video with thumbnail
 * NOTE: This doesn't compress video (requires native modules)
 * Instead, we'll limit video size and show progress
 */
export async function uploadVideo(
  videoUri: string,
  userId: string,
  folder: string = 'videos',
  onProgress?: (progress: number) => void
): Promise<VideoUploadResult> {
  try {
    console.log('🎥 [VIDEO] Starting video upload...');
    
    // Check file size
    const fileSize = await getVideoSize(videoUri);
    console.log('📊 [VIDEO] File size:', formatFileSize(fileSize));
    
    if (isVideoTooLarge(fileSize)) {
      return {
        success: false,
        error: `Video too large (${formatFileSize(fileSize)}). Maximum 50MB.`
      };
    }

    // Generate thumbnail
    const thumbnailUri = await generateVideoThumbnail(videoUri);
    let thumbnailUrl: string | undefined;

    // Upload thumbnail first (faster feedback)
    if (thumbnailUri) {
      console.log('📤 [VIDEO] Uploading thumbnail...');
      const thumbResp = await fetch(thumbnailUri);
      const thumbBlob = await thumbResp.blob();
      const thumbBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(thumbBlob);
      });
      
      const thumbFileName = `${Date.now()}-thumb.jpg`;
      const thumbPath = `${userId}/${folder}/${thumbFileName}`;
      
      const { error: thumbError } = await supabase.storage
        .from('post-images')
        .upload(thumbPath, decode(thumbBase64), {
          contentType: 'image/jpeg',
        });
      
      if (!thumbError) {
        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(thumbPath);
        thumbnailUrl = publicUrl;
        console.log('✅ [VIDEO] Thumbnail uploaded');
      }
    }

    // Upload video
    console.log('📤 [VIDEO] Uploading video file...');
    onProgress?.(10);

    const videoResp = await fetch(videoUri);
    const videoBlob = await videoResp.blob();
    const videoBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(videoBlob);
    });
    
    onProgress?.(30);

    const fileExt = videoUri.split('.').pop()?.toLowerCase() || 'mp4';
    const fileName = `${Date.now()}-video.${fileExt}`;
    const filePath = `${userId}/${folder}/${fileName}`;

    const contentType = fileExt === 'mov' ? 'video/quicktime' : 'video/mp4';
    
    onProgress?.(50);

    const { data, error } = await supabase.storage
      .from('post-images')
      .upload(filePath, decode(videoBase64), {
        contentType,
        upsert: false,
      });

    onProgress?.(90);

    if (error) {
      console.error('❌ [VIDEO] Upload error:', error);
      return {
        success: false,
        error: `Upload failed: ${error.message}`
      };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('post-images')
      .getPublicUrl(filePath);

    onProgress?.(100);
    console.log('✅ [VIDEO] Video uploaded successfully!');

    return {
      success: true,
      videoUrl: publicUrl,
      thumbnailUrl,
    };

  } catch (error: any) {
    console.error('❌ [VIDEO] Fatal error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}
