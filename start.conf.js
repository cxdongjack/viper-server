module.exports = {
    entry : 'src',
    port : 6007,
    proxy : {
        '/': {
            target: 'http://www.duokan.com',
        }
    }
};


