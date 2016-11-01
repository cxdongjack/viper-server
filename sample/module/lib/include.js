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

function loader__template(tmpl) {
    function unescape(code) {
        return code.replace(/\\('|\\)/g, "$1").replace(/[\r\t\n]/g, " ");
    }
    var c = {
        func : /{{#\s*([\w$]+)\s*(\([^)]*\)|)\s*}}([\s\S]*?){{#}}/g,
        evaluate:    /\{\{([\s\S]+?(\}?)+)\}\}/g,
        interpolate: /\{\{=([\s\S]+?)\}\}/g,
        conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
        iterate:     /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
    };
    var cse = {
        start: "'+(",
        end: ")+'"
    }, sid = 0, indv;

    // 只替换{{#func()}}{{#}}里面的内容
    tmpl = tmpl.replace(c.func, function(m, def, args, str) {
        // 转译特殊字符，在html拼接的时候出现语法错误
        str = str.replace(/('|\\)/g, '\\$1')
        // 干掉所有空白符, 通过连字符解决，保持文件格式
        //str = str.replace(/(^|\r|\n)\t* +| +\t*(\r|\n|$)/g,"")
            //.replace(/\r|\n|\t/g,"")
        // 拼接方法名
        str = "function " + def + (args || "{}") + " {var out='" + str;
        // 替换各种标志符
        str = str
            .replace(c.interpolate, function(m, code) {
                return cse.start + unescape(code) + cse.end;
            })
            .replace(c.conditional, function(m, elsecase, code) {
                return elsecase ?
                    (code ? "';}else if(" + unescape(code) + ") {out+='" : "';}else {out+='") :
                    (code ? "';if(" + unescape(code) + ") {out+='" : "';}out+='");
            })
            .replace(c.iterate, function(m, iterate, vname, iname) {
                if (!iterate) return "';} } out+='";
                sid+=1; indv=iname || "i"+sid; iterate=unescape(iterate);
                return "';var arr"+sid+"="+iterate+";if(arr"+sid+") {var "+vname+","+indv+"=-1,l"+sid+"=arr"+sid+".length-1;while("+indv+"<l"+sid+") {"
                    +vname+"=arr"+sid+"["+indv+"+=1];out+='";
            })
            .replace(c.evaluate, function(m, code) {
                // 因为此处是js, 所以需要将特殊字符转回来
                return "';" + unescape(code) + "out+='";
            })
            .replace(/(\s|;|\}|^|\{)out\+='';/g, "$1").replace(/\+''/g, "");
        // 拼接方法结尾
        str = str + "';return out;}";
        // 把所有字符串链接起来, 并且保持行数不变
        str = str.replace(/(\r|\n|\r\n)/g, '\\\n');
        return str;
    });
    return tmpl;
}

/* exported include__excute */
function include__excute(url) {
    return loader__tinyGet(url, compileTag);
    function compileTag(source) {
        return loader__globalEval(loader__template(source));
    }
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
        if (loader__cache.indexOf(url) == -1) {
            loader__cache.push(url);
            if (/\.(tpl|vp|js)$/.test(url)) {
                // vp/js实质上并不会发请求，主要提供定位的功能
                document.write('\
                    <script type="vp/js" src="' + url + '"></script>\
                    <script>include__excute("' + url + '")</script>');
            } else if (/\.css$/.test(url)) {
                document.head.insertAdjacentHTML('beforeEnd',
                    '<link type="text/css" rel="stylesheet" href="' + url + '">');
            }
        }
    }
}

function main() {
    var $script = document.querySelector('script[data-module]'),
        module = $script.dataset.module;
    if (!module.match(/\.js$/)) {
        module = module + '/' + module + '.js';
    }
    include(['../' + module]);
}

main();
