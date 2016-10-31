/************************************/
/* 该文件由服务器生成，非本地include.js */
/************************************/

var loader__cache = [];

function loader__absURL(url) {
    var a = document.createElement('a');
    a.href = url;
    return a.href;
}

/* exported include */
function include(srcList) {
    // 纯前端加载的弊端在于，无法直接在控制台加断点
    // 解决方案：自建服务器上直接js的转译工作
    var scripts = document.querySelectorAll('script[src]'),
        dirname = scripts[scripts.length - 1].src.match(/.*\//)[0],
        i,
        len;

    for (i = 0, len = srcList.length; i < len; i++) {
        var url = (srcList[i][0] != '/' ? dirname : '') + srcList[i];
        url = loader__absURL(url);
        // 打上file的标记，和入口文件区别开
        url += '?__file';
        if (loader__cache.indexOf(url) == -1) {
            loader__cache.push(url);
            if (/\.(tpl|vp|js)(\?|$)/.test(url)) {
                // vp/js实质上并不会发请求，主要提供定位的功能
                document.write('\
                    <script src="' + url + '"></script>\
                    ');
            } else if (/\.css(\?|$)/.test(url)) {
                document.head.insertAdjacentHTML('beforeEnd',
                    '<link type="text/css" rel="stylesheet" href="' + url + '">');
            }
        }
    }

    // 屏蔽include
    include = function() {}
}

