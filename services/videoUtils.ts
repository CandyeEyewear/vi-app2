/**
 * Video Utilities
 * Compress and upload videos efficiently
 */

import * as VideoThumbnails from 'expo-video-thumbnails';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Upload as TusUpload, DetailedError as TusDetailedError } from 'tus-js-client';
import { supabase } from './supabase';
import { supabaseConfig } from '../config/supabase.config';

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

type TusFileInput = {
  uri: string; // must be a file:// URI that expo-file-system can read
  size: number;
};

class ExpoTusFileReader {
  async openFile(input: TusFileInput, _chunkSize: number) {
    if (!input?.uri || !input.uri.startsWith('file://')) {
      throw new Error('tus: expected a file:// URI for upload');
    }

    return {
      size: input.size,
      slice: async (start: number, end: number) => {
        const length = Math.max(0, end - start);
        const base64Chunk = await FileSystem.readAsStringAsync(input.uri, {
          encoding: FileSystem.EncodingType.Base64,
          position: start,
          length,
        });

        return {
          value: decode(base64Chunk), // ArrayBuffer
          done: false,
        };
      },
      close: () => {},
    };
  }
}

async function uploadResumableToSupabase(params: {
  bucket: string;
  objectName: string; // storage path inside bucket
  fileUri: string; // file://
  size: number;
  contentType: string;
  upsert?: boolean;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  const { bucket, objectName, fileUri, size, contentType, upsert = false, onProgress } = params;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const endpoint = `${supabaseConfig.url}/storage/v1/upload/resumable`;
  const token = session?.access_token;

  const headers: Record<string, string> = {
    apikey: supabaseConfig.anonKey,
    'x-upsert': upsert ? 'true' : 'false',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  await new Promise<void>((resolve, reject) => {
    const upload = new TusUpload(
      { uri: fileUri, size } satisfies TusFileInput,
      {
        endpoint,
        uploadSize: size,
        chunkSize: 6 * 1024 * 1024, // 6MB
        retryDelays: [0, 1000, 3000, 5000, 10000],
        headers,
        metadata: {
          bucketName: bucket,
          objectName,
          contentType,
          cacheControl: '3600',
        },
        // Use our chunked reader to avoid loading whole video into memory
        fileReader: new ExpoTusFileReader() as any,
        onProgress: (bytesSent, bytesTotal) => {
          if (bytesTotal > 0) {
            onProgress?.(Math.round((bytesSent / bytesTotal) * 100));
          }
        },
        onError: (err: Error | TusDetailedError) => {
          reject(err);
        },
        onSuccess: () => {
          resolve();
        },
      }
    );

    upload.start();
  });
}

function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    let cleaned = envUrl.trim();
    const match = cleaned.match(/https?:\/\/[^\s"'<>]+/i);
    if (match && match[0]) cleaned = match[0];
    cleaned = cleaned.replace(/[)\],.]+$/, '');
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      return cleaned.replace(/\/+$/, '');
    }
  }
  return 'https://vibe.volunteersinc.org';
}

async function transcodeOnServer(params: {
  bucket: string;
  inputPath: string;
  outputPath: string;
  maxWidth?: number;
  crf?: number;
  deleteInput?: boolean;
}): Promise<{ publicUrl: string }> {
  const { bucket, inputPath, outputPath, maxWidth = 1280, crf = 28, deleteInput = false } = params;

  const apiBase = getApiBaseUrl();
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(`${apiBase}/api/transcode-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ bucket, inputPath, outputPath, maxWidth, crf, deleteInput }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success || !json?.publicUrl) {
    throw new Error(json?.error || `Transcode failed (${res.status})`);
  }

  return { publicUrl: json.publicUrl };
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

    const fileExt = videoUri.split('.').pop()?.toLowerCase() || 'mp4';
    console.log('📤 [VIDEO] Normalizing video URI...');
    const localVideoUri = await ensureFileUri(videoUri, fileExt);
    
    // Check file size
    const info = await FileSystem.getInfoAsync(localVideoUri, { size: true });
    // @ts-expect-error: size is available when { size: true } is passed
    const fileSize = info.exists && typeof info.size === 'number' ? info.size : 0;
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

    const rawFileName = `${Date.now()}-video.${fileExt}`;
    const rawPath = `${userId}/${folder}/raw/${rawFileName}`;

    const contentType = fileExt === 'mov' ? 'video/quicktime' : 'video/mp4';
    
    console.log('📤 [VIDEO] Uploading to Supabase...');
    console.log('📤 [VIDEO] Path:', filePath);
    console.log('📤 [VIDEO] Content-Type:', contentType);

    onProgress?.(15);

    try {
      await uploadResumableToSupabase({
        bucket: 'post-images',
        objectName: rawPath,
        fileUri: localVideoUri,
        size: fileSize,
        contentType,
        upsert: false,
        onProgress: (pct) => {
          // Map resumable progress into overall progress range (15% -> 95%)
          const mapped = 15 + Math.round((pct / 100) * 80);
          onProgress?.(mapped);
        },
      });
    } catch (e: any) {
      console.error('❌ [VIDEO] Resumable upload failed:', e);

      // Fallback: for small videos, try the simpler base64 upload.
      // (Avoid doing this for large files due to memory usage.)
      const FALLBACK_MAX_BYTES = 12 * 1024 * 1024; // 12MB
      if (fileSize > 0 && fileSize <= FALLBACK_MAX_BYTES) {
        console.warn('⚠️ [VIDEO] Falling back to base64 upload (small file)');
        const videoBase64 = await FileSystem.readAsStringAsync(localVideoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { error } = await supabase.storage
          .from('post-images')
          .upload(rawPath, decode(videoBase64), {
            contentType,
            upsert: false,
          });

        if (error) {
          return { success: false, error: `Upload failed: ${error.message}` };
        }
      } else {
        const msg = e?.message || String(e);
        return { success: false, error: `Resumable upload failed: ${msg}` };
      }
    }

    // Try server-side compression/transcoding to reduce size.
    // If it fails, we still return the raw URL as a fallback.
    let finalUrl: string;
    try {
      onProgress?.(92);
      const outFileName = rawFileName.replace(/\.[^.]+$/, '.mp4');
      const outPath = `${userId}/${folder}/processed/${outFileName}`;
      const { publicUrl: processedUrl } = await transcodeOnServer({
        bucket: 'post-images',
        inputPath: rawPath,
        outputPath: outPath,
        maxWidth: 1280,
        crf: 28,
        deleteInput: true,
      });
      finalUrl = processedUrl;
      onProgress?.(98);
    } catch (err) {
      console.warn('⚠️ [VIDEO] Server transcode failed, using raw upload:', err);
      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(rawPath);
      finalUrl = publicUrl;
    }

    onProgress?.(100);
    console.log('✅ [VIDEO] Video uploaded successfully!');

    return {
      success: true,
      videoUrl: finalUrl,
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
