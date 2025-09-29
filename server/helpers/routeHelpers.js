function isActiveRoute(route, currentRoute) {
    return route === currentRoute ? 'active' : '';
}

module.exports = { isActiveRoute };

// function isActiveRoute(route, currentRoute) {
//     return route === currentRoute ? 'active' : '';
// }

// module.exports = { isActiveRoute}