let visitsChart;
let currentTab = 'analytics';

function showTab(tab) {
    currentTab = tab;
    document.getElementById('analyticsTab').style.display = tab === 'analytics' ? 'block' : 'none';
    document.getElementById('postsTab').style.display = tab === 'posts' ? 'block' : 'none';

    document.getElementById('analyticsTabBtn').classList.toggle('active', tab === 'analytics');
    document.getElementById('postsTabBtn').classList.toggle('active', tab === 'posts');
}

async function fetchAnalytics() {
    try {
        const res = await fetch("/admin/api/analytics");
        const data = await res.json();

        document.getElementById("totalPosts").innerText = data.totalPosts.toLocaleString();
        document.getElementById("totalViews").innerText = data.totalViews.toLocaleString();
        document.getElementById("siteVisits").innerText = data.siteVisits.toLocaleString();
        document.getElementById("todayVisits").innerText = data.todayVisits.toLocaleString();

        const labels = data.visitsByDay.map(v => new Date(v._id).toLocaleDateString('en-US', { month:'short', day:'numeric' }));
        const counts = data.visitsByDay.map(v => v.count);

        if (!visitsChart) {
            const ctx = document.getElementById("visitsChart").getContext("2d");
            visitsChart = new Chart(ctx, {
                type: "line",
                data: { labels, datasets: [{ label: "Daily Visits", data: counts, borderColor: "#4e9af1", backgroundColor: "rgba(78,154,241,0.2)", tension: 0.3, fill: true, borderWidth: 2, pointRadius: 4, pointBackgroundColor: "#4e9af1" }] },
                options: { responsive:true, plugins:{legend:{labels:{color:"#fff"}}}, scales:{x:{ticks:{color:"#fff"},grid:{color:"rgba(255,255,255,0.1)"}},y:{ticks:{color:"#fff"},grid:{color:"rgba(255,255,255,0.1)"},beginAtZero:true}} }
            });
        } else {
            visitsChart.data.labels = labels;
            visitsChart.data.datasets[0].data = counts;
            visitsChart.update();
        }

        fetchTopPosts();
    } catch (err) {
        console.error("Failed to load analytics:", err);
    }
}

async function fetchTopPosts() {
    try {
        const res = await fetch("/admin/api/top-posts");
        const topPosts = await res.json();
        const topPostsList = document.getElementById('topPostsList');
        topPostsList.innerHTML = '';

        topPosts.slice(0,5).forEach((post, idx) => {
            const div = document.createElement('div');
            div.innerHTML = `<span>${idx+1}. ${post.title}</span><span>${post.views.toLocaleString()} views</span>`;
            div.style.display = "flex"; div.style.justifyContent = "space-between"; div.style.padding="8px 0"; div.style.borderBottom="1px solid rgba(255,255,255,0.1)";
            topPostsList.appendChild(div);
        });
    } catch (err) {
        console.error("Failed to load top posts:", err);
    }
}

// Sort posts
document.getElementById('sortPosts').addEventListener('change', function(){
    const posts = Array.from(document.querySelectorAll('#postsList li'));
    const sortBy = this.value;
    posts.sort((a,b)=>{
        if(sortBy==='recent') return new Date(b.dataset.date) - new Date(a.dataset.date);
        if(sortBy==='oldest') return new Date(a.dataset.date) - new Date(b.dataset.date);
        if(sortBy==='views') return b.dataset.views - a.dataset.views;
    });
    posts.forEach(p=>document.getElementById('postsList').appendChild(p));
});

// Initial fetch
fetchAnalytics();
setInterval(fetchAnalytics, 30000); // fetch every 30s
