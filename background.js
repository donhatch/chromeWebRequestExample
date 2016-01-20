// Notes:
//	- unexpected onHeadersReceived of https://pr.comet.yahoo.com from time to time.
//        oh hmm, it's ajax.  request id does seem to be from before I stared but... Should look into how this happens.
//
// TODO: keep record of unexpected events (like the pr.comet.yahoo.com stuff?)
// TODO: maybe make an actual flush timer?
// TODO: stackoverflow question: "what's the most graceful way to make chrome.webRequest return a synthetic response?"

var verboseLevel = 2; // 0: nothing, 1: extension init and errors, 2: every request, 3: lots of details
var allowCORSFlag = true; // if set, try to allow CORS wherever possible
var flushAfterEveryLogMessage = false; // can set this to true here or when something weird happens, for better debuggability

if (verboseLevel >= 1) console.log("    in background.js");
if (verboseLevel >= 1) console.log("      verboseLevel = "+EXACT(verboseLevel));
if (verboseLevel >= 1) console.log("      allowCORSFlag = "+EXACT(allowCORSFlag));

// box drawing characters: https://en.wikipedia.org/wiki/Box-drawing_character
var BOX_NW =    '\u250F';
var BOX_HORIZ = '\u2501';
var BOX_NE =    '\u2513';
var BOX_VERT =  '\u2503';
var BOX_SW =    '\u2517';
var BOX_SE =    '\u251B';
var BOX_W =     '\u2523'; // W wall with spike pointing E

var colors = [
    '#f00', // red
    '#f80', // orange
    '#cc0', // dark yellow
    '#0c0', // green
    '#08f', // dark cyan
    '#00f', // blue
    '#80f', // purple
    '#f0f', // magenta
];

var swimLaneToRequestId = [];
var requestIdToSwimLane = {};

// These functions are only used by GetConsoleLogArgsForRequestIdAliveOrDead
var GetSwimLane = function(requestId) {
  return requestIdToSwimLane[requestId]; // can be undefined
};
var AllocateSwimLane = function(requestId) {
  if (requestId in requestIdToSwimLane) {
    return requestIdToSwimLane[requestId];
  }
  var swimLane;
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
var ReleaseSwimLane = function(requestId) {
  var swimLane = requestIdToSwimLane[requestId];
  delete requestIdToSwimLane[requestId];
  swimLaneToRequestId[swimLane] = null;
};

var now0 = Date.now();


var GetConsoleLogArgsForRequestIdAliveOrDead = function(requestId, isEnd) {
  var verboseLevel = 0;
  if (verboseLevel >= 1) console.log("in GetConsoleLogArgsForRequestIdAliveOrDead(requestId="+EXACT(requestId)+", isEnd="+EXACT(isEnd)+")");
  var swimLane = GetSwimLane(requestId);
  var hadSwimLane = (swimLane !== undefined);
  if (!hadSwimLane) {
    swimLane = AllocateSwimLane(requestId);
  }

  var myColor = colors[requestId % colors.length];
  if (!hadSwimLane) {
    if (!isEnd) {
      var myChar = BOX_NW;
    } else {
      var myChar = BOX_HORIZ; // not ideal
    }
  } else {
    if (!isEnd) {
      var myChar = BOX_W;
    } else {
      var myChar = BOX_SW;
    }
  }

  var maxSwimLane = swimLaneToRequestId.length - 1;
  while (maxSwimLane >= 0 && swimLaneToRequestId[maxSwimLane] == null) {
    maxSwimLane--;
  }
  var answer = [""];

  if (true) {
    answer[0] += "%c%s";
    answer.push("color:black");
    var ms = Date.now() - now0;
    var s = ms / 1000.;
    answer.push(""+s.toFixed(3)+" ");
  }

  for (var i = 0; i <= maxSwimLane; ++i) {
    var r = swimLaneToRequestId[i];

    if (r === null) {
      if (i < swimLane) {
        var color = "black";
        var c = " ";
      } else {
        var color = myColor;
        var c = BOX_HORIZ;
      }
    } else {
      if (i < swimLane) {
        var color = colors[r % colors.length];
        var c = BOX_VERT;
      } else if (i == swimLane) {
        var color = myColor;
        var c = myChar;
      } else {
        var verticalTakesPrecedence = true; // can hard-code this either way
        if (verticalTakesPrecedence) {
          var color = colors[r % colors.length];
          var c = BOX_VERT;
        } else {
          var color = myColor;
          var c = BOX_HORIZ;
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

  if (isEnd) {
    ReleaseSwimLane(requestId);
  }
  if (verboseLevel >= 1) console.log("out GetConsoleLogArgsForRequestIdAliveOrDead(requestId="+EXACT(requestId)+", isEnd="+EXACT(isEnd)+"), returning "+EXACT(answer));
  return answer;
}; // GetConsoleLogArgsForRequestIdAliveOrDead


// Example of reliably coloring console.log output:
//   console.log("%c%s%c%s", "color:red;font-weight:bold", "this comes out in bold red", "color:green", " and this comes out in normal green");
// details.requestId is used, and maybe detail.url for debugging weirdness.
var requestLogBuffer = [""];
var RequestLogAliveOrDead = function(requestId, string, isEnd) {
  var args = GetConsoleLogArgsForRequestIdAliveOrDead(requestId, isEnd);
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
    for (var i = 1; i < args.length; ++i) { // skip 0
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
var RequestLogAlive = function(requestId, string) {
  return RequestLogAliveOrDead(requestId, string, false);
};
var RequestLogDead = function(requestId, string) {
  return RequestLogAliveOrDead(requestId, string, true);
};
var RequestLogFlush = function() {
  if (requestLogBuffer.length != 1) {
    console.log.apply(console, requestLogBuffer);
    requestLogBuffer = [""];
  }
};

// Contains, for each requestId,
// a dictionary with the following:
//      Origin: value of "Origin:" header if any
//      traceStrings: an array of strings containing a trace of what happened.
var stash = new Object;

// TODO: use this to make sure that when we see things not in stash, we've NEVER seen them... then get rid of this!
// so logic should go:
//      if not in stash
//        if ever seen before:
//          alert!
var allIdsEverSeenSet = new Set;
var allIdsEverSeenList = [];

var getHeader = function(headers, name) {
  var nameToLowerCase = name.toLowerCase();
  for (var i = 0; i < headers.length; i++) {
    if (headers[i].name.toLowerCase() === nameToLowerCase) {
      return headers[i].value;
    }
  }
  return null;
};  // getHeader
var setHeader = function(headers, name, value, requestIdForLogging) {
  var nameToLowerCase = name.toLowerCase();
  for (var i = 0; i < headers.length; i++) {
    if (headers[i].name.toLowerCase() === nameToLowerCase) {
      if (verboseLevel >= 2) RequestLogAlive(requestIdForLogging, "      changing header "+EXACT(headers[i].name)+" to "+EXACT(value));
      headers[i].value = value;
      return;
    }
  }
  if (verboseLevel >= 2) RequestLogAlive(requestIdForLogging, "      adding header "+EXACT(name)+" : "+EXACT(value));
  headers.push({name:name, value:value});
};  // setHeader







//
// Define and install chrome.webRequest listeners.
//
var onBeforeRequestListener = function(details) {

  if (!allIdsEverSeenSet.has(details.requestId)) {
    allIdsEverSeenSet.add(details.requestId);
    allIdsEverSeenList.push(details.requestId);
  }

  
  if (details.requestId in stash) {
    // This happens, on redirects (including switcheroos done by this extension and others)
  } else {
    stash[details.requestId] = {
      traceStrings: [],
      urls: [],
    };
  }
  stash[details.requestId].traceStrings.push("onBeforeRequest: method = "+EXACT(details.method)+" url = "+EXACT(details.url));
  stash[details.requestId].urls.push(details.url);

  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "[   in onBeforeRequest listener: "+EXACT(details.method)+" "+EXACT(details.url));
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "      details = "+EXACT(details));
  var answer = null;

  // XXX TODO: what is the most graceful way of just sending my extension a signal? can do with messages but... would be nice to just do it in the browser or something? hmm
  // can I make this request return a web page??? could do it with something obscene by sending a request to google.com and replacing the response, but... what's a better way?
  // Maybe a good question for StackOverflow.
  if (details.url === "http://heyheyhey/") {
    if (verboseLevel >= 2) RequestLogFlush();
    console.log("---------------------------------------------");
    console.log(""+details.requestId+": got special request "+details.url);
    console.log("stash = ",stash);
    console.log("stash = "+EXACT(stash));
    console.log("allIdsEverSeenList = "+EXACT(allIdsEverSeenList));
    console.log("swimLaneToRequestId.length = ",swimLaneToRequestId.length);
    console.log("swimLaneToRequestId = ",swimLaneToRequestId);
    console.log("requestIdToSwimLane = ",requestIdToSwimLane);

    // Show current status of all outstanding
    if (verboseLevel >= 2) {
      for (var i = 0; i < swimLaneToRequestId.length; ++i) {
        var requestId = swimLaneToRequestId[i];
        if (requestId != null) {
          // It has a swim lane, so it should have a stash entry too
          if (stash[requestId] === undefined) {
            alert("chromeWebRequestExample extension: Internal error: requestId="+requestId+" has a swim lane but no stash entry?!?");
            console.log("Internal error: requestId="+requestId+" has a swim lane but no stash entry?!?");
          } else {
            RequestLogAlive(requestId, " "+EXACT(stash[requestId].urls)); // note, calling with requestId instead of details!
          }
        }
      }
      RequestLogFlush();
    }
    console.log("---------------------------------------------");

    answer = {cancel : true};
  }

  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    out onBeforeRequest listener, returning "+EXACT(answer));
  //if (verboseLevel >= 2) RequestLogFlush();  // evidently might might be a while before more output
  return answer;
};  // onBeforeRequestListener
// aka requestListener
var onBeforeSendHeadersListener = function(details) {
  // empirically, we never seem to get this unless onBeforeRequestListener has been called, so don't need to check.
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    in onBeforeSendHeaders listener: "+EXACT(details.method)+" "+EXACT(details.url));
  if (verboseLevel >= 3) RequestLogAlive(details.requestId, "      details = "+EXACT(details));

  var Origin = getHeader(details.requestHeaders, "Origin");
  if (Origin != null) {
    if (verboseLevel >= 2) RequestLogAlive(details.requestId, "      stashing request id "+details.requestId+" Origin: "+EXACT(Origin));
    stash[details.requestId].Origin = Origin;
  }

  if (!allIdsEverSeenSet.has(details.requestId)) {
    console.log("hey! onBeforeSendHeaders listener never saw id="+details.requestId+" before: "+details.url);
    alert("hey! onBeforeSendHeaders listener never saw id="+details.requestId+" before: "+details.url);
    return null;
  }
  var answer = null;
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    out onBeforeSendHeaders listener, returning "+EXACT(answer));
  return answer;
};  // onBeforeSendHeadersListener
var onSendHeadersListener = function(details) {
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    in onSendHeaders listener");
  if (!allIdsEverSeenSet.has(details.requestId)) {
    alert("hey! onSendHeaders listener never saw id="+details.requestId+" before: "+details.url);
    return null;
  }
  var answer = null;
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    out onSendHeaders listener, returning "+EXACT(answer));
  if (verboseLevel >= 2) RequestLogFlush();  // definitely might be a while before more output
  return answer;
};  // onSendHeadersListener
// aka responseListener
var onHeadersReceivedListener = function(details) {
/*
  if (!(details.requestId in stash)) {
    console.info("in onHeadersReceived for requestId="+details.requestId+" but I haven't seen it before, assuming it was initiated before this extension was loaded, ignoring it: ",details);
    return null; // I think this is shorthand for "don't change it"
  }
*/
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    in onHeadersReceived listener: "+EXACT(details.method)+" "+EXACT(details.url)+" -> "+details.statusCode);
  if (verboseLevel >= 3) RequestLogAlive(details.requestId, "      details = "+EXACT(details));
  if (!allIdsEverSeenSet.has(details.requestId)) {
    alert("hey! onHeadersReceived listener never saw id="+details.requestId+" before: details.url="+EXACT(details.url)+" details="+EXACT(details));
    return null;
  }

  var answer = null;
  if (allowCORSFlag) {
    var Origin = stash[details.requestId].Origin;
    if (Origin !== undefined) {
      setHeader(details.responseHeaders, "Access-Control-Allow-Origin", Origin, details);
    } else {
      setHeader(details.responseHeaders, "Access-Control-Allow-Origin", "*", details);
    }
    // The following is required when using ajax with withCredentials=true, but doesn't hurt in general
    setHeader(details.responseHeaders, "Access-Control-Allow-Credentials", "true", details);
    answer = {responseHeaders: details.responseHeaders};
    if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    out onHeadersReceived listener, returning "+Object.keys(answer.responseHeaders).length+" headers"+(verboseLevel>=3 ? ": "+EXACT(answer) : ""));
  } else {
    if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    out onHeadersReceived listener, returning "+EXACT(answer));
  }
  //if (verboseLevel >= 2) RequestLogFlush();  // evidently might might be a while before more output
  return answer;
};  // onHeadersReceivedListener
var onAuthRequiredListener = function(details) {
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    in onAuthRequired listener");
  if (!allIdsEverSeenSet.has(details.requestId)) {
    alert("hey! onAuthRequired listener never saw id="+details.requestId+" before: "+details.url);
    return null;
  }
  var answer = null;
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    out onAuthRequired listener, returning "+EXACT(answer));
  return answer;
};  // onAuthRequiredListener
var onBeforeRedirectListener = function(details) {
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    in onBeforeRedirect listener: "+EXACT(details.method)+" "+EXACT(details.url)+" -> "+details.statusCode+" -> "+EXACT(details.redirectUrl));
  if (verboseLevel >= 3) RequestLogAlive(details.requestId, "      details = "+EXACT(details));
  if (!allIdsEverSeenSet.has(details.requestId)) {
    alert("hey! onBeforeRedirect listener never saw id="+details.requestId+" before: "+details.url);
    return null;
  }

  stash[details.requestId].urls.push(details.url);

  var answer = null;
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    out onBeforeRedirect listener, returning "+EXACT(answer));
  return answer;
};  // onBeforeRedirectListener
var onResponseStartedListener = function(details) {
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    in onResponseStarted listener");
  if (!allIdsEverSeenSet.has(details.requestId)) {
    alert("hey! onResponseStarted listener never saw id="+details.requestId+" before: "+details.url);
    return null;
  }
  var answer = null;
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    out onResponseStarted listener, returning "+EXACT(answer));
  return answer;
};  // onResponseStartedListener
var onCompletedListener = function(details) {
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    in onCompleted listener: "+EXACT(details.method)+" "+EXACT(details.url)+" -> "+details.statusCode);
  if (verboseLevel >= 3) RequestLogAlive(details.requestId, "      details = "+EXACT(details));
  if (!allIdsEverSeenSet.has(details.requestId)) {
    alert("hey! onCompleted listener never saw id="+details.requestId+" before: "+details.url+"(maybe initiated before this extension was loaded?)");
  } else {
    var answer = null;
    delete stash[details.requestId];
  }

  if (verboseLevel >= 2) RequestLogDead(details.requestId, "]   out onCompleted listener, returning "+EXACT(answer));
  if (verboseLevel >= 2) RequestLogFlush();  // definitely might be a while before more output
  return answer;
};  // onCompletedListener
var onErrorOccurredListener = function(details) {
  if (verboseLevel >= 2) RequestLogAlive(details.requestId, "    in onErrorOccurred listener: "+EXACT(details.method)+" "+EXACT(details.url)+" -> "+details.statusCode);
  if (verboseLevel >= 3) RequestLogAlive(details.requestId, "      details = "+EXACT(details));
  if (!allIdsEverSeenSet.has(details.requestId)) {
    alert("hey! onErrorOccurred listener never saw id="+details.requestId+" before: "+details.url+"(maybe initiated before this extension was loaded?)");
  } else {
    var answer = null;
    delete stash[details.requestId];
  }
  if (verboseLevel >= 2) RequestLogDead(details.requestId, "]   out onErrorOccurred listener, returning "+EXACT(answer));
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
var onStartupOrOnInstalledListener = function() {
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

if (verboseLevel >= 1) console.log("    out background.js");
