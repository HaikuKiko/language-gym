/**
 * Taking or choosing a photo of a page and shrinking it before upload, so it
 * sends quickly and costs a predictable amount to read.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Longest side sent to Claude: enough to read handwriting clearly. */
const MAX_SIDE = 1568;

export type PreparedPhoto = { base64: string; mediaType: 'image/jpeg' };

/** Most pages read together as one piece of writing (the server allows the same). */
export const MAX_PAGES = 4;

/**
 * Opens the camera (or the photo library) and returns the photo as a resized
 * JPEG in base64, or null if the student cancelled.
 */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PreparedPhoto | null> {
  const photos = await pickPhotos(source, 1);
  return photos[0] ?? null;
}

/**
 * Takes one photo, or chooses up to `max` from the library (in the order they
 * were picked), each resized to JPEG base64. Empty if cancelled.
 */
export async function pickPhotos(source: 'camera' | 'library', max: number): Promise<PreparedPhoto[]> {
  if (max < 1) return [];
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Allow the camera in your settings to take a photo, or choose one instead.');
    }
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(
          max > 1
            ? { ...options, allowsMultipleSelection: true, selectionLimit: max, orderedSelection: true }
            : options,
        );
  if (result.canceled || result.assets.length === 0) return [];

  const prepared: PreparedPhoto[] = [];
  for (const asset of result.assets.slice(0, max)) prepared.push(await prepare(asset));
  return prepared;
}

async function prepare(asset: ImagePicker.ImagePickerAsset): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!saved.base64) throw new Error('Could not prepare the photo. Please try another one.');

  // Some platforms return a data URI; the server wants the bare base64 data.
  return { base64: saved.base64.replace(/^data:[^,]+,/, ''), mediaType: 'image/jpeg' };
}
