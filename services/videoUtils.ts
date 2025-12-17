/**
 * Video Utilities
 * Compress and upload videos efficiently
 */

import * as VideoThumbnails from 'expo-video-thumbnails';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

export const MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024; // 150MB (Facebook-like, but still reasonable for mobile)
export const MAX_VIDEO_DURATION_MINUTES = 15;
export const MAX_VIDEO_DURATION_SECONDS = MAX_VIDEO_DURATION_MINUTES * 60;

/**
 * Ensure URI is a readable file:// path
 * Handles content:// (Android) and ph:// (iOS) URIs by copying to cache
 */
async function ensureFileUri(uri: string, fileExtension: string = 'mp4'): Promise<string> {
  // Already a file:// URI - return as-is
  if (uri.startsWith('file://')) {
    console.log('📁 [VIDEO] URI already file://, using directly');
    return uri;
  }

  // Sanitize extension (avoid weird content:// strings producing invalid filenames)
  const ext = /^[a-z0-9]+$/i.test(fileExtension) ? fileExtension : 'mp4';

  // Need to copy to a file:// path we can read
  console.log('📁 [VIDEO] Converting URI to file:// path...');
  const fileName = `video_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const destUri = `${FileSystem.cacheDirectory}${fileName}`;

  try {
    await FileSystem.copyAsync({
      from: uri,
      to: destUri,
    });
    console.log('✅ [VIDEO] URI converted successfully:', destUri);
    return destUri;
  } catch (error) {
    console.error('❌ [VIDEO] Failed to convert URI:', error);
    throw new Error(`Cannot read video file: ${String(error)}`);
  }
}

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
    console.log('📊 [VIDEO] Getting video size...');

    // Ensure we have a readable file:// URI
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'mp4';
    const fileUri = await ensureFileUri(uri, fileExt);

    const info = await FileSystem.getInfoAsync(fileUri, { size: true });

    if (!info.exists) {
      console.warn('⚠️ [VIDEO] File does not exist:', fileUri);
      return 0;
    }

    // @ts-expect-error: size is available when { size: true } is passed
    const size = typeof info.size === 'number' ? info.size : 0;
    console.log('📊 [VIDEO] File size:', size, 'bytes');
    return size;
  } catch (error) {
    console.error('❌ [VIDEO] Failed to get video size:', error);
    return 0;
  }
}

/**
 * Check if video is too large
 */
export function isVideoTooLarge(sizeInBytes: number): boolean {
  return sizeInBytes > MAX_VIDEO_SIZE_BYTES;
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
        error: `Video too large (${formatFileSize(fileSize)}). Maximum ${formatFileSize(MAX_VIDEO_SIZE_BYTES)}.`
      };
    }

    // Generate thumbnail
    const thumbnailUri = await generateVideoThumbnail(videoUri);
    let thumbnailUrl: string | undefined;

    // Upload thumbnail first (faster feedback)
    if (thumbnailUri) {
      console.log('📤 [VIDEO] Uploading thumbnail...');
      
      const thumbFileName = `${Date.now()}-thumb.jpg`;
      const thumbPath = `${userId}/${folder}/${thumbFileName}`;
      
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

    const fileExt = videoUri.split('.').pop()?.toLowerCase() || 'mp4';

    // Ensure we have a readable file:// URI
    console.log('📤 [VIDEO] Normalizing video URI...');
    const localVideoUri = await ensureFileUri(videoUri, fileExt);

    onProgress?.(20);

    // Read file directly as base64 (no fetch, no blob, no FileReader)
    console.log('📤 [VIDEO] Reading video as base64...');
    let videoBase64: string;
    try {
      videoBase64 = await FileSystem.readAsStringAsync(localVideoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('✅ [VIDEO] Video read successfully, base64 length:', videoBase64.length);
    } catch (readError: any) {
      console.error('❌ [VIDEO] Failed to read video file:', readError);
      return {
        success: false,
        error: `Cannot read video file: ${readError?.message || 'Unknown error'}`,
      };
    }

    onProgress?.(50);

    onProgress?.(30);

    const fileName = `${Date.now()}-video.${fileExt}`;
    const filePath = `${userId}/${folder}/${fileName}`;

    const contentType = fileExt === 'mov' ? 'video/quicktime' : 'video/mp4';
    
    onProgress?.(50);

    console.log('📤 [VIDEO] Uploading to Supabase...');
    console.log('📤 [VIDEO] Path:', filePath);
    console.log('📤 [VIDEO] Content-Type:', contentType);

    onProgress?.(60);

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
