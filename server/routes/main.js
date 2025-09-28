const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const SiteVisit = require('../models/Sitevisit');


// Helper function to track site visits
async function trackSiteVisit() {
    try {
        const today = new Date().toISOString().split('T')[0];
        await SiteVisit.findOneAndUpdate(
            { date: today },
            { $inc: { count: 1 }, lastUpdated: new Date() },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('⚠️ SiteVisit tracking failed:', error.message);
    }
}

/*
Get
/ Home
*/
router.get('', async (req, res) => {
    try {
        // Track site visit for homepage
        await trackSiteVisit();

        const locals = {
            title: "Oluwaseye's Blog",
            description: "Simple Blog Created with NodeJs, Express, and Mongodb"
        }

        let perPage = 10;
        let page = req.query.page || 1;

        const data = await Post.aggregate([{ $sort: { createdAt: -1 } }])
            .skip(perPage * page - perPage)
            .limit(perPage)
            .exec();

        const count = await Post.countDocuments();
        const nextPage = parseInt(page) + 1;
        const hasNextPage = nextPage <= Math.ceil(count / perPage);

        res.render('index', {
            locals,
            data,
            current: page,
            nextPage: hasNextPage ? nextPage : null,
            currentRoute: '/'
        });
    } catch (error) {
        console.log(error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'There was an error loading the homepage.',
            currentRoute: '/'
        });
    }
});

/*
Get
Post: Id
*/
router.get('/post/:id', async (req, res) => {
    try {
        let slug = req.params.id;

        // Validate if slug is a valid MongoDB ObjectId
        if (!slug.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(404).render('404', {
                title: 'Post Not Found',
                message: 'Invalid post ID format.',
                currentRoute: '/'
            });
        }

        const data = await Post.findById(slug);

        // NULL CHECK
        if (!data) {
            return res.status(404).render('404', {
                title: 'Post Not Found',
                message: 'The post you are looking for does not exist.',
                currentRoute: '/'
            });
        }

        // Increment post views
        await Post.findByIdAndUpdate(slug, { $inc: { views: 1 } });

        // Track site visit for post page
        await trackSiteVisit();

        const locals = {
            title: data.title,
            description: data.body ? data.body.substring(0, 160) : "Simple Blog Created with NodeJs, Express, and Mongodb"
        }

        res.render('post', {
            locals,
            data,
            currentRoute: `/post/${slug}`
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'There was an error loading the post.',
            currentRoute: '/'
        });
    }
});

// ... rest of your main.js routes remain the same

/***
 * Post /
 * Post - searchTerm
 */
router.post('/search', async (req, res) => {
    try {
        const locals = {
            title: "Search",
            description: "Simple Blog Created with NodeJs, Express, and Mongodb"
        }

        let searchTerm = req.body.searchTerm || "";
        const searchNoSpecialChar = searchTerm.replace(/[^a-zA-Z0-9 ]/g, "").trim();

        const data = await Post.find({
            $or: [
                { title: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
                { body: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
            ]
        });

        res.render("search", {
            data,
            locals,
            currentRoute: '/search'
        })
    } catch (error) {
        console.log(error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'There was an error performing the search.',
            currentRoute: '/'
        });
    }
})

/* Routes for about and contact page */
router.get('/about', (req, res) => {
    res.render('about', {
        currentRoute: '/about'
    })
})

router.get('/contact', (req, res) => {
    res.render('contact', {
        currentRoute: '/contact'
    })
})

module.exports = router;