/**
 *  inspired by
 *  http://blog.geekingfrog.com/custom-livereload-with-express-and-socket-io/
 */
var fs = require('fs');
var path = require('path');
var http = require('http');
var express = require('express');
var socketIO = require('socket.io');
var httpProxyMiddleware = require("http-proxy-middleware");
var watch = require('node-watch');
var tmpl = require("./tmpl");
var file = require("./file");
var parser = require("./parser");

var app = express();
var server = http.createServer(app);
var io = socketIO.listen(server);
var options = {};
var config = process.argv[2] || 'start.conf.js';
try {
    options = require(process.cwd() + '/' + config);
} catch(e) {
    config = undefined;
    options.proxy = process.argv[3] && {'/' : process.argv[3]};
    options.port = process.argv[2];
}
var cwd = process.cwd() + (options.entry ? '/' + options.entry : '');
var port = options.port || 6007;
// 禁止并行加载(在服务端预先转译JS文件)
var disableParallel = options.disableParallel || process.argv[4];

console.log('cwd:', cwd, 'port:', port, 'config:', config);
server.listen(port);

options.watch = options.watch || {};
var watching = options.watch;
// watch .js and .css files
watching[cwd] = /\.js|\.css|\.html$/i;
Object.keys(watching).forEach(function(dir) {
    watchDir(dir, watching[dir]);
});

function watchDir(dir, regexp, throttle) {
    console.log('Watching ' + dir, 'with ' + regexp);
    watch(dir, Function__throttle(function(file) {
        if (!regexp.test(file)) {
            return;
        }

        var path = file.replace(cwd, '');
        console.log('file', file, 'changed', 'path:', path);
        io.sockets.emit('reload', path) //send a message to all clients
    }, throttle || 100));
}

// 所有index.html注入socket相关脚本
function injectWatcher(req, res) {
    var filepath = cwd + req.baseUrl;
    var cnt = fs.readFileSync(filepath, 'utf8');
    var socketSnippet = fs.readFileSync(__dirname + '/socket.snippet', 'utf8');
    // 在</body>节点之前插入scoket脚本
    cnt = cnt.replace(/(\<\/body\>)|$/, socketSnippet + '$1')
    res.send(cnt);
};

app.use('**/index.html', injectWatcher);
app.use('**/test.html', injectWatcher);

// 所有all.js在服务器合并
app.use('**/all.js', function(req, res, next) {
    // 只有__combo才触发合并
    if (!/__combo/.test(req.originalUrl)) {
        return next();
    }

    var filepath = cwd + req.baseUrl;
    if (!fs.existsSync(filepath)) {
        return next();
    }
    var all = parseAllJS(filepath);

    var cnt = all.filter(function(filepath) {
        // 忽略all.js中包含的css文件
        return /\.js$/.test(filepath);
    }).map(function(filepath) {
        return fs.readFileSync(path.normalize(filepath), 'utf8');
    }).join('\n\n');

    var hasCss = all.find(function(filepath) {
        return /\.css$/.test(filepath);
    });
    if (hasCss) {
        var allCSS = req.baseUrl.replace(/\.js$/, '.css');
        cnt = `
/* 自动生成请勿修改 */
var hasCSS = [].filter.call(document.querySelectorAll('link[href]'), function(el) {
    return /css\\?__combo/.test(el.href);
})[0];

if (!hasCSS) {
    document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="${allCSS}?__combo">');
}
/* @自动生成请勿修改 */

` + cnt;
    }

    res.setHeader("Content-Type", "application/javascript");
    res.send(cnt);
});

function parseAllJS(filepath) {
    var _cache = [];
    var deps = [];
    var include = function(list) {
        return list;
    };

    (function _readDeps(filepath) {
        if (_cache.indexOf(filepath) !== -1) {
            return;
        }
        _cache.push(filepath);
        var cnt = fs.readFileSync(filepath, 'utf8');
        if (cnt.indexOf('include([') === 0) {
            var files = eval(cnt);
            for (var i = 0, dep; dep = files[i]; i++) {
                _readDeps(file.abspath(dep, path.dirname(filepath)));
            }
        } else {
            deps.push(filepath);
        }
    })(filepath);

    return deps;
}

// 所有all.css在服务器合并
app.use('**/all.css', function(req, res, next) {
    // 只有__combo才触发合并
    if (!/__combo/.test(req.originalUrl)) {
        return next();
    }

    var cssFilepath = cwd + req.baseUrl;
    var jsFilepath = cssFilepath.replace(/\.css$/, '.js');

    if (!fs.existsSync(cssFilepath) && !fs.existsSync(jsFilepath)) {
        return next();
    }

    var cssPaths = [];
    // 由all.css引用的样式表
    if (fs.existsSync(cssFilepath)) {
        cssPaths = cssPaths.concat(parseAllCSS(cssFilepath));
    }

    // 提取all.js中包含的css文件
    if (fs.existsSync(jsFilepath)) {
        cssPaths = cssPaths.concat(parseAllJS(jsFilepath).filter(function(filepath) {
            return /\.css$/.test(filepath);
        }));
    }

    // 排重
    cssPaths = cssPaths.map(path.normalize).filter(function(value, index, arr) {
        return arr.indexOf(value) === index;
    });

    // 合并内容
    var cssCnt = cssPaths.map(function(filepath) {
        var cnt = fs.readFileSync(path.normalize(filepath), 'utf8');
        return replaceUrlInCSS(cnt, filepath, cwd);
    }).join('\n\n').replace(/@import.*?\n/g, '');

    res.setHeader("Content-Type", "text/css");
    res.send(cssCnt);
});

function replaceUrlInCSS(cnt, filepath, cwd) {
    return cnt.replace(/url\((.+?)\)/g, function(match, url) {
      url = url.replace(/'|"/g, '');
      if (!/^http/.test(url)) {
        url = redirectUrl(filepath, url, cwd);
      }
      return 'url(' + url + ')';
    });
}

function redirectUrl(filepath, url, base) {
    var absUrl = path.dirname(filepath) + '/' + url;
    return absUrl.replace(base, '');
}

function parseAllCSS(filepath) {
    var deps = [];

    function getPath(cnt) {
        var lines = cnt.split('\n');
        var ret = [];
        lines.forEach(function(line) {
            var match = line.match(/@import (["'])([^'"]+)\1/);
            if (match) {
                ret.push(match[2]);
            }
        });
        return ret;
    }

    (function _readDeps(filepath) {
        var paths = getPath(fs.readFileSync(path.normalize(filepath), 'utf8'));
        if (paths.length) {
            for (var i = 0, dep; dep = paths[i]; i++) {
                _readDeps(path.dirname(filepath) + '/' + dep);
            }
        }
        deps.push(filepath);
    })(filepath);

    return deps;
}

// 启动加速, 服务器端转译文件
if (!disableParallel) {
    app.use('**/include.js', speedUpIncludeJs);
    app.use('**/lib/all.js', speedUpLibJs);
    app.use('**/*.js', speedUpJs);
}

// 启动静态服务
app.use(express.static(cwd));

// 启动代理服务
//https://webpack.github.io/docs/webpack-dev-server.html
//https://github.com/webpack/webpack-dev-server/blob/master/lib/Server.js
//https://github.com/nodejitsu/node-http-proxy
if (options.proxy) {
    if (typeof options.proxy === 'string') {
        options.proxy = [{
            context: options.proxy
        }];
    }
    if (!Array.isArray(options.proxy)) {
        options.proxy = Object.keys(options.proxy).map(function(context) {
            var proxyOptions;
            var correctedContext = context.replace(/\/\*$/, "");

            if (typeof options.proxy[context] === 'string') {
                proxyOptions = {
                    context: correctedContext,
                    target: options.proxy[context]
                };
            } else {
                proxyOptions = options.proxy[context];
                proxyOptions.context = correctedContext;
            }

            return proxyOptions;
        });
    }

    options.proxy.forEach(function(proxyConfig) {
        var context = proxyConfig.context || proxyConfig.path;
        // 默认打开changeOrigin
        if (proxyConfig.changeOrigin === undefined) {
            proxyConfig.changeOrigin = true;
        }

        app.use(function(req, res, next) {
            if (typeof proxyConfig.bypass === 'function') {
                proxyConfig.bypass(req, res, next, proxyConfig);
                return;
            }

            next();
        }, httpProxyMiddleware(context, proxyConfig));
    });
}

//--- helper ----------------------------------------------
function Function__throttle(func, wait) {
    var context, args, result;
    var previous = 0;
    return function() {
        var now = new Date();
        var remaining = wait - (now - previous);
        context = this;
        args = arguments;
        if (remaining <= 0) {
            previous = now;
            result = func.apply(context, args);
        }
        return result;
    };
}

// include.js使用服务器端版本
function speedUpIncludeJs(req, res, next) {
    res.send(fs.readFileSync(__dirname + '/include.js', 'utf8'));
}

// 合并lib/all.js
function speedUpLibJs(req, res, next) {
    var filepath = cwd + req.baseUrl;
    if (!fs.existsSync(filepath)) {
        return next();
    }
    var all = parseAllJS(filepath);

    var cnt = all.filter(function(filepath) {
        // 忽略all.js中包含的css文件
        return /\.js$/.test(filepath);
    }).map(function(filepath) {
        return fs.readFileSync(path.normalize(filepath), 'utf8');
    }).join('\n\n');

    res.send(cnt);
}

// *.js在服务器端转译
function speedUpJs(req, res, next) {
    var filepath = cwd + req.baseUrl;

    if (!/__file/.test(req.originalUrl)) {
        var entry = generateEntry(filepath);
        if (entry) {
            return res.send(entry);
        }
    }

    if (!fs.existsSync(filepath)) {
        return next();
    }

    var cnt = tmpl(fs.readFileSync(path.normalize(filepath), 'utf8'));

    res.send(cnt);
}

// *.js在服务器排序, 构建一个入口文件
function generateEntry(filepath) {
    var fileCnt = file.read(filepath);
    var includes = parser.parse(fileCnt);
    var allIncludes = [];
    var dirname = path.dirname(filepath);
    if (includes)  {

        allIncludes = parser.parseRecursive(filepath);
        allIncludes = allIncludes.map(function(includePath) {
            return path.relative(dirname, includePath);
        });
        // 特殊逻辑，合并lib/下的文件, 为lib/all.js
        allIncludes = allIncludes.filter(function(includePath) {
            return !(includePath.match(/\/lib\/.*\.js$/) && !includePath.match(/\/lib\/all\.js$/));
        });

        // 返回一个include文件
        return 'include(' + JSON.stringify(allIncludes) + ')';
    }
}
