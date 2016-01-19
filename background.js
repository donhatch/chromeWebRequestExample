var verboseLevel = 2; // 0: nothing, 1: extension init and errors, 2: more
if (verboseLevel >= 1) console.log("    in background.js");

// http://stackoverflow.com/questions/9332979/change-console-log-message-color
function colorTrace(msg, color) {
  //console.log("%c" + msg, "color:" + color + ";font-weight:bold;");
  console.log("%c" + msg, "color:" + color + ";");
}

var colors = [
    '#f00', // red
    '#f80', // orange
    '#cc0', // dark yellow
    '#0f0', // green
    '#0ff', // cyan
    '#00f', // blue
    '#80f', // purple
    '#f0f', // magenta
];

//
// Define and install chrome.webRequest listeners.
//
var onBeforeRequestListener = function(details) {
  var color = colors[details.requestId % colors.length];
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c [", "color:"+color, "color:black");
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     in onBeforeRequest listener", "color:"+color, "color:black");
  var answer = null;
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     out onBeforeRequest listener, returning "+EXACT(answer), "color:"+color, "color:black");
  return answer;
};  // onBeforeRequestListener
var onBeforeSendHeadersListener = function(details) {
  var color = colors[details.requestId % colors.length];
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     in onBeforeSendHeaders listener", "color:"+color, "color:black");
  var answer = null;
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     out onBeforeSendHeaders listener, returning "+EXACT(answer), "color:"+color, "color:black");
  return answer;
};  // onBeforeSendHeadersListener
var onSendHeadersListener = function(details) {
  var color = colors[details.requestId % colors.length];
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     in onSendHeaders listener", "color:"+color, "color:black");
  var answer = null;
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     out onSendHeaders listener, returning "+EXACT(answer), "color:"+color, "color:black");
  return answer;
};  // onSendHeadersListener
var onHeadersReceivedListener = function(details) {
  var color = colors[details.requestId % colors.length];
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     in onHeadersReceived listener", "color:"+color, "color:black");
  var answer = null;
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     out onHeadersReceived listener, returning "+EXACT(answer), "color:"+color, "color:black");
  return answer;
};  // onHeadersReceivedListener
var onAuthRequiredListener = function(details) {
  var color = colors[details.requestId % colors.length];
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     in onAuthRequired listener", "color:"+color, "color:black");
  var answer = null;
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     out onAuthRequired listener, returning "+EXACT(answer), "color:"+color, "color:black");
  return answer;
};  // onAuthRequiredListener
var onBeforeRedirectListener = function(details) {
  var color = colors[details.requestId % colors.length];
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     in onBeforeRedirect listener", "color:"+color, "color:black");
  var answer = null;
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     out onBeforeRedirect listener, returning "+EXACT(answer), "color:"+color, "color:black");
  return answer;
};  // onBeforeRedirectListener
var onResponseStartedListener = function(details) {
  var color = colors[details.requestId % colors.length];
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     in onResponseStarted listener", "color:"+color, "color:black");
  var answer = null;
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     out onResponseStarted listener, returning "+EXACT(answer), "color:"+color, "color:black");
  return answer;
};  // onResponseStartedListener
var onCompletedListener = function(details) {
  var color = colors[details.requestId % colors.length];
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     in onCompleted listener", "color:"+color, "color:black");
  var answer = null;
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     out onCompleted listener, returning "+EXACT(answer), "color:"+color, "color:black");
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c ]", "color:"+color, "color:black");
  return answer;
};  // onCompletedListener
var onErrorOccurredListener = function(details) {
  var color = colors[details.requestId % colors.length];
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     in onErrorOccurred listener", "color:"+color, "color:black");
  var answer = null;
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c     out onErrorOccurred listener, returning "+EXACT(answer), "color:"+color, "color:black");
  if (verboseLevel >= 2) console.log("        %c"+details.requestId+"%c ]", "color:"+color, "color:black");
  return answer;
};  // onErrorOccurredListener
chrome.webRequest.onBeforeRequest.addListener(onBeforeRequestListener, {urls:["<all_urls>"]}, ["blocking"]);  // options: blocking, requestBody
chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeadersListener, {urls:["<all_urls>"]}, ["blocking", "requestHeaders"]);  // options: requestHeaders, blocking
chrome.webRequest.onSendHeaders.addListener(onSendHeadersListener, {urls:["<all_urls>"]}, ["requestHeaders"]);  // options: requestHeaders
chrome.webRequest.onHeadersReceived.addListener(onHeadersReceivedListener, {urls:["<all_urls>"]}, ["blocking", "responseHeaders"]);  // options: blocking, responseHeaders
chrome.webRequest.onAuthRequired.addListener(onAuthRequiredListener, {urls:["<all_urls>"]}, ["blocking", "responseHeaders"]);  // options: responseHeaders, blocking, asyncBlocking
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
