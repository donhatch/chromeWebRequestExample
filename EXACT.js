// from http://gfxmonk.net/dist/0install/repr.js.xml ...
// XXX get rid of these I think, once I understand them
if(Object.hasOwnProperty('getPrototypeOf')) {
  getProto = function(o) { try {
    return Object.getPrototypeOf(o);
  } catch(e) { return undefined; }
  }
} else if(Object.hasOwnProperty('__proto__')) {
  getProto = function(o) { return o.__proto__; }
}
var getName = function(o, def) {
  var p = getProto(o);
  if(p != undefined && p.hasOwnProperty('constructor') && p.constructor.hasOwnProperty('name')) {
    return p.constructor.name;
  }
  return def;
};

var EXACT = function(x) {
  var answer = "";
  if (x === null) {
    answer += "null";
  } else if (typeof(x) === "string"
          || x instanceof String // note that console.log prints Strings more ornately than this
            ) {
    var subAnswer = x;
    // XXX(donhatch)- can't  I do the following as a single replace?  didn't succeed the first time I tried
    subAnswer = subAnswer.replace(/\\/g, '\\\\'); // must come first
    subAnswer = subAnswer.replace(/\n/g, '\\n');
    subAnswer = subAnswer.replace(/\r/g, '\\r');
    // only use single quote if has double quote but no single quote
    if (x.indexOf("'") === -1 && x.indexOf('"') !== -1) {
      answer += "'" + subAnswer.replace(/'/g, "\\'") + "'";
    } else {
      answer += '"' + subAnswer.replace(/"/g, '\\"') + '"';
    }
  } else if (x instanceof Array) {
    answer += "[";
    for(var i = 0; i < x.length; i++) {
      if (i > 0) answer += ", ";
      answer += EXACT(x[i]);
    }
    answer += "]";
  } else if (x instanceof Object) {
    var subAnswer = "";
    for(var key in x) {
      if(!x.hasOwnProperty(key)) continue;
      if (subAnswer.length !== 0) subAnswer += ", ";
      if (typeof(key) !== "string") throw new Error("hey! type of key "+EXACT(key)+" is "+EXACT(typeof(key))+", expected \"string\"!");
      var keyString = key;
      if (keyString.indexOf("'") != -1
       || keyString.indexOf('"') != -1
       || keyString.indexOf(' ') != -1
       || keyString.indexOf('\\') != -1) {
        keyString = EXACT(keyString);
      }
      subAnswer += keyString + ": " + EXACT(x[key]);
    }
    answer += "(" + getName(x, x.valueOf()) + "){" + subAnswer + "}";
  } else {
    answer += "" + x;
  }
  // answer = "[type="+typeof(x)+": (x instanceof Array)="+(x instanceof Array)+": "+answer+"]";
  return answer;
}

var EXACTtest = function() {
  // this is pretty disorganized
  console.log("          something ,",new String("abc"));
  console.log("          something ,",{1:2,3:4});
  console.log("          something ,",{'':2,3:4});
  console.log("          something ,",{' ':2,3:4});
  console.log("          something ,",{'"':2,3:4});
  console.log("          something ,",{"'":2,3:4});
  console.log("          something ,",{"''":2,3:4});
  console.log("          something ,",{'""':2,3:4});
  console.log("          something ,",{'" "':2,3:4});
  console.log("          something ,",{"' '":2,3:"4"});
  console.log("          something ,",{"\\":2,3:"4"});
  console.log("          something +"+EXACT({1:2,3:4}));
  console.log("          something +"+EXACT({'':2,3:4}));
  console.log("          something +"+EXACT({' ':2,3:4}));
  console.log("          something +"+EXACT({'"':2,3:4}));
  console.log("          something +"+EXACT({"'":2,3:4}));
  console.log("          something +"+EXACT({"''":2,3:4}));
  console.log("          something +"+EXACT({'""':2,3:4}));
  console.log("          something +"+EXACT({'" "':2,3:4}));
  console.log("          something +"+EXACT({"' '":2,3:"4"}));
  console.log("          something +"+EXACT({"\\":2,3:"4"}));
  var s = new String("aaaaa");
  var foo = {1:2,3:4};
  foo[s] = "bbbbbb";
  console.log("          something ,",s);
  console.log("          something +"+EXACT(s));
  console.log("          something +"+EXACT(typeof(s)));
  var s = new String("xxx");
  var s = "xxx";
  s["aa"] = "bb";
  console.log("          something ,",s);
  console.log("          something +"+EXACT(s));
  console.log("          something +"+EXACT(typeof(s)));
  console.log("          something ,",s["aa"]);

  console.log("          something +"+EXACT(foo));
  //console.log("          something +"+EXACT({(new String("\\")):2,3:"4"}));
  console.log("          something +"+EXACT([1,"two",3,"four"]));
  console.log("          something +"+EXACT("\"'\"'\"\r\n"));
}

