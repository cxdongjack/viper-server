module.exports = {
    entry : '',
    port : 6002,
    //disableParallel : 1,
    proxy : {
        '/': {
            target: 'http://127.0.0.1:6004',
            secure: false,
            bypass: function(req, res, next, proxyOptions) {
                if (req.url.match(/^\/hs\/(feed|home|search|book|prefer|market|user|comment)(\/.*)?/)) {
                    res.redirect('/src/app/phone/index.html?' + req.url);
                    return;
                }

                next();
            }
        }
    }
};
