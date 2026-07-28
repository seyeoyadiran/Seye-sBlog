const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const SiteVisit = require('../models/Sitevisit');
const mediaStore = require('../helpers/mediaStore');

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

// Database connection check helper
function checkDBConnection(req, res) {
    if (!req.dbConnected) {
        res.status(503).render('error', {
            title: 'Service Unavailable',
            message: 'Database service is temporarily unavailable. Please try again later.',
            currentRoute: req.path
        });
        return false;
    }
    return true;
}

/*
Get
/media/:id — serve uploaded media stored in MongoDB (GridFS)
*/
router.get('/media/:id', async (req, res) => {
    try {
        if (!req.dbConnected) return res.status(503).send('Database service unavailable');
        await mediaStore.sendFile(req.params.id, res);
    } catch (err) {
        console.error('Media fetch failed:', err.message);
        res.status(404).send('Media not found');
    }
});

/*
Get
/ Home
*/
router.get('/', async (req, res) => {
    try {
        // Check database connection first
        if (!checkDBConnection(req, res)) return;

        await trackSiteVisit();

        const locals = {
            title: "Oluwaseye's Blog",
            description: "Simple Blog Created with NodeJs, Express, and Mongodb"
        };

        const perPage = 10;
        const page = parseInt(req.query.page) || 1;

        // Use find() instead of aggregate for better performance in serverless
        const data = await Post.find({})
            .sort({ createdAt: -1 })
            .skip(perPage * (page - 1))
            .limit(perPage)
            .lean(); // Use lean() for better performance

        const count = await Post.countDocuments();
        const nextPage = page + 1;
        const hasNextPage = nextPage <= Math.ceil(count / perPage);

        res.render('index', {
            locals,
            data,
            current: page,
            nextPage: hasNextPage ? nextPage : null,
            currentRoute: '/'
        });
    } catch (error) {
        console.error('⚠️ Homepage error:', error);
        
        // Handle specific database errors
        if (error.name === 'MongoNetworkError' || error.name === 'MongooseError') {
            return res.status(503).render('error', {
                title: 'Service Unavailable',
                message: 'Database service is temporarily unavailable. Please try again later.',
                currentRoute: '/'
            });
        }
        
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
        // Check database connection first
        if (!checkDBConnection(req, res)) return;

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
        };

        res.render('post', {
            locals,
            data,
            currentRoute: `/post/${slug}`
        });
    } catch (error) {
        console.log(error);
        
        // Handle specific database errors
        if (error.name === 'MongoNetworkError' || error.name === 'MongooseError') {
            return res.status(503).render('error', {
                title: 'Service Unavailable',
                message: 'Database service is temporarily unavailable. Please try again later.',
                currentRoute: '/post/' + req.params.id
            });
        }
        
        res.status(500).render('error', {
            title: 'Error',
            message: 'There was an error loading the post.',
            currentRoute: '/'
        });
    }
});

/***
 * Post /
 * Post - searchTerm
 */
router.post('/search', async (req, res) => {
    try {
        // Check database connection first
        if (!checkDBConnection(req, res)) return;

        const locals = {
            title: "Search",
            description: "Simple Blog Created with NodeJs, Express, and Mongodb"
        };

        let searchTerm = req.body.searchTerm || "";
        const searchNoSpecialChar = searchTerm.replace(/[^a-zA-Z0-9 ]/g, "").trim();

        const data = await Post.find({
            $or: [
                { title: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
                { body: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
            ]
        }).lean(); // Use lean() for better performance

        res.render("search", {
            data,
            locals,
            currentRoute: '/search'
        });
    } catch (error) {
        console.log(error);
        
        // Handle specific database errors
        if (error.name === 'MongoNetworkError' || error.name === 'MongooseError') {
            return res.status(503).render('error', {
                title: 'Service Unavailable',
                message: 'Database service is temporarily unavailable. Please try again later.',
                currentRoute: '/search'
            });
        }
        
        res.status(500).render('error', {
            title: 'Error',
            message: 'There was an error performing the search.',
            currentRoute: '/'
        });
    }
});

/* Routes for about and contact page */
router.get('/about', async (req, res) => {
    try {
        // About page doesn't need database, but track visits if available
        if (req.dbConnected) {
            await trackSiteVisit();
        }
        
        res.render('about', {
            currentRoute: '/about'
        });
    } catch (error) {
        console.error('About page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'There was an error loading the about page.',
            currentRoute: '/about'
        });
    }
});

router.get('/contact', async (req, res) => {
    try {
        // Contact page doesn't need database, but track visits if available
        if (req.dbConnected) {
            await trackSiteVisit();
        }
        
        res.render('contact', {
            currentRoute: '/contact'
        });
    } catch (error) {
        console.error('Contact page error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'There was an error loading the contact page.',
            currentRoute: '/contact'
        });
    }
});

module.exports = router;
// const express = require('express');
// const router = express.Router();
// const Post = require('../models/Post');
// const SiteVisit = require('../models/Sitevisit');


// // Helper function to track site visits
// async function trackSiteVisit() {
//     try {
//         const today = new Date().toISOString().split('T')[0];
//         await SiteVisit.findOneAndUpdate(
//             { date: today },
//             { $inc: { count: 1 }, lastUpdated: new Date() },
//             { upsert: true, new: true }
//         );
//     } catch (error) {
//         console.error('⚠️ SiteVisit tracking failed:', error.message);
//     }
// }

// /*
// Get
// / Home
// */
// router.get('/', async (req, res) => {
//     try {
//       await trackSiteVisit();
  
//       const locals = {
//         title: "Oluwaseye's Blog",
//         description: "Simple Blog Created with NodeJs, Express, and Mongodb"
//       };
  
//       const perPage = 10;
//       const page = parseInt(req.query.page) || 1;
  
//       const data = await Post.aggregate([{ $sort: { createdAt: -1 } }])
//         .skip(perPage * (page - 1))
//         .limit(perPage);
  
//       const count = await Post.countDocuments();
//       const nextPage = page + 1;
//       const hasNextPage = nextPage <= Math.ceil(count / perPage);
  
//       res.render('index', {
//         locals,
//         data,
//         current: page,
//         nextPage: hasNextPage ? nextPage : null,
//         currentRoute: '/'
//       });
//     } catch (error) {
//       console.error('⚠️ Homepage error:', error);
//       res.status(500).render('error', {
//         title: 'Error',
//         message: 'There was an error loading the homepage.',
//         currentRoute: '/'
//       });
//     }
//   });
  

// /*
// Get
// Post: Id
// */
// router.get('/post/:id', async (req, res) => {
//     try {
//         let slug = req.params.id;

//         // Validate if slug is a valid MongoDB ObjectId
//         if (!slug.match(/^[0-9a-fA-F]{24}$/)) {
//             return res.status(404).render('404', {
//                 title: 'Post Not Found',
//                 message: 'Invalid post ID format.',
//                 currentRoute: '/'
//             });
//         }

//         const data = await Post.findById(slug);

//         // NULL CHECK
//         if (!data) {
//             return res.status(404).render('404', {
//                 title: 'Post Not Found',
//                 message: 'The post you are looking for does not exist.',
//                 currentRoute: '/'
//             });
//         }

//         // Increment post views
//         await Post.findByIdAndUpdate(slug, { $inc: { views: 1 } });

//         // Track site visit for post page
//         await trackSiteVisit();

//         const locals = {
//             title: data.title,
//             description: data.body ? data.body.substring(0, 160) : "Simple Blog Created with NodeJs, Express, and Mongodb"
//         }

//         res.render('post', {
//             locals,
//             data,
//             currentRoute: `/post/${slug}`
//         });
//     }
//     catch (error) {
//         console.log(error);
//         res.status(500).render('error', {
//             title: 'Error',
//             message: 'There was an error loading the post.',
//             currentRoute: '/'
//         });
//     }
// });

// // ... rest of your main.js routes remain the same

// /***
//  * Post /
//  * Post - searchTerm
//  */
// router.post('/search', async (req, res) => {
//     try {
//         const locals = {
//             title: "Search",
//             description: "Simple Blog Created with NodeJs, Express, and Mongodb"
//         }

//         let searchTerm = req.body.searchTerm || "";
//         const searchNoSpecialChar = searchTerm.replace(/[^a-zA-Z0-9 ]/g, "").trim();

//         const data = await Post.find({
//             $or: [
//                 { title: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
//                 { body: { $regex: new RegExp(searchNoSpecialChar, 'i') } },
//             ]
//         });

//         res.render("search", {
//             data,
//             locals,
//             currentRoute: '/search'
//         })
//     } catch (error) {
//         console.log(error);
//         res.status(500).render('error', {
//             title: 'Error',
//             message: 'There was an error performing the search.',
//             currentRoute: '/'
//         });
//     }
// })

// /* Routes for about and contact page */
// router.get('/about', (req, res) => {
//     res.render('about', {
//         currentRoute: '/about'
//     })
// })

// router.get('/contact', (req, res) => {
//     res.render('contact', {
//         currentRoute: '/contact'
//     })
// })

// module.exports = router;