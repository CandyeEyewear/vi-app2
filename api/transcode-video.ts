/**
 * API Route: /api/transcode-video
 *
 * Server-side video compression/transcoding pipeline:
 * - Downloads a video from Supabase Storage (signed URL)
 * - Transcodes it with ffmpeg to a smaller MP4 (H.264 + AAC)
 * - Uploads the transcoded file back to Supabase Storage
 *
 * This route is meant to be called from the app using EXPO_PUBLIC_API_URL.
 */
import { createClient } from '@supabase/supabase-js';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { createWriteStream, createReadStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function encodeStoragePath(path: string): string {
  return path
    .split('/')
    .map(seg => encodeURIComponent(seg))
    .join('/');
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download (${res.status})`);
  }

  await fs.mkdir(join(destPath, '..'), { recursive: true }).catch(() => {});

  await new Promise<void>((resolve, reject) => {
    const file = createWriteStream(destPath);
    const reader = res.body.getReader();

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          file.write(Buffer.from(value));
        }
        file.end();
      } catch (e) {
        file.destroy();
        reject(e);
      }
    };

    file.on('finish', resolve);
    file.on('error', reject);
    void pump();
  });
}

async function runFfmpeg(inputPath: string, outputPath: string, maxWidth: number, crf: number): Promise<void> {
  if (!ffmpegPath) throw new Error('ffmpeg binary not available');

  // Scale down (keep aspect) and compress.
  // -movflags +faststart makes MP4 streamable sooner.
  const args = [
    '-y',
    '-i', inputPath,
    '-vf', `scale='min(${maxWidth},iw)':-2`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', String(crf),
    '-profile:v', 'main',
    '-level', '4.0',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ac', '2',
    '-ar', '44100',
    '-movflags', '+faststart',
    outputPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg failed (${code}). ${stderr.slice(0, 1500)}`));
    });
  });
}

async function uploadFileToStorage(params: {
  bucket: string;
  path: string;
  filePath: string;
  contentType: string;
  upsert?: boolean;
}): Promise<void> {
  const { bucket, path, filePath, contentType, upsert = false } = params;

  const url = `${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${encodeStoragePath(path)}`;
  const body = createReadStream(filePath);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'Content-Type': contentType,
      'x-upsert': upsert ? 'true' : 'false',
    },
    // @ts-expect-error Node fetch supports streams with duplex in runtime
    body,
    // @ts-expect-error required by Node fetch for stream bodies
    duplex: 'half',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${text.slice(0, 500)}`);
  }
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Server not configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)' });
    }

    const {
      bucket = 'post-images',
      inputPath,
      outputPath,
      maxWidth = 1280,
      crf = 28,
      deleteInput = false,
    } = req.body || {};

    if (!inputPath || typeof inputPath !== 'string') {
      return res.status(400).json({ error: 'inputPath is required' });
    }
    if (!outputPath || typeof outputPath !== 'string') {
      return res.status(400).json({ error: 'outputPath is required' });
    }

    // Signed URL for download (works even if bucket is private)
    const { data: signed, error: signedErr } = await supabaseAdmin
      .storage
      .from(bucket)
      .createSignedUrl(inputPath, 60 * 10);
    if (signedErr || !signed?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signedErr?.message || 'unknown'}`);
    }

    const jobId = `transcode_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const inFile = join(tmpdir(), `${jobId}_in`);
    const outFile = join(tmpdir(), `${jobId}_out.mp4`);

    await downloadToFile(signed.signedUrl, inFile);
    await runFfmpeg(inFile, outFile, Number(maxWidth) || 1280, Number(crf) || 28);
    await uploadFileToStorage({ bucket, path: outputPath, filePath: outFile, contentType: 'video/mp4', upsert: true });

    // Clean up temp files (best effort)
    await fs.unlink(inFile).catch(() => {});
    await fs.unlink(outFile).catch(() => {});

    if (deleteInput) {
      await supabaseAdmin.storage.from(bucket).remove([inputPath]).catch(() => {});
    }

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeStoragePath(outputPath)}`;
    return res.status(200).json({ success: true, bucket, outputPath, publicUrl });
  } catch (error: any) {
    console.error('[transcode-video] error:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Internal server error' });
  }
}

