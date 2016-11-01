/************************************/
/* 该文件由服务器生成，非本地include.js */
/************************************/

var loader__cache = [];

function loader__absURL(url) {
    var a = document.createElement('a');
    a.href = url;
    return a.href;
}

function loader__globalEval(js) {
    var doc = window.document;
    var node = doc.createElement('script'),
        root = doc.documentElement;

    node.text = js;
    root.appendChild(node);
    root.removeChild(node);
}

function loader__tinyGet(url, success) {
    var xhr = new XMLHttpRequest();

    // 改成false是同步请求，因此文件已经在本地因此不影响执行
    xhr.open('GET', url, false);

    xhr.onreadystatechange = function() {
        var status = xhr.status;

        if (xhr.readyState == 4 && ((status >= 200 && status < 300) || status == 304)) {
            success(xhr.responseText);
        }
    };

    xhr.send();
}

/* exported include__excute */
function include__excute(url) {
    return loader__tinyGet(url, compileTag);
    function compileTag(source) {
        return loader__globalEval(source);
    }
}

/* 屏蔽include */
/* exported include */
function include() {}

/* exported includeAll */
function includeAll(srcList) {
    var dirname = __dirname__,
        i,
        len;

    for (i = 0, len = srcList.length; i < len; i++) {
        var url = (srcList[i][0] != '/' ? dirname : '') + srcList[i];
        url = loader__absURL(url);
        if (loader__cache.indexOf(url) == -1) {
            loader__cache.push(url);
            if (/\.js(\?|$)/.test(url)) {
                document.write('<script src="' + url + '"></script>');
            } else if (/\.css(\?|$)/.test(url)) {
                document.head.insertAdjacentHTML('beforeEnd',
                    '<link type="text/css" rel="stylesheet" href="' + url + '">');
            }
        }
    }
}

var __dirname__ = '';

function main() {
    var $script = document.querySelector('script[data-module]'),
        dirname = $script.src.match(/.*\//)[0],
        module = $script.dataset.module,
        url;

    if (!module.match(/\.js$/)) {
        module = module + '/' + module + '.js';
    }
    url = (module[0] != '/' ? dirname : '') + '../' + module;
    // 保存__dirname__到全局，作为includeAll的入口目录
    __dirname__ = loader__absURL(url).match(/.*\//)[0]
    include__excute(url + '?__entry');
}

main();