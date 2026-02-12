import { supabase } from './supabase';

/**
 * Uploads a file to the 'photos' bucket and returns the public URL.
 * @param file The file to upload
 * @param folder The folder path (e.g., 'players' or 'coaches')
 * @returns The public URL of the uploaded file
 */
export async function uploadPhoto(file: File, folder: string = 'misc'): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload Error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('photos')
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (error) {
    console.error('Error uploading photo:', error);
    return null;
  }
}
