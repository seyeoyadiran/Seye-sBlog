const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const SiteVisit = require('../models/Sitevisit');
const fs = require('fs');
const mediaStore = require('../helpers/mediaStore');

const adminLayout = '../views/layouts/admin';
const loginLayout = '../views/layouts/login';
const jwtSecret = process.env.JWT_SECRET;

// =======================
// Multer Configuration
// =======================
// Files are held in memory then written to MongoDB (GridFS) —
// local disk is not persistent on serverless hosts like Vercel
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed'), false);
        }
    }
});

// =======================
// Auth Middleware
// =======================
const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.redirect('/admin');

    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.userId = decoded.userId;
        next();
    } catch {
        res.clearCookie('token');
        return res.redirect('/admin');
    }
};

// =======================
// Database Connection Check Helper
// =======================
function checkDBConnection(req, res) {
    if (!req.dbConnected) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(503).json({ error: 'Database service unavailable' });
        }
        return res.status(503).render('admin/error', {
            layout: adminLayout,
            title: 'Service Unavailable',
            message: 'Database service is temporarily unavailable. Please try again later.',
            currentRoute: req.path
        });
    }
    return true;
}

// =======================
// Admin Login & Registration Pages
// =======================
router.get('/', (req, res) => {
    res.render('admin/index', {
        layout: loginLayout,
        locals: { title: 'Admin', description: 'Login/Register Page' },
        currentRoute: '/admin',
        query: req.query
    });
});

router.get('/register', (req, res) => {
    res.render('admin/register', {
        layout: loginLayout,
        locals: { title: 'Register', description: 'Register Admin' },
        currentRoute: '/admin/register',
        query: req.query
    });
});

// =======================
// Admin Registration POST
// =======================
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check database connection
        if (!checkDBConnection(req, res)) return;

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.redirect('/admin?status=error&message=Username already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword });

        return res.redirect('/admin?status=success&message=Registered successfully');
    } catch (err) {
        console.error('Registration error:', err);
        
        // Handle database errors
        if (err.name === 'MongoNetworkError' || err.name === 'MongooseError') {
            return res.redirect('/admin?status=error&message=Database service unavailable');
        }
        
        return res.redirect('/admin?status=error&message=Registration failed');
    }
});

// =======================
// Admin Login POST
// =======================
router.post('/', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check database connection
        if (!checkDBConnection(req, res)) return;

        const user = await User.findOne({ username });
        if (!user) {
            return res.redirect('/admin?status=error&message=User not found');
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.redirect('/admin?status=error&message=Invalid password');
        }

        const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true });

        return res.redirect('/admin/dashboard');
    } catch (err) {
        console.error('Login error:', err);
        
        // Handle database errors
        if (err.name === 'MongoNetworkError' || err.name === 'MongooseError') {
            return res.redirect('/admin?status=error&message=Database service unavailable');
        }
        
        return res.redirect('/admin?status=error&message=Login failed');
    }
});

// =======================
// Admin Dashboard
// =======================
router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        // Check database connection
        if (!checkDBConnection(req, res)) return;

        const posts = await Post.find().sort({ createdAt: -1 }).lean(); // Use lean() for better performance
        
        res.render('admin/dashboard', {
            layout: adminLayout,
            locals: { title: 'Dashboard', description: 'Admin Dashboard' },
            data: posts,
            currentRoute: '/admin/dashboard'
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        
        // Handle database errors
        if (err.name === 'MongoNetworkError' || err.name === 'MongooseError') {
            return res.status(503).render('admin/error', {
                layout: adminLayout,
                title: 'Service Unavailable',
                message: 'Database service is temporarily unavailable. Please try again later.',
                currentRoute: '/admin/dashboard'
            });
        }
        
        res.redirect('/admin');
    }
});

// =======================
// Add Post
// =======================
router.get('/add-post', authMiddleware, (req, res) => {
    res.render('admin/add-post', {
        layout: adminLayout,
        locals: { title: 'Add Post', description: 'Create a new post' },
        currentRoute: '/admin/add-post'
    });
});

router.post('/add-post', authMiddleware, upload.array('featuredMedia', 10), async (req, res) => {
    try {
        // Check database connection
        if (!checkDBConnection(req, res)) return;

        const mediaFiles = await Promise.all(req.files.map(async file => ({
            url: '/media/' + await mediaStore.saveFile(file),
            type: file.mimetype.startsWith('image/') ? 'image' : 'video'
        })));

        await Post.create({ 
            title: req.body.title,
            body: req.body.body,
            media: mediaFiles
        });

        res.redirect('/admin/dashboard?status=success&message=Post created successfully');
    } catch (err) {
        console.error(err);
        
        // Handle database errors
        if (err.name === 'MongoNetworkError' || err.name === 'MongooseError') {
            return res.redirect('/admin/add-post?status=error&message=Database service unavailable');
        }
        
        res.redirect('/admin/add-post?status=error&message=Error creating post');
    }
});

// =======================
// Edit Post
// =======================
router.get('/edit-post/:id', authMiddleware, async (req, res) => {
    try {
        // Check database connection
        if (!checkDBConnection(req, res)) return;

        const post = await Post.findById(req.params.id).lean(); // Use lean() for better performance
        
        if (!post) {
            return res.redirect('/admin/dashboard?status=error&message=Post not found');
        }

        res.render('admin/edit-post', {
            layout: adminLayout,
            locals: { title: 'Edit Post', description: 'Update your post content' },
            data: post,
            currentRoute: '/admin/edit-post'
        });
    } catch (err) {
        console.error('Edit post page error:', err);
        
        // Handle database errors
        if (err.name === 'MongoNetworkError' || err.name === 'MongooseError') {
            return res.status(503).render('admin/error', {
                layout: adminLayout,
                title: 'Service Unavailable',
                message: 'Database service is temporarily unavailable. Please try again later.',
                currentRoute: '/admin/edit-post'
            });
        }
        
        res.redirect('/admin/dashboard?status=error&message=Failed to load post');
    }
});

router.put('/edit-post/:id', authMiddleware, upload.array('featuredMedia', 10), async (req, res) => {
    try {
        // Check database connection
        if (!checkDBConnection(req, res)) return;

        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.redirect(`/admin/edit-post/${req.params.id}?status=error&message=Post not found`);
        }

        // Remove selected media
        if (req.body.removeMediaIndexes) {
            const indexesToRemove = req.body.removeMediaIndexes.split(',').map(i => parseInt(i));
            post.media = post.media.filter((m, idx) => {
                if (indexesToRemove.includes(idx)) {
                    const mediaId = mediaStore.idFromUrl(m.url);
                    if (mediaId) {
                        mediaStore.deleteFile(mediaId);
                    } else {
                        // Legacy disk-stored media
                        const oldPath = path.join(__dirname, '..', '..', 'public', m.url);
                        fs.unlink(oldPath, err => { if (err) console.error('Failed to delete media:', err); });
                    }
                    return false; // remove from array
                }
                return true; // keep in array
            });
        }

        // Append new media
        if (req.files && req.files.length > 0) {
            const newMedia = await Promise.all(req.files.map(async file => ({
                url: '/media/' + await mediaStore.saveFile(file),
                type: file.mimetype.startsWith('image/') ? 'image' : 'video'
            })));
            post.media = [...post.media, ...newMedia];
        }

        // Update text
        post.title = req.body.title;
        post.body = req.body.body;
        post.updatedAt = Date.now();

        await post.save();
        res.redirect(`/admin/edit-post/${req.params.id}?status=success&message=Post updated successfully`);
    } catch (err) {
        console.error('Edit post error:', err);
        
        // Handle database errors
        if (err.name === 'MongoNetworkError' || err.name === 'MongooseError') {
            return res.redirect(`/admin/edit-post/${req.params.id}?status=error&message=Database service unavailable`);
        }
        
        res.redirect(`/admin/edit-post/${req.params.id}?status=error&message=Error updating post`);
    }
});

// =======================
// Delete Post
// =======================
router.delete('/delete-post/:id', authMiddleware, async (req, res) => {
    try {
        // Check database connection
        if (!checkDBConnection(req, res)) return;

        const post = await Post.findById(req.params.id);
        if (!post) return res.redirect('/admin/dashboard?status=error&message=Post not found');

        if (post.media) {
            post.media.forEach(m => {
                const mediaId = mediaStore.idFromUrl(m.url);
                if (mediaId) {
                    mediaStore.deleteFile(mediaId);
                } else {
                    // Legacy disk-stored media
                    const mediaPath = path.join(__dirname, '..', '..', 'public', m.url);
                    fs.unlink(mediaPath, err => { if (err) console.error('Failed to delete media:', err); });
                }
            });
        }

        await Post.findByIdAndDelete(req.params.id);
        res.redirect('/admin/dashboard?status=success&message=Post deleted successfully');
    } catch (err) {
        console.error(err);
        
        // Handle database errors
        if (err.name === 'MongoNetworkError' || err.name === 'MongooseError') {
            return res.redirect('/admin/dashboard?status=error&message=Database service unavailable');
        }
        
        res.redirect('/admin/dashboard?status=error&message=Error deleting post');
    }
});

// =======================
// Analytics API
// =======================
router.get("/api/analytics", authMiddleware, async (req, res) => {
    try {
        // Check database connection
        if (!checkDBConnection(req, res)) return;

        const posts = await Post.find({}).lean(); // Use lean() for better performance
        const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);

        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toISOString().split('T')[0]);
        }

        const siteVisitsData = await SiteVisit.find({ date: { $in: last7Days } }).lean();
        const visitsMap = {};
        siteVisitsData.forEach(v => { visitsMap[v.date] = v.count; });
        const visitsByDay = last7Days.map(d => ({ _id: d, count: visitsMap[d] || 0 }));

        visitsByDay.sort((a, b) => new Date(a._id) - new Date(b._id));

        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        const totalSiteVisits = await SiteVisit.aggregate([
            { $match: { date: { $gte: last30Days.toISOString().split('T')[0] } } },
            { $group: { _id: null, total: { $sum: "$count" } } }
        ]);

        const siteVisits = totalSiteVisits.length > 0 ? totalSiteVisits[0].total : 0;
        const today = new Date().toISOString().split('T')[0];
        const todayVisit = await SiteVisit.findOne({ date: today });
        const todayVisits = todayVisit ? todayVisit.count : 0;

        res.json({ totalPosts: posts.length, totalViews, siteVisits, todayVisits, visitsByDay });
    } catch (err) {
        console.error("Analytics fetch failed:", err);
        
        // Handle database errors
        if (err.name === 'MongoNetworkError' || err.name === 'MongooseError') {
            return res.status(503).json({ error: "Database service unavailable" });
        }
        
        res.status(500).json({ error: "Analytics fetch failed" });
    }
});

// =======================
// Top Posts API
// =======================
router.get("/api/top-posts", authMiddleware, async (req, res) => {
    try {
        // Check database connection
        if (!checkDBConnection(req, res)) return;

        const topPosts = await Post.find({})
            .sort({ views: -1 })
            .limit(10)
            .select('title views')
            .lean(); // Use lean() for better performance
        
        res.json(topPosts);
    } catch (err) {
        console.error("Failed to fetch top posts:", err);
        
        // Handle database errors
        if (err.name === 'MongoNetworkError' || err.name === 'MongooseError') {
            return res.status(503).json({ error: "Database service unavailable" });
        }
        
        res.status(500).json({ error: "Failed to fetch top posts" });
    }
});

// =======================
// Logout
// =======================
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/admin');
});

// =======================
// Multer Error Handling
// =======================
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).send('File too large. Maximum size is 50MB.');
    } else if (error) {
        return res.status(400).send(error.message);
    }
    next();
});

module.exports = router;
// const express = require('express');
// const router = express.Router();
// const Post = require('../models/Post');
// const User = require('../models/User');
// const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken');
// const multer = require('multer');
// const path = require('path');
// const SiteVisit = require('../models/Sitevisit');
// const fs = require('fs');

// const adminLayout = '../views/layouts/admin';
// const loginLayout = '../views/layouts/login';
// const jwtSecret = process.env.JWT_SECRET;

// // =======================
// // Multer Configuration
// // =======================
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, 'public/uploads/');
//     },
//     filename: function (req, file, cb) {
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//     }
// });

// const upload = multer({
//     storage: storage,
//     limits: { fileSize: 50 * 1024 * 1024 },
//     fileFilter: function (req, file, cb) {
//         if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
//             cb(null, true);
//         } else {
//             cb(new Error('Only image and video files are allowed'), false);
//         }
//     }
// });

// // =======================
// // Auth Middleware
// // =======================
// const authMiddleware = (req, res, next) => {
//     const token = req.cookies.token;
//     if (!token) return res.redirect('/admin');

//     try {
//         const decoded = jwt.verify(token, jwtSecret);
//         req.userId = decoded.userId;
//         next();
//     } catch {
//         res.clearCookie('token');
//         return res.redirect('/admin');
//     }
// };

// // =======================
// // Admin Login & Registration Pages
// // =======================
// router.get('/', (req, res) => {
//     res.render('admin/index', {
//         layout: loginLayout,
//         locals: { title: 'Admin', description: 'Login/Register Page' },
//         currentRoute: '/admin',
//         query: req.query
//     });
// });

// router.get('/register', (req, res) => {
//     res.render('admin/register', {
//         layout: loginLayout,
//         locals: { title: 'Register', description: 'Register Admin' },
//         currentRoute: '/admin/register',
//         query: req.query
//     });
// });

// // =======================
// // Admin Registration POST
// // =======================
// router.post('/register', async (req, res) => {
//     const { username, password } = req.body;

//     try {
//         const existingUser = await User.findOne({ username });
//         if (existingUser) {
//             return res.redirect('/admin?status=error&message=Username already exists');
//         }

//         const hashedPassword = await bcrypt.hash(password, 10);
//         await User.create({ username, password: hashedPassword });

//         return res.redirect('/admin?status=success&message=Registered successfully');
//     } catch (err) {
//         console.error('Registration error:', err);
//         return res.redirect('/admin?status=error&message=Registration failed');
//     }
// });

// // =======================
// // Admin Login POST
// // =======================
// router.post('/', async (req, res) => {
//     const { username, password } = req.body;

//     try {
//         const user = await User.findOne({ username });
//         if (!user) {
//             return res.redirect('/admin?status=error&message=User not found');
//         }

//         const valid = await bcrypt.compare(password, user.password);
//         if (!valid) {
//             return res.redirect('/admin?status=error&message=Invalid password');
//         }

//         const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '1h' });
//         res.cookie('token', token, { httpOnly: true });

//         return res.redirect('/admin/dashboard');
//     } catch (err) {
//         console.error('Login error:', err);
//         return res.redirect('/admin?status=error&message=Login failed');
//     }
// });

// // =======================
// // Admin Dashboard
// // =======================
// router.get('/dashboard', authMiddleware, async (req, res) => {
//     try {
//         const posts = await Post.find().sort({ createdAt: -1 });
//         res.render('admin/dashboard', {
//             layout: adminLayout,
//             locals: { title: 'Dashboard', description: 'Admin Dashboard' },
//             data: posts,
//             currentRoute: '/admin/dashboard'
//         });
//     } catch (err) {
//         console.error('Dashboard error:', err);
//         res.redirect('/admin');
//     }
// });

// // =======================
// // Add Post
// // =======================
// router.get('/add-post', authMiddleware, (req, res) => {
//     res.render('admin/add-post', {
//         layout: adminLayout,
//         locals: { title: 'Add Post', description: 'Create a new post' },
//         currentRoute: '/admin/add-post'
//     });
// });

// router.post('/add-post', authMiddleware, upload.array('featuredMedia', 10), async (req, res) => {
//     try {
//         const mediaFiles = req.files.map(file => ({
//             url: '/uploads/' + file.filename,
//             type: file.mimetype.startsWith('image/') ? 'image' : 'video'
//         }));

//         await Post.create({ 
//             title: req.body.title,
//             body: req.body.body,
//             media: mediaFiles
//         });

//         res.redirect('/admin/dashboard?status=success&message=Post created successfully');
//     } catch (err) {
//         console.error(err);
//         res.redirect('/admin/add-post?status=error&message=Error creating post');
//     }
// });

// // =======================
// // Edit Post
// // =======================
// router.get('/edit-post/:id', authMiddleware, async (req, res) => {
//     try {
//         const post = await Post.findById(req.params.id);
//         if (!post) {
//             return res.redirect('/admin/dashboard?status=error&message=Post not found');
//         }

//         res.render('admin/edit-post', {
//             layout: adminLayout,
//             locals: { title: 'Edit Post', description: 'Update your post content' },
//             data: post,
//             currentRoute: '/admin/edit-post'
//         });
//     } catch (err) {
//         console.error('Edit post page error:', err);
//         res.redirect('/admin/dashboard?status=error&message=Failed to load post');
//     }
// });

// router.put('/edit-post/:id', authMiddleware, upload.array('featuredMedia', 10), async (req, res) => {
//     try {
//         const post = await Post.findById(req.params.id);
//         if (!post) {
//             return res.redirect(`/admin/edit-post/${req.params.id}?status=error&message=Post not found`);
//         }

//         // Remove selected media
//         if (req.body.removeMediaIndexes) {
//             const indexesToRemove = req.body.removeMediaIndexes.split(',').map(i => parseInt(i));
//             post.media = post.media.filter((m, idx) => {
//                 if (indexesToRemove.includes(idx)) {
//                     const oldPath = path.join(__dirname, '..', 'public', m.url);
//                     fs.unlink(oldPath, err => { if (err) console.error('Failed to delete media:', err); });
//                     return false; // remove from array
//                 }
//                 return true; // keep in array
//             });
//         }

//         // Append new media
//         if (req.files && req.files.length > 0) {
//             const newMedia = req.files.map(file => ({
//                 url: '/uploads/' + file.filename,
//                 type: file.mimetype.startsWith('image/') ? 'image' : 'video'
//             }));
//             post.media = [...post.media, ...newMedia];
//         }

//         // Update text
//         post.title = req.body.title;
//         post.body = req.body.body;
//         post.updatedAt = Date.now();

//         await post.save();
//         res.redirect(`/admin/edit-post/${req.params.id}?status=success&message=Post updated successfully`);
//     } catch (err) {
//         console.error('Edit post error:', err);
//         res.redirect(`/admin/edit-post/${req.params.id}?status=error&message=Error updating post`);
//     }
// });

// // =======================
// // Delete Post
// // =======================
// router.delete('/delete-post/:id', authMiddleware, async (req, res) => {
//     try {
//         const post = await Post.findById(req.params.id);
//         if (!post) return res.redirect('/admin/dashboard?status=error&message=Post not found');

//         if (post.media) {
//             post.media.forEach(m => {
//                 const mediaPath = path.join(__dirname, '..', 'public', m.url);
//                 fs.unlink(mediaPath, err => { if (err) console.error('Failed to delete media:', err); });
//             });
//         }

//         await Post.findByIdAndDelete(req.params.id);
//         res.redirect('/admin/dashboard?status=success&message=Post deleted successfully');
//     } catch (err) {
//         console.error(err);
//         res.redirect('/admin/dashboard?status=error&message=Error deleting post');
//     }
// });

// // =======================
// // Analytics API
// // =======================
// router.get("/api/analytics", authMiddleware, async (req, res) => {
//     try {
//         const posts = await Post.find({});
//         const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);

//         const last7Days = [];
//         for (let i = 6; i >= 0; i--) {
//             const date = new Date();
//             date.setDate(date.getDate() - i);
//             last7Days.push(date.toISOString().split('T')[0]);
//         }

//         const siteVisitsData = await SiteVisit.find({ date: { $in: last7Days } });
//         const visitsMap = {};
//         siteVisitsData.forEach(v => { visitsMap[v.date] = v.count; });
//         const visitsByDay = last7Days.map(d => ({ _id: d, count: visitsMap[d] || 0 }));

//         visitsByDay.sort((a, b) => new Date(a._id) - new Date(b._id));

//         const last30Days = new Date();
//         last30Days.setDate(last30Days.getDate() - 30);
//         const totalSiteVisits = await SiteVisit.aggregate([
//             { $match: { date: { $gte: last30Days.toISOString().split('T')[0] } } },
//             { $group: { _id: null, total: { $sum: "$count" } } }
//         ]);

//         const siteVisits = totalSiteVisits.length > 0 ? totalSiteVisits[0].total : 0;
//         const today = new Date().toISOString().split('T')[0];
//         const todayVisit = await SiteVisit.findOne({ date: today });
//         const todayVisits = todayVisit ? todayVisit.count : 0;

//         res.json({ totalPosts: posts.length, totalViews, siteVisits, todayVisits, visitsByDay });
//     } catch (err) {
//         console.error("Analytics fetch failed:", err);
//         res.status(500).json({ error: "Analytics fetch failed" });
//     }
// });

// // =======================
// // Top Posts API
// // =======================
// router.get("/api/top-posts", authMiddleware, async (req, res) => {
//     try {
//         const topPosts = await Post.find({})
//             .sort({ views: -1 })
//             .limit(10)
//             .select('title views');
//         res.json(topPosts);
//     } catch (err) {
//         console.error("Failed to fetch top posts:", err);
//         res.status(500).json({ error: "Failed to fetch top posts" });
//     }
// });

// // =======================
// // Logout
// // =======================
// router.get('/logout', (req, res) => {
//     res.clearCookie('token');
//     res.redirect('/admin');
// });

// // =======================
// // Multer Error Handling
// // =======================
// router.use((error, req, res, next) => {
//     if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
//         return res.status(400).send('File too large. Maximum size is 50MB.');
//     } else if (error) {
//         return res.status(400).send(error.message);
//     }
//     next();
// });

// module.exports = router;