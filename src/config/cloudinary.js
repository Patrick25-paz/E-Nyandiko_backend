const { v2: cloudinary } = require('cloudinary');
const env = require('./env');

function configureCloudinary() {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
        return;
    }

    cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET
    });
}

module.exports = {
    cloudinary,
    configureCloudinary
};
