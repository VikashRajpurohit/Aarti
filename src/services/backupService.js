import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabaseUrl, supabaseAnonKey } from '../config/supabase';
import { forceReauth, getValidAccessToken } from './sessionService';

const parseFileName = (contentDisposition) => {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : null;
};

export const backupService = {
  async downloadBackup() {
    const url = `${supabaseUrl}/functions/v1/backup-export`;
    const accessToken = await getValidAccessToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    };

    const fallbackName = `AartiPolymers_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;

    const downloadRes = await FileSystem.downloadAsync(
      url,
      `${FileSystem.documentDirectory}${fallbackName}`,
      { headers }
    );

    if (downloadRes.status !== 200) {
      let message = 'Backup download failed';
      try {
        const errRes = await fetch(url, { headers });
        const text = await errRes.text();
        if (text) {
          try {
            const json = JSON.parse(text);
            message = json?.error || message;
          } catch {
            message = text;
          }
        }
      } catch (_) {}
      if (downloadRes.status === 401) {
        await forceReauth();
      }
      throw new Error(message);
    }

    const headerName = parseFileName(
      downloadRes.headers?.['content-disposition'] || downloadRes.headers?.['Content-Disposition']
    );
    let fileUri = downloadRes.uri;
    let fileName = headerName || fallbackName;

    if (headerName && headerName !== fallbackName) {
      const newUri = `${FileSystem.documentDirectory}${headerName}`;
      await FileSystem.moveAsync({ from: downloadRes.uri, to: newUri });
      fileUri = newUri;
      fileName = headerName;
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/zip',
        dialogTitle: 'Share Backup',
        UTI: 'public.zip-archive',
      });
    }

    const info = await FileSystem.getInfoAsync(fileUri);
    const fileSizeKb = info.size ? Math.round(info.size / 1024) : null;

    return { fileUri, fileName, fileSizeKb };
  },
};
