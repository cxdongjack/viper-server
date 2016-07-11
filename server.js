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

var app = express();
var server = http.createServer(app);
var io = socketIO.listen(server);
var options = {};
var config = process.argv[2] || 'start.conf.js';
try {
    options = require(process.cwd() + '/' + config);
} catch(e) {
    config = undefined;
}
var cwd = process.cwd() + (options.entry ? '/' + options.entry : '');
var port = options.port || 6007;

console.log('cwd:', cwd, 'port:', port, 'config:', config);
server.listen(port);

// watch .js and .css files
watch(cwd, function(file) {
    if (!/\.js|\.css$/i.test(file)) {
        return;
    }
    var path = file.replace(cwd, '');
    console.log('file', file, 'changed', 'path:', path);
    io.sockets.emit('reload', path) //send a message to all clients
});

// 所有index.html注入socket相关脚本
app.use('**/index.html', function(req, res) {
    var filepath = cwd + req.baseUrl;
    var cnt = fs.readFileSync(filepath, 'utf8');
    var socketSnippet = fs.readFileSync(__dirname + '/socket.snippet', 'utf8');
    // 在</body>节点之前插入scoket脚本
    cnt = cnt.replace(/(\<\/body\>)|$/, socketSnippet + '$1')
    res.send(cnt);
});

// 所有all.js在服务器合并
app.use('**/all.js', function(req, res) {
    var filepath = cwd + req.baseUrl;
    var all = parseAllJS(filepath);
    var cnt = all.map(function(filepath) {
        var cnt = fs.readFileSync(filepath, 'utf8');
        // 如果在all.js包含css, 直接转换成js
        if (/css$/.test(filepath)) {
            cnt = "document.body.insertAdjacentHTML('beforeend', '<style>" + cnt + "</style>')";
            cnt = cnt.replace(/\n/g, '');
        }
        return cnt;
    }).join('\n\n');

    res.setHeader("Content-Type", "application/javascript");
    res.send(cnt);
});

function parseAllJS(filepath) {
    var deps = [];
    var include = function(list) {
        return list;
    };

    (function _readDeps(filepath) {
        var cnt = fs.readFileSync(filepath, 'utf8');
        if (cnt.indexOf('include([') === 0) {
            var files = eval(cnt);
            for (var i = 0, dep; dep = files[i]; i++) {
                _readDeps(path.dirname(filepath) + '/' + dep);
            }
        } else {
            deps.push(filepath);
        }
    })(filepath);

    return deps;
}

// 所有all.css在服务器合并
app.use('**/all.css', function(req, res) {
    var filepath = cwd + req.baseUrl;
    var all = parseAllCSS(filepath);
    var cnt = all.map(function(filepath) {
        var cnt = fs.readFileSync(filepath, 'utf8');
        return replaceUrlInCSS(cnt, filepath, cwd);
    }).join('\n\n');
    cnt = cnt.replace(/@import.*?\n/g, '');

    res.setHeader("Content-Type", "text/css");
    res.send(cnt);
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
            var match = line.match(/@import \"(.+)\"/);
            if (match) {
                ret.push(match[1]);
            }
        });
        return ret;
    }

    (function _readDeps(filepath) {
        var paths = getPath(fs.readFileSync(filepath, 'utf8'));
        if (paths.length) {
            for (var i = 0, dep; dep = paths[i]; i++) {
                _readDeps(path.dirname(filepath) + '/' + dep);
            }
        }
        deps.push(filepath);
    })(filepath);

    return deps;
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
                var bypassUrl = proxyConfig.bypass(req, res, proxyConfig) || false;

                if (bypassUrl) {
                    req.url = bypassUrl;
                }
            }

            next();
        }, httpProxyMiddleware(context, proxyConfig));
    });
}
