/**
 * Video Utilities
 * Compress and upload videos efficiently
 */

import * as VideoThumbnails from 'expo-video-thumbnails';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';
import { supabaseConfig } from '../config/supabase.config';

export const MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024; // 150MB (Facebook-like, but still reasonable for mobile)
export const MAX_VIDEO_DURATION_MINUTES = 15;
export const MAX_VIDEO_DURATION_SECONDS = MAX_VIDEO_DURATION_MINUTES * 60;

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
    // Prefer filesystem size (fast, low-memory) when it's a local file:// URI
    if (uri.startsWith('file://')) {
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      // @ts-expect-error: size is available when { size: true } is passed
      return typeof info.size === 'number' ? info.size : 0;
    }

    // Some platforms still support size for non-file URIs
    try {
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      // @ts-expect-error: size is available when { size: true } is passed
      if (typeof info.size === 'number') return info.size;
    } catch {
      // ignore and fallback
    }

    // Fallback: fetch -> blob (may be memory-heavy; avoid for large files if possible)
    const response = await fetch(uri);
    if (!response.ok) return 0;
    const blob = await response.blob();
    return blob.size || 0;
  } catch {
    return 0;
  }
}

function encodeStoragePath(path: string): string {
  // Encode each path segment, preserving slashes
  return path
    .split('/')
    .map(seg => encodeURIComponent(seg))
    .join('/');
}

async function ensureLocalFileUri(uri: string, fallbackExt: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;

  // Copy to cache to get a stable file:// URI (works for many content:// / ph:// sources)
  const dest = `${FileSystem.cacheDirectory}upload-${Date.now()}-${Math.random().toString(36).slice(2)}.${fallbackExt}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

async function uploadFileToSupabaseStorage(params: {
  bucket: string;
  path: string;
  fileUri: string;
  contentType: string;
  upsert?: boolean;
}): Promise<void> {
  const { bucket, path, fileUri, contentType, upsert = false } = params;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    apikey: supabaseConfig.anonKey,
    'Content-Type': contentType,
    'x-upsert': upsert ? 'true' : 'false',
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const url = `${supabaseConfig.url}/storage/v1/object/${bucket}/${encodeStoragePath(path)}`;

  const result = await FileSystem.uploadAsync(url, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers,
  });

  if (result.status < 200 || result.status >= 300) {
    const bodyPreview = typeof result.body === 'string' ? result.body.slice(0, 300) : '';
    throw new Error(`Storage upload failed (${result.status})${bodyPreview ? `: ${bodyPreview}` : ''}`);
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
    
    const fileExt = videoUri.split('.').pop()?.toLowerCase() || 'mp4';
    const localVideoUri = await ensureLocalFileUri(videoUri, fileExt);
    
    // Check file size
    const fileSize = await getVideoSize(localVideoUri);
    console.log('📊 [VIDEO] File size:', formatFileSize(fileSize));
    
    if (isVideoTooLarge(fileSize)) {
      return {
        success: false,
        error: `Video too large (${formatFileSize(fileSize)}). Maximum ${formatFileSize(MAX_VIDEO_SIZE_BYTES)}.`
      };
    }

    // Generate thumbnail
    const thumbnailUri = await generateVideoThumbnail(localVideoUri);
    let thumbnailUrl: string | undefined;

    // Upload thumbnail first (faster feedback)
    if (thumbnailUri) {
      console.log('📤 [VIDEO] Uploading thumbnail...');
      
      const thumbFileName = `${Date.now()}-thumb.jpg`;
      const thumbPath = `${userId}/${folder}/${thumbFileName}`;
      
      try {
        await uploadFileToSupabaseStorage({
          bucket: 'post-images',
          path: thumbPath,
          fileUri: thumbnailUri,
          contentType: 'image/jpeg',
          upsert: false,
        });

        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(thumbPath);
        thumbnailUrl = publicUrl;
        console.log('✅ [VIDEO] Thumbnail uploaded');
      } catch (e) {
        console.warn('⚠️ [VIDEO] Thumbnail upload failed (continuing without it):', e);
      }
    }

    // Upload video
    console.log('📤 [VIDEO] Uploading video file...');
    onProgress?.(10);

    onProgress?.(30);

    const fileName = `${Date.now()}-video.${fileExt}`;
    const filePath = `${userId}/${folder}/${fileName}`;

    const contentType = fileExt === 'mov' ? 'video/quicktime' : 'video/mp4';
    
    onProgress?.(50);

    onProgress?.(90);

    await uploadFileToSupabaseStorage({
      bucket: 'post-images',
      path: filePath,
      fileUri: localVideoUri,
      contentType,
      upsert: false,
    });

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
