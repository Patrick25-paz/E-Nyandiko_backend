const stream = require('stream');

const env = require('../config/env');
const { cloudinary } = require('../config/cloudinary');
const { ApiError } = require('../utils/errors');

function assertCloudinaryConfigured() {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
        throw new ApiError(500, 'Cloudinary is not configured');
    }
}

async function uploadBuffer({ buffer, folder, filename }) {
    assertCloudinaryConfigured();

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: filename,
                resource_type: 'image'
            },
            (err, result) => {
                if (err) return reject(err);
                return resolve(result);
            }
        );

        const readable = new stream.PassThrough();
        readable.end(buffer);
        readable.pipe(uploadStream);
    });
}

module.exports = {
    uploadBuffer
};
