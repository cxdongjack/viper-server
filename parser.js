var fs = require('fs');
var path = require('path');
var file = require('./file.js');


function parseIncluded(cnt) {
    var include = function(list) {
        return list;
    };
    var match = cnt.match(/include\s*\([\s\S]+?\)/);
    if (!match) {
        return;
    }
    return eval(match[0]);
}

function parseAllJS(filepath) {
    var _cache = [];
    var deps = [];

    (function _readDeps(filepath) {
        if (_cache.indexOf(filepath) !== -1) {
            return;
        }
        _cache.push(filepath);
        var cnt = fs.readFileSync(filepath, 'utf8');
        var files = parseIncluded(cnt);
        if (files) {
            for (var i = 0, dep; dep = files[i]; i++) {
                _readDeps(file.abspath(dep, path.dirname(filepath)));
            }
        }
        deps.push(filepath);
    })(filepath);

    return deps;
}


// console.log(parseAllJS('./sample/test.js'));

exports.parseRecursive = parseAllJS;
exports.parse = parseIncluded;
