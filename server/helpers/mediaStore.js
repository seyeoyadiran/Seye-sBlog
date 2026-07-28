const mongoose = require('mongoose');

// Store uploaded media in MongoDB via GridFS so files survive
// serverless deploys (no persistent local disk on Vercel).

function getBucket() {
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'media'
    });
}

// Save a multer memory-storage file, resolves to the GridFS file id
function saveFile(file) {
    return new Promise((resolve, reject) => {
        const uploadStream = getBucket().openUploadStream(file.originalname, {
            contentType: file.mimetype
        });
        uploadStream.on('finish', () => resolve(uploadStream.id));
        uploadStream.on('error', reject);
        uploadStream.end(file.buffer);
    });
}

// Stream a stored file to an Express response
async function sendFile(id, res) {
    const fileId = new mongoose.Types.ObjectId(id);
    const bucket = getBucket();

    const files = await bucket.find({ _id: fileId }).toArray();
    if (files.length === 0) {
        return res.status(404).send('Media not found');
    }

    res.setHeader('Content-Type', files[0].contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    bucket.openDownloadStream(fileId)
        .on('error', () => res.status(404).end())
        .pipe(res);
}

async function deleteFile(id) {
    try {
        await getBucket().delete(new mongoose.Types.ObjectId(id));
    } catch (err) {
        console.error('Failed to delete media from GridFS:', err.message);
    }
}

// Extract the GridFS id from a stored media url like '/media/<id>'
function idFromUrl(url) {
    const match = /^\/media\/([a-f0-9]{24})$/.exec(url || '');
    return match ? match[1] : null;
}

module.exports = { saveFile, sendFile, deleteFile, idFromUrl };
