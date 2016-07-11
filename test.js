var fs = require('fs');
var path = require('path');

var cwd = '/home/vagrant/duokan/phone-v3/src';
var filepath = '/home/vagrant/duokan/phone-v3/src/module/phone-css/css/new.css';

var cnt = fs.readFileSync(filepath, 'utf8');

cnt = replaceUrlInCSS(cnt, filepath, cwd);

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

console.log(cnt);
