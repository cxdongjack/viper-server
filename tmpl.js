function loader__template(tmpl) {
    function unescape(code) {
        return code.replace(/\\('|\\)/g, "$1").replace(/[\r\t\n]/g, " ");
    }
    var c = {
        func :       /{{#\s*([\w$]+)\s*(\([^)]*\)|)\s*}}([\s\S]*?){{#}}/g,
        evaluate:    /\{\{([\s\S]+?(\}?)+)\}\}/g,
        interpolate: /\{\{=([\s\S]+?)\}\}/g,
        conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
        transclude:  /\{\{\-(\-)?\s*([\s\S]*?)\s*\}\}/g,
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
        str = "function " + def + (args || "()") + " {var out='" + str;
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
            .replace(c.transclude, function(m, elsecase, code) {
                function formatCode() {
                    if (!/\)$/.test(code)) {
                        // {{-page}}, 无argsBody
                        code = code + '(';
                    } else if (/\(\s*\)$/.test(code)) {
                        // {{-bem(page)()}}, 有body, 但是最后一个是空括号
                        code = code.substr(0, code.length - 1);
                    } else {
                        // {{-bem(page)(1)}}, 有body, 也有内容
                        code = code.substr(0, code.length - 1) + ',';
                    }
                    return code;
                }
                return elsecase ?
                    "';return out;})(), (function() {var out='';out+='":
                    (code ? "';out+=" + unescape(formatCode()) + "(function() {var out=''; out+='" : "';return out;})());out+='");
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

module.exports = loader__template;
