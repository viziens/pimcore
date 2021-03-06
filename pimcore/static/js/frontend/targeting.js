/*global user,util,google,localStorage*/
(function () {

    /**
     * get parameters and global variables used by this javascript
     *
     * _ptr -> redirect action (GET)
     * _ptc -> programmatically redirect action (GET)
     * _ptp -> persona variant of document page (GET)
     */

    /* TESTS */
    var tests = {
        url: function (params) {
            var regexp = new RegExp(params["url"]);
            if(regexp.test(window.location.href)) {
                return true;
            }
            return false;
        },

        browser: function (params) {
            if(params["browser"] == user["environment"]["browser"]) {
                return true;
            }
            return false;
        },

        country: function (params) {
            if(user["location"] &&
                util.toString(params["country"]).toLowerCase()
                                                    == util.toString(user["location"]["country"]).toLowerCase()) {
                return true;
            }
            return false;
        },

        language: function (params) {
            if(util.toString(params["language"]).toLowerCase() == util.toString(user["language"]).toLowerCase()) {
                return true;
            }
            return false;
        },

        event: function (params) {
            for(var i=0; i<user["events"].length; i++) {
                if(user["events"][i]["key"] == params["key"] && user["events"][i]["value"] == params["value"]) {
                    return true;
                }
                if(user["events"][i]["key"] == params["key"] && !user["events"][i]["value"] && !params["value"]) {
                    return true;
                }
            }
            return false;
        },

        geopoint: function (params) {
            if(user["location"] &&
                util.geoDistance(user["location"]["latitude"], user["location"]["longitude"], params["latitude"],
                                                                            params["longitude"]) < params["radius"]) {
                return true;
            }
            return false;
        },

        referringsite: function (params) {
            if(params["referrer"]) {
                var regexp = new RegExp(params["referrer"]);
                if(regexp.test(user["referrer"]["source"])) {
                    return true;
                }
            }
            return false;
        },

        searchengine: function (params) {
            if(user["referrer"]["searchengine"]) {
                if(params["searchengine"]) {
                    return /google|yahoo|bing/.test(user["referrer"]["searchengine"]);
                }
                return true;
            }
        },

        vistitedpagebefore: function (params) {
            if(params["url"]) {
                var regexp = new RegExp(params["url"]);
                for(var i=0; i<(user["history"].length-1); i++) { // not the current page
                    if(regexp.test(user["history"][i])) {
                        return true;
                    }
                }
            }
            return false;
        },

        vistitedpagesbefore: function (params) {
            if(params["number"]) {
                return ((user["history"].length-1) >= params["number"]);
            }
            return false;
        },

        timeonsite: function (params) {
            if(params["hours"] || params["minutes"] || params["seconds"]) {

                var msecs = 0;
                if(params["hours"]) {
                    msecs += (params["hours"] * 3600000);
                }
                if(params["minutes"]) {
                    msecs += (params["minutes"] * 60000);
                }
                if(params["seconds"]) {
                    msecs += (params["seconds"] * 1000);
                }

                var date = new Date();
                if( date.getTime() > (user["behavior"]["enterTime"] + msecs) ) {
                    return true;
                }
            }
            return false;
        },

        linkclicked: function (params) {
            if(params["url"]) {
                var regexp = new RegExp(params["url"]);
                for(var i=0; i<(user["behavior"]["linksClicked"].length-1); i++) { // not the current page
                    if(regexp.test(util.toString(user["behavior"]["linksClicked"][i]))) {
                        return true;
                    }
                }
            }
            return false;
        },

        linksclicked: function (params) {
            if(params["number"]) {
                return ((user["behavior"]["linksClicked"].length-1) >= params["number"]);
            }
            return false;
        },

        hardwareplatform: function (params) {
            if(!params["platform"] || params["platform"] == user["environment"]["hardwareplatform"]) {
                return true;
            }
            return false;
        },

        operatingsystem: function (params) {
            if(!params["system"] || params["system"] == user["environment"]["os"]) {
                return true;
            }
            return false;
        },

        persona: function (params) {
            if(user["persona"] == params["persona"]
                || util.in_array(params["persona"], user["personas"])) {
                return true;
            }
            return false;
        }
    };


    /* UTILITY FUNCTIONS */
    var util = {

        log: function (msg) {
            // debug
            if (typeof console != "undefined" && typeof console["log"] == "function") {
                console.log(msg);
            }
        },

        toString: function (val) {
            if(typeof val != "string") {
                val = "";
            }
            return val;
        },

        in_array: function (needle, haystack, argStrict) {
            var key = '',
                strict = !! argStrict;

            if (strict) {
                for (key in haystack) {
                    if (haystack[key] === needle) {
                        return true;
                    }
                }
            } else {
                for (key in haystack) {
                    if (haystack[key] == needle) {
                        return true;
                    }
                }
            }

            return false;
        },

        array_keys: function (input, search_value, argStrict) {
            var search = typeof search_value !== 'undefined',
                tmp_arr = [],
                strict = !!argStrict,
                include = true,
                key = '';

            if (input && typeof input === 'object' && input.change_key_case) { // Duck-type check for our own array()-created PHPJS_Array
                return input.keys(search_value, argStrict);
            }

            for (key in input) {
                if (input.hasOwnProperty(key)) {
                    include = true;
                    if (search) {
                        if (strict && input[key] !== search_value) {
                            include = false;
                        }
                        else if (input[key] != search_value) {
                            include = false;
                        }
                    }

                    if (include) {
                        tmp_arr[tmp_arr.length] = key;
                    }
                }
            }

            return tmp_arr;
        },

        executeInsertedScripts: function (domelement) {
            var scripts = [];

            var ret = domelement.childNodes;
            for (var i = 0; ret[i]; i++) {
                if (scripts && util.nodeName(ret[i], "script")
                                            && (!ret[i].type || ret[i].type.toLowerCase() === "text/javascript")) {
                    scripts.push(ret[i].parentNode ? ret[i].parentNode.removeChild(ret[i]) : ret[i]);
                }
            }

            for (script in scripts) {
                util.evalScript(scripts[script]);
            }
        },

        nodeName:function (elem, name) {
            return elem.nodeName && elem.nodeName.toUpperCase() === name.toUpperCase();
        },

        evalScript:function (elem) {

            var data = ( elem.text || elem.textContent || elem.innerHTML || "" );
            var head = document.getElementsByTagName("head")[0] || document.documentElement,
                script = document.createElement("script");

            script.type = "text/javascript";


            try {
                script.appendChild(document.createTextNode(data));
            } catch (e) {
                // IE8 Workaround
                script.text = data;
            }
            head.insertBefore(script, head.firstChild);
            head.removeChild(script);
            if (elem.parentNode) {
                elem.parentNode.removeChild(elem);
            }
        },

        geoDistance: function (lat1, lon1, lat2, lon2) {
            var R = 6371; // km
            var dLat = (lat2-lat1) * Math.PI / 180;
            var dLon = (lon2-lon1) * Math.PI / 180;
            lat1 = lat1 * Math.PI / 180;
            lat2 = lat2 * Math.PI / 180;

            var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            var d = R * c;

            return d;
        },

        listen: function (elem, evnt, func) {
            if (elem.addEventListener) {  // W3C DOM
                elem.addEventListener(evnt,func,false);
            } else if (elem.attachEvent) { // IE DOM
                var r = elem.attachEvent("on"+evnt, func);
                return r;
            }
        },

        contentLoaded: function (win, fn) {
            var done = false, top = true,

            doc = win.document, root = doc.documentElement,

            add = doc.addEventListener ? 'addEventListener' : 'attachEvent',
            rem = doc.addEventListener ? 'removeEventListener' : 'detachEvent',
            pre = doc.addEventListener ? '' : 'on',

            init = function(e) {
                if (e.type == 'readystatechange' && doc.readyState != 'complete') {
                    return;
                }
                (e.type == 'load' ? win : doc)[rem](pre + e.type, init, false);
                if (!done && (done = true)) {
                    fn.call(win, e.type || e);
                }
            },

            poll = function() {
                try { root.doScroll('left'); } catch(e) { setTimeout(poll, 50); return; }
                init('poll');
            };

            if (doc.readyState == 'complete') {
                fn.call(win, 'lazy');
            } else {
                if (doc.createEventObject && root.doScroll) {
                    try { top = !win.frameElement; } catch(e) { }
                    if (top) {
                        poll();
                    }
                }
                doc[add](pre + 'DOMContentLoaded', init, false);
                doc[add](pre + 'readystatechange', init, false);
                win[add](pre + 'load', init, false);
            }
        }
    };

    /* App */
    var app = {

        matchesForProgrammatically: [],

        processTargets: function () {
            // process targets
            var targets = pimcore.targeting["targets"];
            if(typeof targets != "undefined") {
                var target;
                var matchingTargets = [];

                for(var t=0; t<targets.length; t++) {
                    target = targets[t];

                    if(target.conditions.length > 0) {
                        try {
                            if(app.testConditions(target.conditions)) {
                                matchingTargets.push(target);
                            }
                        } catch (e) {
                            util.log(e);
                        }
                    }
                }

                for(t=0; t<matchingTargets.length; t++) {
                    app.callActions(matchingTargets[t]);
                }

                //util.log(matchingTargets);
                app.callTargets(app.matchesForProgrammatically);
            }
        },

        testConditions: function (conditions) {
            var res, cond = "";
            for(var i=0; i<conditions.length; i++) {
                res = false;
                try {
                    res = tests[conditions[i]["type"]](conditions[i]);
                } catch (e) {
                    util.log(e);
                }

                if(conditions[i]["operator"] && i > 0) {
                    if(conditions[i]["operator"] == "and") {
                        cond += " && ";
                    }
                    if(conditions[i]["operator"] == "or") {
                        cond += " || ";
                    }
                    if(conditions[i]["operator"] == "and_not") {
                        cond += " && !";
                    }
                }

                if(conditions[i]["bracketLeft"]) {
                    cond += "(";
                }

                cond += JSON.stringify(res);

                if(conditions[i]["bracketRight"]) {
                    cond += ")";
                }
            }

            cond = "(" + cond + ")";
            return eval(cond);
        },

        callActions: function (target) {
            var actions = target["actions"];
            util.log("call actions for target: " + target["id"] + " | " + target["name"]);

            // redirects
            try {
                var regexp = new RegExp("_ptr=" + target.id);
                if(actions["redirectEnabled"] && actions["redirectUrl"].length > 0
                                              && !regexp.test(window.location.href)) {
                    window.location.href = actions["redirectUrl"]
                                            + (actions["redirectUrl"].indexOf("?") < 0 ? "?" : "&")
                                            + "_ptr=" + target.id;
                }
            } catch (e) {
                util.log(e);
            }

            // event
            try {
                if(actions["eventEnabled"] && actions["eventKey"]) {
                    user["events"].push({
                        key: actions["eventKey"],
                        value: actions["eventValue"]
                    });
                    app.saveUser();
                }
            } catch (e2) {
                util.log(e2);
            }

            // snippet
            try {
                if(actions["codesnippetEnabled"] && actions["codesnippetCode"] && actions["codesnippetSelector"]) {
                    util.contentLoaded(window, function () {
                        try {
                            var pos = actions["codesnippetPosition"] ? actions["codesnippetPosition"] : "end";
                            var el = document.querySelector(actions["codesnippetSelector"]);
                            if(el) {
                                var frag = document.createDocumentFragment();
                                var temp = document.createElement('div');

                                temp.innerHTML = actions["codesnippetCode"];

                                while (temp.firstChild) {
                                    frag.appendChild(temp.firstChild);
                                }

                                if(pos == "end") {
                                    el.appendChild(frag);
                                } else if (pos == "beginning") {
                                    el.insertBefore(frag, el.firstChild);
                                } else if (pos == "replace") {
                                    el.innerHTML = actions["codesnippetCode"];
                                }

                                util.executeInsertedScripts(el);
                            }
                        } catch (e3) {
                            util.log(e3);
                        }
                    });
                }
            } catch (e4) {
                util.log(e4);
            }

            // programmatically
            try {
                if(actions["programmaticallyEnabled"]) {
                    app.matchesForProgrammatically.push(target["id"]);
                }
            } catch (e5) {
                util.log(e5);
            }

            // append persona
            try {
                if(actions["personaEnabled"]) {
                    user["personas"].push(actions["personaId"]);
                }
            } catch (e6) {
                util.log(e6);
            }
        },

        callTargets: function (targets) {
            if(targets.length > 0 && !/_ptc=/.test(window.location.href)) {
                window.location.href = "?_ptc=" + targets.join(",");
            }
        },

        saveUser: function() {
            localStorage.setItem("pimcore_targeting_user", JSON.stringify(user));
        }
    };










    // common used vars
    var ua = navigator.userAgent.toLowerCase();
    var now = new Date();


    // create user object
    var user = null;
    try {
        user = localStorage.getItem("pimcore_targeting_user");
        user = JSON.parse(user);
    } catch (e) {
        user = null;
    }

    if(!user) {
        user = {};
    }


    try {
        if(!user["location"] && google && google.loader && google.loader.ClientLocation) {
            user["location"] = {
                latitude: google.loader.ClientLocation.latitude,
                longitude: google.loader.ClientLocation.longitude,
                country: google.loader.ClientLocation.address.country_code
            };
        }
    } catch (e5) {
        util.log(e5);
    }

    try {
        if(!user["history"]) {
            user["history"] = [];
        }

        // do not add programmatic actions and persona content to history
        if(!/_pt(c|p)=/.test(window.location.href)) {
            user["history"].push(location.href);
        }
    } catch (e6) {
        util.log(e6);
    }

    try {
        if(!user["language"]) {
            user["language"] = navigator.browserLanguage ? navigator.browserLanguage : navigator.language;
        }
    } catch (e7) {
        util.log(e7);
    }

    try {
        if(!user["environment"] || true) {

            user["environment"] = {};

            user["environment"]["browser"] = "undefined";
            if(/opera/.test(ua)) {
                user["environment"]["browser"] = "opera";
            } else if (/\bchrome\b/.test(ua)) {
                user["environment"]["browser"] = "chrome";
            } else if (/safari/.test(ua)) {
                user["environment"]["browser"] = "safari";
            } else if (/msie/.test(ua)) {
                user["environment"]["browser"] = "ie";
            } else if (/gecko/.test(ua)) {
                user["environment"]["browser"] = "firefox";
            }

            user["environment"]["os"] = "undefined";
            if(/windows/.test(ua)) {
                user["environment"]["os"] = "windows";
            } else if (/linux/.test(ua)) {
                user["environment"]["os"] = "linux";
            } else if (/iphone|ipad/.test(ua)) {
                user["environment"]["environment"]["os"] = "ios";
            } else if (/mac/.test(ua)) {
                user["environment"]["os"] = "macos";
            } else if (/android/.test(ua)) {
                user["environment"]["os"] = "android";
            }

            user["environment"]["hardwareplatform"] = "desktop";
            if(/iphone|android|mobile/.test(ua)) {
                user["environment"]["hardwareplatform"] = "mobile";
            } else if (/ipad|tablet/.test(ua)) {
                user["environment"]["hardwareplatform"] = "tablet";
            }
        }
    } catch (e8) {
        util.log(e8);
    }


    // push data
    var pushData = pimcore.targeting["dataPush"];
    try {
        if(!user["events"]) {
            user["events"] = [];
        }

        // get new events
        if(pushData["events"] && pushData["events"].length > 0) {
            for(var ev=0; ev<pushData["events"].length; ev++) {
                user["events"].push(pushData["events"][ev]);
            }
        }
    } catch (e9) {
        util.log(e9);
    }

    try {
        if(!user["personas"]) {
            user["personas"] = [];
        }

        // get new events
        if(pushData["personas"] && pushData["personas"].length > 0) {
            for(var ev=0; ev<pushData["personas"].length; ev++) {
                user["personas"].push(pushData["personas"][ev]);
            }
        }
    } catch (e9) {
        util.log(e9);
    }

    try {
        if(!user["referrer"]) {
            user["referrer"] = {};
            user["referrer"]["source"] = !document.referrer ? "direct" : document.referrer;

            user["referrer"]["searchengine"] = "";

            if(document.referrer) {
                if(/google/.test(document.referrer)) {
                    user["referrer"]["searchengine"] = "google";
                } else if (/bing/.test(document.referrer)) {
                    user["referrer"]["searchengine"] = "bing";
                } else if (/yahoo/.test(document.referrer)) {
                    user["referrer"]["searchengine"] = "yahoo";
                }
            }
        }
    } catch (e10) {
        util.log(e10);
    }

    try {
        if(!user["behavior"]) {
            user["behavior"] = {};
        }

        if(!user["behavior"]["enterTime"]) {
            user["behavior"]["enterTime"] = now.getTime();
        }

        if(!user["behavior"]["linksClicked"]) {
            user["behavior"]["linksClicked"] = [];
        }
    } catch (e11) {
        util.log(e11);
    }

    try {
        if(!user["persona"]) {
            var personas = pimcore.targeting["personas"];
            var prevConditionCount = 0;
            if(typeof personas != "undefined") {
                for(var pi=0; pi<personas.length; pi++) {
                    if(personas[pi].conditions.length > 0) {
                        try {
                            if(app.testConditions(personas[pi].conditions)) {
                                // if multiple persona match, use the one with the bigger amount of conditions
                                // this should be the most accurate match then
                                if(personas[pi].conditions.length > prevConditionCount) {
                                    user["persona"] = personas[pi]["id"];
                                    prevConditionCount = personas[pi].conditions.length;
                                }
                            }
                        } catch (e) {
                            util.log(e);
                        }
                    }
                }
            }
        }
    } catch (e11) {
        util.log(e11);
    }

    // dom stuff
    util.contentLoaded(window, function () {
        try {
            var linkElements = document.querySelectorAll("a");
            for (var le = 0; le < linkElements.length; le++) {
                util.listen(linkElements[le], "click", function (ev) {
                    try {
                        var el = ev.target ? ev.target : ev.srcElement;
                        user["behavior"]["linksClicked"].push(el.getAttribute("href"));
                        app.saveUser();
                    } catch (e) {
                        util.log(e);
                    }
                });
            }
        } catch (e12) {
            util.log(e12);
        }
    });

    app.saveUser();
    app.processTargets();

    window.pimcore["targeting"]["user"] = user;

    var pageVariants = pimcore["targeting"]["dataPush"]["personaPageVariants"];
    var pageVariantMatches = {};
    var pageVariantMatch;

    if(pageVariants && pageVariants.length > 0 && !/_ptp=/.test(window.location.href)) {
        // get the most accurate persona out of the collected data from visited pages
        if(user["personas"] && user["personas"].length > 0) {
            for(var pc=0; pc<user["personas"].length; pc++) {
                if(util.in_array(user["personas"][pc], pageVariants)) {

                    if(!pageVariantMatches[user["personas"][pc]]) {
                        pageVariantMatches[user["personas"][pc]] = 0;
                    }

                    pageVariantMatches[user["personas"][pc]]++;
                }
            }

            var pageVariantMatchesKeys = util.array_keys(pageVariantMatches);
            var pageVariantMatchesLastAmount = 0;
            for(pc=0; pc<pageVariantMatchesKeys.length; pc++) {
                if(pageVariantMatches[pageVariantMatchesKeys[pc]] > pageVariantMatchesLastAmount) {
                    pageVariantMatch = pageVariantMatchesKeys[pc];
                    pageVariantMatchesLastAmount = pageVariantMatches[pageVariantMatchesKeys[pc]];
                }
            }
        }

        if(!pageVariantMatch && user["persona"]) {
            if(util.in_array(user["persona"], pageVariants)) {
                pageVariantMatch = user["persona"];
            }
        }

        if(pageVariantMatch) {
            // redirect to the persona specific version of the current page
            window.location.href = window.location.href + (window.location.href.indexOf("?") < 0 ? "?" : "&")
                + "_ptp=" + pageVariantMatch;
        }
    }

})();

