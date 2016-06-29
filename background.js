// To control it, currently:
//    - hard-code values of the first few variables below, then hit ctrl-r in background window to reload
//    - http://heyheyhey causes dump of in-flight requests (if verboseLevel>=2)
//    - http://heyheyhey?verboseLevel=<n> causes verboseLevel to be changed to <n>
// Notes:
//	- unexpected onHeadersReceived of https://pr.comet.yahoo.com from time to time.
//        oh hmm, it's ajax.  request id does seem to be from before I started but... Should look into how this happens.
//
// TODO: keep record of unexpected events (like the pr.comet.yahoo.com stuff?)
// TODO: maybe make an actual flush timer?  (what did I mean?)
// TODO: stackoverflow question: "what's the most graceful way to make chrome.webRequest return a synthetic response?"
//       See details down where I handle "heyheyhey" down below.


// Per http://stackoverflow.com/questions/24369328/how-to-use-strict-mode-in-chrome-javascript-console,
// "The easiest way to use strict mode is to use an IIFE (Immediately invoked Function Expression).
(function()
{
  'use strict';
  //bar = 345; //ReferenceError: bar is not defined  (if uncommented, since strict mode)


  let verboseLevel = 3; // 0: nothing, 1: extension init and errors, 2: every request, nicely formatted, 3: lots of details like headers
  let monitorCookiesToo = true;
  let showCORSfriendlySites = true; // XXX hack at the moment

  let allowCORSFlag = false; // if set, try to allow CORS wherever possible (also subject to whitelist)
  let allowCORSWhitelistFunction = function(url) {
    return true;
    //return url.indexOf('http://0.keyhole_maps.khserver.keyhole.sb.borg.google.com:8125') == 0;
  };

  let flushAfterEveryLogMessage = false; // can set this to true here or when something weird happens, for better debuggability

  if (verboseLevel >= 1) console.log("    in background.js");
  if (verboseLevel >= 1) console.log("      verboseLevel = "+EXACT(verboseLevel)+(verboseLevel<2?" (set to >=2 in source and reload extension to show flow graph of every request)":""));
  if (verboseLevel >= 1) console.log("      monitorCookiesToo = "+EXACT(monitorCookiesToo));
  if (verboseLevel >= 1) console.log("      showCORSfriendlySites = "+EXACT(showCORSfriendlySites));
  if (verboseLevel >= 1) console.log("      allowCORSFlag = "+EXACT(allowCORSFlag));

  // box drawing characters: https://en.wikipedia.org/wiki/Box-drawing_character
  let BOX_NW =    '\u250F';
  let BOX_HORIZ = '\u2501';
  let BOX_NE =    '\u2513';
  let BOX_VERT =  '\u2503';
  let BOX_SW =    '\u2517';
  let BOX_SE =    '\u251B';
  let BOX_W =     '\u2523'; // W wall with spike pointing E
  let BOX_N =     '\u2533'; // N wall with spike pointing S

  let BOX_NW_FAINT =    '\u250C';
  let BOX_HORIZ_FAINT = '\u2500';
  let BOX_NE_FAINT =    '\u2510';
  let BOX_VERT_FAINT =  '\u2502';
  let BOX_SW_FAINT =    '\u2514';
  let BOX_SE_FAINT =    '\u2518';
  let BOX_W_FAINT =     '\u251C'; // W wall with spike pointing E
  let BOX_N_FAINT =     '\u252C'; // N wall with spike pointing S


  let colors = [
      '#f00', // red
      '#f80', // orange
      '#cc0', // dark yellow
      '#0c0', // green
      '#08f', // dark cyan
      '#00f', // blue
      '#80f', // purple
      '#f0f', // magenta
  ];

  let knownCORSfriendlySites = new Set(); // only used if showCORSfriendlySites

  let swimLaneToRequestId = [];
  let requestIdToSwimLane = {};

  // These functions are only used by GetConsoleLogArgsForRequestIdAliveOrDead
  let GetSwimLane = function(requestId) {
    return requestIdToSwimLane[requestId]; // can be undefined
  };
  let AllocateSwimLane = function(requestId) {
    if (requestId in requestIdToSwimLane) {
      return requestIdToSwimLane[requestId];
    }
    let swimLane;
    for (swimLane = 0; swimLane < swimLaneToRequestId.length; ++swimLane) {
      if (swimLaneToRequestId[swimLane] === null) {
        swimLaneToRequestId[swimLane] = requestId;
        break;
      }
    }
    if (swimLane == swimLaneToRequestId.length) {
      swimLaneToRequestId.push(requestId);
    }
    requestIdToSwimLane[requestId] = swimLane;
    return swimLane;
  };
  let ReleaseSwimLane = function(requestId) {
    let swimLane = requestIdToSwimLane[requestId];
    delete requestIdToSwimLane[requestId];
    swimLaneToRequestId[swimLane] = null;
  };

  let now0 = Date.now();


  // age=0 means start, age=1 means continue, age=2 means end
  let GetConsoleLogArgsForRequestIdAliveOrDead = function(requestId, age) {
    let verboseLevel = 0;  // XXX should rename this, it's not the global one
    if (verboseLevel >= 1) console.log("in GetConsoleLogArgsForRequestIdAliveOrDead(requestId="+EXACT(requestId)+", age="+EXACT(age)+")");
    let swimLane = GetSwimLane(requestId);
    let hadSwimLane = (swimLane !== undefined);
    if (!hadSwimLane) {
      swimLane = AllocateSwimLane(requestId);
    }
    let maxSwimLane = swimLaneToRequestId.length - 1;
    while (maxSwimLane >= 0 && swimLaneToRequestId[maxSwimLane] == null) {
      maxSwimLane--;
    }

    let myColor = colors[requestId % colors.length];

    let answer = [""];

    if (age != 0 && !hadSwimLane) {
      answer[0] += "%c%s";
      answer.push("color:red");
      answer.push("[FIRST APPEARANCE OF "+requestId+" NOT IN onBeforeRequest -- PROBABLY REQUEST WAS CREATED BEFORE EXTENSION STARTED]\n");
    }


    if (true) {
      // Prepend timestamp.
      // Arguably we should be printing the timestamp of the request when we have it...
      answer[0] += "%c%s";
      answer.push("color:black");
      let ms = Date.now() - now0;
      let s = ms / 1000.;
      s = s.toFixed(3);
      s = ("                 "+s).slice(-10); // left-pad to 10 chars
      answer.push(s + " ");
    }

    let myChar = (age==0 ? BOX_NW : age==1 ? BOX_W : BOX_SW);
    for (let i = 0; i <= maxSwimLane; ++i) {
      let r = swimLaneToRequestId[i];
      let color, c;

      if (r === null) {
        if (i < swimLane) {
          color = "black";
          c = " ";
        } else {
          color = myColor;
          c = BOX_HORIZ;
        }
      } else {
        if (i < swimLane) {
          color = colors[r % colors.length];
          c = BOX_VERT;
        } else if (i == swimLane) {
          color = myColor;
          c = myChar;
        } else {
          let verticalTakesPrecedence = true; // can hard-code this either way
          if (verticalTakesPrecedence) {
            color = colors[r % colors.length];
            c = BOX_VERT;
          } else {
            color = myColor;
            c = BOX_HORIZ;
          }
        }
      }
      answer[0] += "%c%s";
      answer.push("color:"+color);
      answer.push(c);
    }
    answer[0] += "%c%s";
    answer.push("color:"+myColor);
    answer.push(BOX_HORIZ+" "+requestId);

    if (age == 2) {
      ReleaseSwimLane(requestId);
    }
    if (verboseLevel >= 1) console.log("out GetConsoleLogArgsForRequestIdAliveOrDead(requestId="+EXACT(requestId)+", isEnd="+EXACT(isEnd)+"), returning "+EXACT(answer));
    return answer;
  }; // GetConsoleLogArgsForRequestIdAliveOrDead


  // Example of reliably coloring console.log output:
  //   console.log("%c%s%c%s", "color:red;font-weight:bold", "this comes out in bold red", "color:green", " and this comes out in normal green");
  // details.requestId is used, and maybe detail.url for debugging weirdness.
  let requestLogBuffer = [""];
  let RequestLogAliveOrDead = function(requestId, string, age) {
    let args = GetConsoleLogArgsForRequestIdAliveOrDead(requestId, age);
    args[0] += "%c%s";
    args.push("color:black");
    args.push(string);

    if (false) {
      // immediate
      console.log.apply(console, args);
    } else {
      if (requestLogBuffer.length != 1) {
        requestLogBuffer[requestLogBuffer.length-1] += "\n";
      }
      requestLogBuffer[0] += args[0];
      for (let i = 1; i < args.length; ++i) { // skip 0
        requestLogBuffer.push(args[i]);
      }
      if (false) { // set to true to debug what's taking a long time and what isn't
        console.log("(after added something, requestLogBuffer.length = "+EXACT(requestLogBuffer.length)+")");
      }

      if (flushAfterEveryLogMessage) {
        RequestLogFlush();
      }
    }
  };  // RequestLogAliveOrDead
  let RequestLogStart = function(requestId, string) {
    return RequestLogAliveOrDead(requestId, string, 0);
  };
  let RequestLogContinue = function(requestId, string) {
    return RequestLogAliveOrDead(requestId, string, 1);
  };
  let RequestLogEnd = function(requestId, string) {
    return RequestLogAliveOrDead(requestId, string, 2);
  };
  let RequestLogFlush = function() {
    if (requestLogBuffer.length != 1) {
      console.log.apply(console, requestLogBuffer);
      requestLogBuffer = [""];
    }
  };

  // Contains, for each requestId,
  // a dictionary with the following:
  //      Origin: value of "Origin:" header if any
  //      traceStrings: an array of strings containing a trace of what happened.
  let stash = new Object;

  let getHeader = function(headers, name) {
    let nameToLowerCase = name.toLowerCase();
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].name.toLowerCase() === nameToLowerCase) {
        return headers[i].value;
      }
    }
    return null;
  };  // getHeader
  let setHeader = function(headers, name, value, requestIdForLogging) {
    let nameToLowerCase = name.toLowerCase();
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].name.toLowerCase() === nameToLowerCase) {
        if (verboseLevel >= 2) RequestLogContinue(requestIdForLogging, "      changing header "+EXACT(headers[i].name)+" to "+EXACT(value));
        headers[i].value = value;
        return;
      }
    }
    if (verboseLevel >= 2) RequestLogContinue(requestIdForLogging, "      adding header "+EXACT(name)+" : "+EXACT(value));
    headers.push({name:name, value:value});
  };  // setHeader







  //
  // Define and install chrome.webRequest listeners.
  //
  let onBeforeRequestListener = function(details) {
    let isContinuation;
    if (details.requestId in stash) {
      // This happens, on redirects (including switcheroos done by this extension and others)
      isContinuation = true;
    } else {
      stash[details.requestId] = {traceStrings: [], urls:[]};
      isContinuation = false;
    }
    stash[details.requestId].traceStrings.push("onBeforeRequest: method = "+EXACT(details.method)+" url = "+EXACT(details.url));
    stash[details.requestId].urls.push(details.url);

    if (verboseLevel >= 2) (isContinuation ? RequestLogContinue : RequestLogStart)(details.requestId, "[   in onBeforeRequest listener: "+EXACT(details.method)+" "+EXACT(details.url));
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "      details = "+EXACT(details));
    let answer = null;

    // XXX TODO: what is the most graceful way of just sending my extension a signal? can do with messages but... would be nice to just do it in the browser or something? hmm
    // can I make this request return a web page??? could do it with something obscene by sending a request to google.com and replacing the response, but... what's a better way?
    // Maybe a good question for StackOverflow.
    if (details.url.startsWith("http://heyheyhey/")) {

      // Parse url params out of it.
      // For now, just do really ad-hoc matching.
      if (true) {
        let match = /.*verboseLevel=(\d+).*/.exec(details.url); // or could use details.url.match(regex)
        console.log("match = "+JSON.stringify(match));
        if (match !== null) {
           verboseLevel = parseInt(match[1], 10);
           console.log("verboseLevel changed to "+JSON.stringify(verboseLevel));
        }
      }

      // Show current status of all outstanding requests.
      if (verboseLevel >= 2) {
        // we are showing swim lanes, so do it in the swim lanes
        RequestLogFlush();
        console.log("---------------------------------------------");
        console.log(""+details.requestId+": got special request "+EXACT(details.url))+" to dump state";
        console.log("swimLaneToRequestId.length = "+EXACT(swimLaneToRequestId.length));
        console.log("swimLaneToRequestId = "+EXACT(swimLaneToRequestId));
        console.log("requestIdToSwimLane = "+EXACT(requestIdToSwimLane));
        for (let i = 0; i < swimLaneToRequestId.length; ++i) {
          let requestId = swimLaneToRequestId[i];
          if (requestId != null) {
            // It has a swim lane, so it should have a stash entry too... I think we create a stash entry every time we create a swim lane
            let stashEntry = stash[requestId];
            if (stashEntry === undefined) {
              RequestLogContinue(requestId, " (no stash entry, I think this shouldn't happen)");
            } else {
              RequestLogContinue(requestId, " "+EXACT(stash[requestId].urls));
            }
          }
        }
        RequestLogFlush();
        console.log("---------------------------------------------");
      } else {
        console.log("---------------------------------------------");
        console.log(""+details.requestId+": got special request "+details.url);
        console.log("stash = "+EXACT(stash)); // don't let console.log do it, since it will delay evaluation, losing value
        console.log("---------------------------------------------");
      }

      // Just cancel it for now.
      // This appears in our gui as an onErrorOccurred event with "error" field "net::ERR_BLOCKED_BY_CLIENT",
      // and appears in the chrome tab as:
      //     heyheyhey is blocked
      //     Requests to the server have been blocked by an extension.
      //     Try disabling your extensions.
      //     ERR_BLOCKED_BY_CLIENT
      answer = {cancel : true};
    }

    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    out onBeforeRequest listener, returning "+EXACT(answer));
    //if (verboseLevel >= 2) RequestLogFlush();  // evidently might might be a while before more output
    return answer;
  };  // onBeforeRequestListener
  // aka requestListener
  let onBeforeSendHeadersListener = function(details) {
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    in onBeforeSendHeaders listener: "+EXACT(details.method)+" "+EXACT(details.url));
    if (verboseLevel >= 3) RequestLogContinue(details.requestId, "      details = "+EXACT(details));
    // empirically, we never seem to get this unless onBeforeRequestListener has been called, so don't need to check.
    // but, check anyway.

    if (!(details.requestId in stash)) {
      stash[details.requestId] = {traceStrings: ["    onBeforeSendHeaders (request must have been created before extension started)"], urls:[details.url]};
    }

    let Origin = getHeader(details.requestHeaders, "Origin");
    if (Origin != null) {
      if (verboseLevel >= 2) RequestLogContinue(details.requestId, "      stashing request id "+details.requestId+" Origin: "+EXACT(Origin));
      stash[details.requestId].Origin = Origin;
    }

    let answer = null;
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    out onBeforeSendHeaders listener, returning "+EXACT(answer));
    return answer;
  };  // onBeforeSendHeadersListener
  let onSendHeadersListener = function(details) {
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    in onSendHeaders listener");
    let answer = null;
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    out onSendHeaders listener, returning "+EXACT(answer));
    if (verboseLevel >= 2) RequestLogFlush();  // definitely might be a while before more output
    return answer;
  };  // onSendHeadersListener
  // aka responseListener
  let onHeadersReceivedListener = function(details) {
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    in onHeadersReceived listener: "+EXACT(details.method)+" "+EXACT(details.url)+" -> "+details.statusCode);
    if (verboseLevel >= 3) RequestLogContinue(details.requestId, "      details = "+EXACT(details));

    if (!(details.requestId in stash)) {
      stash[details.requestId] = {traceStrings: ["    onHeadersRecieved (request must have been created before extension started)"], urls:[details.url]};
    }

    if (showCORSfriendlySites) {
      let friendlyHeaders = details.responseHeaders.filter(function(nameValue) { return nameValue.name.toLowerCase().startsWith("access-control-"); });
      if (true || friendlyHeaders.length > 0) {  // XXX HACK
        friendlyHeaders = friendlyHeaders.map(function(nameValue) { return [nameValue.name, nameValue.value]; });
        let key = EXACT(stash[details.requestId].urls);
        if (key.indexOf('uberproxy') != -1) { // XXX HACK
          if (verboseLevel >= 2) {
            // we are showing swim lanes, so do it in the swim lanes, whether or not seen before.
            RequestLogFlush();
            if (friendlyHeaders.length > 0) {
              RequestLogContinue(details.requestId, "      HEY! "+key+" might be CORS-friendly! friendlyHeaders="+JSON.stringify(friendlyHeaders));
            } else {
              RequestLogContinue(details.requestId, "      HEY! "+key+" looks interesting!  friendlyHeaders="+JSON.stringify(friendlyHeaders));
            }
          } else {
            // No swim lanes. Only show if haven't shown before.
            if (!knownCORSfriendlySites.has(key)) {
              knownCORSfriendlySites.add(key);
              if (friendlyHeaders.length > 0) {
                console.log("      HEY! "+key+" might be CORS-friendly! friendlyHeaders="+JSON.stringify(friendlyHeaders));
              } else {
                console.log("      HEY! "+key+" looks interesting! friendlyHeaders="+JSON.stringify(friendlyHeaders));
              }
            } else {
              //console.log("      (hey! "+key+" might be CORS-friendly! friendlyHeaders="+JSON.stringify(friendlyHeaders)+")");
            }
          }
        }
      }
    }

    let answer = null;
    if (allowCORSFlag) {
      if (verboseLevel >= 2) RequestLogContinue(details.requestId, "      details.url = "+EXACT(details.url));
      if (allowCORSWhitelistFunction(details.url)) {
        let Origin = stash[details.requestId].Origin;
        if (Origin !== undefined) {
          //setHeader(details.responseHeaders, "Access-Control-Allow-Origin", "*", details.requestId); // simplistic extension
          setHeader(details.responseHeaders, "Access-Control-Allow-Origin", Origin, details.requestId); // smart extension
        } else {
          setHeader(details.responseHeaders, "Access-Control-Allow-Origin", "*", details.requestId);
        }
        // The following is required when using ajax with withCredentials=true, but doesn't hurt in general
        setHeader(details.responseHeaders, "Access-Control-Allow-Credentials", "true", details.requestId);
        answer = {responseHeaders: details.responseHeaders};
        if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    out onHeadersReceived listener, allowCORSFlag and passed whitelist, returning "+Object.keys(answer.responseHeaders).length+" headers"+(verboseLevel>=3 ? ": "+EXACT(answer) : ""));
      } else {
        if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    out onHeadersReceived listener, allowCORSFlag but didn't pass whitelist, returning "+EXACT(answer));
      }
    } else {
      if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    out onHeadersReceived listener, returning "+EXACT(answer));
    }
    //if (verboseLevel >= 2) RequestLogFlush();  // evidently might might be a while before more output
    return answer;
  };  // onHeadersReceivedListener
  let onAuthRequiredListener = function(details) {
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    in onAuthRequired listener");
    let answer = null;
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    out onAuthRequired listener, returning "+EXACT(answer));
    return answer;
  };  // onAuthRequiredListener
  let onBeforeRedirectListener = function(details) {
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    in onBeforeRedirect listener: "+EXACT(details.method)+" "+EXACT(details.url)+" -> "+details.statusCode+" -> "+EXACT(details.redirectUrl));
    if (verboseLevel >= 3) RequestLogContinue(details.requestId, "      details = "+EXACT(details));

    if (!(details.requestId in stash)) {
      stash[details.requestId] = {traceStrings: ["    onBeforeRedirect (request must have been created before extension started)"], urls:[details.url]};
    } else {
      stash[details.requestId].urls.push(details.url);
    }

    let answer = null;
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    out onBeforeRedirect listener, returning "+EXACT(answer));
    return answer;
  };  // onBeforeRedirectListener
  let onResponseStartedListener = function(details) {
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    in onResponseStarted listener");
    let answer = null;
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    out onResponseStarted listener, returning "+EXACT(answer));
    return answer;
  };  // onResponseStartedListener
  let onCompletedListener = function(details) {
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    in onCompleted listener: "+EXACT(details.method)+" "+EXACT(details.url)+" -> "+details.statusCode);
    if (verboseLevel >= 3) RequestLogContinue(details.requestId, "      details = "+EXACT(details));
    delete stash[details.requestId];  // whether or not it existed
    let answer = null;
    if (verboseLevel >= 2) RequestLogEnd(details.requestId, "]   out onCompleted listener, returning "+EXACT(answer));
    if (verboseLevel >= 2) RequestLogFlush();  // definitely might be a while before more output
    return answer;
  };  // onCompletedListener
  let onErrorOccurredListener = function(details) {
    if (verboseLevel >= 2) RequestLogContinue(details.requestId, "    in onErrorOccurred listener: "+EXACT(details.method)+" "+EXACT(details.url)+" -> "+details.statusCode);
    if (verboseLevel >= 3) RequestLogContinue(details.requestId, "      details = "+EXACT(details));
    delete stash[details.requestId];  // whether or not it existed
    let answer = null;
    if (verboseLevel >= 2) RequestLogEnd(details.requestId, "]   out onErrorOccurred listener, returning "+EXACT(answer));
    if (verboseLevel >= 2) RequestLogFlush();  // definitely might be a while before more output
    return answer;
  };  // onErrorOccurredListener
  chrome.webRequest.onBeforeRequest.addListener(onBeforeRequestListener, {urls:["<all_urls>"]}, [
    "blocking", // so we can cancel the heyheyhey, if nothing else... although maybe we shouldn't? think about this.
  ]);  // options: blocking, requestBody
  chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeadersListener, {urls:["<all_urls>"]}, ["requestHeaders"]);  // options: requestHeaders, blocking
  chrome.webRequest.onSendHeaders.addListener(onSendHeadersListener, {urls:["<all_urls>"]}, ["requestHeaders"]);  // options: requestHeaders
  chrome.webRequest.onHeadersReceived.addListener(onHeadersReceivedListener, {urls:["<all_urls>"]},
    allowCORSFlag ? ["blocking", "responseHeaders"]
                  : ["responseHeaders"]
  );  // options: blocking, responseHeaders
  chrome.webRequest.onAuthRequired.addListener(onAuthRequiredListener, {urls:["<all_urls>"]}, ["responseHeaders"]);  // options: responseHeaders, blocking, asyncBlocking
  chrome.webRequest.onBeforeRedirect.addListener(onBeforeRedirectListener, {urls:["<all_urls>"]}, ["responseHeaders"]);  // options: responseHeaders
  chrome.webRequest.onResponseStarted.addListener(onResponseStartedListener, {urls:["<all_urls>"]}, ["responseHeaders"]);  // options: responseHeaders
  chrome.webRequest.onCompleted.addListener(onCompletedListener, {urls:["<all_urls>"]}, ["responseHeaders"]);  // options: responseHeaders
  chrome.webRequest.onErrorOccurred.addListener(onErrorOccurredListener, {urls:["<all_urls>"]});

  //
  // Define and install chrome.runtime listeners.
  //
  let onStartupOrOnInstalledListener = function() {
  };  // onStartupOrOnInstalledListener

  // happens on browser start
  // (and other cases? I think when a user profile is enabled that has the extension enabled)
  // (note, does not happen at all if manually enabled after browser start)
  chrome.runtime.onStartup.addListener(function() {
    if (verboseLevel >= 1) console.log("        in onStartup listener");
    onStartupOrOnInstalledListener();
    if (verboseLevel >= 1) console.log("        out onStartup listener");
  });
  // happens on Reload of extension
  chrome.runtime.onInstalled.addListener(function() {
    if (verboseLevel >= 1) console.log("        in onInstalled listener");
    onStartupOrOnInstalledListener();
    if (verboseLevel >= 1) console.log("        out onInstalled listener");
  });  // onInstalled listener

  if (monitorCookiesToo) {
    //
    // https://developer.chrome.com/extensions/cookies
    // https://developer.chrome.com/extensions/samples#search:cookies
    //
    chrome.cookies.onChanged.addListener(function(info) {
      //console.log("in cookie onChanged listener(cause="+EXACT(info.cause)+")");
      //console.log("  info = "+EXACT(info));
      //console.log("  info.cause = "+EXACT(info.cause)); // supposedly can be one of "evicted", "expired", "explicit", "expired_overwrite", or "overwrite"
      //console.log("  info.cookie = "+EXACT(info.cookie));
      //console.log("  info.cookie.domain = "+EXACT(info.cookie.domain));
      //console.log("  info.cookie.name = "+EXACT(info.cookie.name));
      //console.log("  info.cookie.value = "+EXACT(info.cookie.value));
      //console.log("  info.removed = "+EXACT(info.removed));
      if (verboseLevel >= 2) RequestLogFlush();
      if (info.removed) {
        console.log("  COOKIE REMOVED (cause="+EXACT(info.cause)+"): domain="+EXACT(info.cookie.domain)+" name="+EXACT(info.cookie.name)+" cookie=",info.cookie);
      } else {
        console.log("  COOKIE ADDED OR CHANGED (cause="+EXACT(info.cause)+"): domain="+EXACT(info.cookie.domain)+" name="+EXACT(info.cookie.name)+" cookie=",info.cookie);
      }
      //console.log("      info.cookie = "+EXACT(info.cookie));
      //console.log("out cookie onChanged listener(cause="+EXACT(info.cause)+")");
    });
  }

  if (verboseLevel >= 1) console.log("    out background.js");
}()); // end of IIFE
