const mongoose = require('mongoose');

const MediaSchema = new mongoose.Schema({
    url: String,
    type: { type: String, enum: ['image', 'video'] }
});

const PostSchema = new mongoose.Schema({
    title: { type: String, required: true },
    body: { type: String, required: true },
    media: [MediaSchema], // ← Add this for multiple media
    views: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', PostSchema);



// const mongoose = require('mongoose');

// const PostSchema = new mongoose.Schema({
//     title: {
//         type: String,
//         required: true,
//     },
//     body: {
//         type: String,
//         required: true,
//     },
//     featuredImage: {
//         type: String,
//         required: false,
//     },
//     mediaType: {
//         type: String,
//         enum: ['image', 'video', null],
//         default: null
//     },
//     createdAt: {
//         type: Date,
//         default: Date.now
//     },
//     updatedAt: {
//         type: Date,
//         default: Date.now
//     }
// });

// module.exports = mongoose.model('Post', PostSchema);
