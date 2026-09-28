import { readFile } from 'node:fs/promises';
import { v2 as cloudinary } from 'cloudinary';

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;

const enabled = Boolean(
    CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET,
);

if (enabled) {
    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET,
        secure: true,
    });
}

/** How screenshots reach the page, for the activity panel. */
export const imageStorage = enabled
    ? 'cloudinary.uploader.upload'
    : 'inline data URL (no Cloudinary keys)';

/** Every run's screenshots live under one folder per run. */
const FOLDER = 'agent-browser-jev-demo';

/**
 * Upload a local screenshot and return a URL the page can show. Without
 * Cloudinary credentials the image is inlined as a data URL instead, so the
 * app works with nothing but JEV_API_KEY.
 */
export async function screenshotUrl(
    path: string,
    { runId, index }: { runId: string; index: number },
): Promise<string> {
    if (!enabled) {
        const png = await readFile(path);
        return `data:image/png;base64,${png.toString('base64')}`;
    }
    const result = await cloudinary.uploader.upload(path, {
        folder: `${FOLDER}/${runId}`,
        public_id: `step-${String(index).padStart(2, '0')}`,
        resource_type: 'image',
        overwrite: true,
    });
    return result.secure_url;
}
