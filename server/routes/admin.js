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

const adminLayout = '../views/layouts/admin';
const loginLayout = '../views/layouts/login';
const jwtSecret = process.env.JWT_SECRET;


// =======================
// Multer Configuration
// =======================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
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
// Admin Login Page
// =======================
router.get('/', (req, res) => {
    res.render('admin/index', {
        locals: { title: 'Admin', description: 'Login/Register Page' },
        currentRoute: '/admin',
        layout: loginLayout
    });
});

// =======================
// Admin Registration Page
// =======================
router.get('/register', (req, res) => {
    res.render('admin/register', {
        locals: { title: 'Register', description: 'Register Admin' },
        currentRoute: '/admin/register',
        layout: loginLayout
    });
});

// =======================
// Admin Registration POST
// =======================
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.redirect('/admin?status=error&message=Username already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword });

        return res.redirect('/admin?status=success&message=Registered successfully');
    } catch (err) {
        console.error('Registration error:', err);
        return res.redirect('/admin?status=error&message=Registration failed');
    }
});

// =======================
// Admin Login POST
// =======================
router.post('/', async (req, res) => {
    const { username, password } = req.body;

    try {
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
        return res.redirect('/admin?status=error&message=Login failed');
    }
});

// =======================
// Admin Dashboard
// =======================
router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.render('admin/dashboard', {
            layout: adminLayout,
            locals: { title: 'Dashboard', description: 'Admin Dashboard' },
            data: posts,
            currentRoute: '/admin/dashboard'
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.redirect('/admin');
    }
});

// =======================
// Add Post Page
router.get('/add-post', authMiddleware, (req, res) => {
    res.render('admin/add-post', { 
        layout: adminLayout,  // ← Change from false to adminLayout
        locals: { title: 'Add Post', description: 'Create a new post' },
        currentRoute: '/admin/add-post'
    });
});

// =======================
// Add Post POST
// =======================
// Instead of upload.single('featuredMedia')
router.post('/add-post', authMiddleware, upload.array('featuredMedia', 10), async (req, res) => {
    try {
        const mediaFiles = req.files.map(file => ({
            url: '/uploads/' + file.filename,
            type: file.mimetype.startsWith('image/') ? 'image' : 'video'
        }));

        await Post.create({ 
            title: req.body.title,
            body: req.body.body,
            media: mediaFiles
        });

        res.redirect('/admin/dashboard?status=success&message=Post created successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/add-post?status=error&message=Error creating post');
    }
});

// =======================
// Edit Post Page
// =======================
router.get('/edit-post/:id', authMiddleware, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        res.render('admin/edit-post', {
            layout: adminLayout,  // ← Make sure this line is here
            locals: { title: 'Edit Post', description: 'Editing Post' },
            data: post,
            currentRoute: '/admin/edit-post'
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
});

// =======================
// Edit Post PUT
router.put('/edit-post/:id', authMiddleware, upload.single('featuredMedia'), async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.redirect(`/admin/edit-post/${req.params.id}?status=error&message=Post not found`);

        // Remove current media if requested
        if (req.body.removeMedia === 'true' && post.featuredImage) {
            const oldPath = path.join(__dirname, '..', 'public', post.featuredImage);
            fs.unlink(oldPath, err => { if (err) console.error(err); });
            post.featuredImage = null;
            post.mediaType = null;
        }

        // Add new uploaded file
        if (req.file) {
            // Delete old media if exists
            if (post.featuredImage) {
                const oldPath = path.join(__dirname, '..', 'public', post.featuredImage);
                fs.unlink(oldPath, err => { if (err) console.error(err); });
            }
            post.featuredImage = '/uploads/' + req.file.filename;
            post.mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
        }

        // Update text fields
        post.title = req.body.title;
        post.body = req.body.body;
        post.updatedAt = Date.now();

        await post.save();
        res.redirect(`/admin/edit-post/${req.params.id}?status=success&message=Post updated successfully`);
    } catch (err) {
        console.error(err);
        res.redirect(`/admin/edit-post/${req.params.id}?status=error&message=Error updating post`);
    }
});




router.delete('/delete-post/:id', authMiddleware, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.redirect('/admin/dashboard?status=error&message=Post not found');

        // Delete associated media if exists
        if (post.featuredImage) {
            const mediaPath = path.join(__dirname, '..', 'public', post.featuredImage);
            fs.unlink(mediaPath, (err) => {
                if (err) console.error('Failed to delete media:', err);
            });
        }

        await Post.findByIdAndDelete(req.params.id);
        res.redirect('/admin/dashboard?status=success&message=Post deleted successfully');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard?status=error&message=Error deleting post');
    }
});


// =======================
// Real-time Analytics API
// =======================
router.get("/api/analytics", authMiddleware, async (req, res) => {
    try {
        const posts = await Post.find({});
        const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);

        // last 7 days
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toISOString().split('T')[0]);
        }

        const siteVisitsData = await SiteVisit.find({
            date: { $in: last7Days }
        });

        const visitsMap = {};
        siteVisitsData.forEach(visit => {
            visitsMap[visit.date] = visit.count;
        });

        const visitsByDay = last7Days.map(date => ({
            _id: date,
            count: visitsMap[date] || 0
        }));

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

        res.json({
            totalPosts: posts.length,
            totalViews,
            siteVisits,
            todayVisits,
            visitsByDay
        });
    } catch (err) {
        console.error("Analytics fetch failed:", err);
        res.status(500).json({ error: "Analytics fetch failed" });
    }
});

// =======================
// Top Posts API
// =======================
router.get("/api/top-posts", authMiddleware, async (req, res) => {
    try {
        const topPosts = await Post.find({})
            .sort({ views: -1 })
            .limit(10)
            .select('title views');
        
        res.json(topPosts);
    } catch (err) {
        console.error("Failed to fetch top posts:", err);
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
// Error Handling Middleware for Multer
// =======================
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).send('File too large. Maximum size is 50MB.');
        }
    } else if (error) {
        return res.status(400).send(error.message);
    }
    next();
});

module.exports = router;
