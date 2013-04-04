if (typeof module !== 'undefined') {
  var _ = require('underscore');
}

var request;

var config = {
  size: 8,
  singleColor: false
};

var MAX_SIZE = (config.size * config.size) - 1;

var board = {
  _pixels: [],
  _intervals: [],
  _timeouts: [],
  every: function(duration, callback) {
    if (typeof duration === 'function') {
      callback = arguments[0];
      duration = arguments[1];
    }
    this._intervals.push(setInterval(callback, duration));
  },
  after: function(duration, callback) {
    if (typeof duration === 'function') {
      callback = arguments[0];
      duration = arguments[1];
    }
    this._timeouts.push(setTimeout(callback, duration));
  },
  range: function() {
    return new Pixels(_.range.apply(_, arguments).map(function(i) {
      return _.find(this._pixels, function(pixel) {
        return pixel.index === i;
      });
    }, this));
  },
  at: function(index) {
    if (arguments.length == 2) {
      var args = arguments;
      // x y
      return new Pixels([_.find(this._pixels, function(pixel) {
        return pixel.x === args[0] && pixel.y === args[1];
      })]);
    } else {
      // index
      return new Pixels([_.find(this._pixels, function(pixel) {
        return pixel.index === index;
      })]);
    }
  },
  row: function(index) {
    return new Pixels(_.select(this._pixels, function(pixel) {
      return pixel.y == index;
    }));
  },
  column: function(index) {
    return new Pixels(_.select(this._pixels, function(pixel) {
      return pixel.x == index;
    }));
  },
  all: function() {
    return new Pixels(this._pixels);
  },
  clear: function() {
    this._intervals.forEach(function(interval) {
      clearInterval(interval);
    });
    this._timeouts.forEach(function(timeout) {
      clearTimeout(timeout);
    });
    this.all().each(function(pixel) {
      pixel.set({
        r: 0,
        g: 0,
        b: 0
      });
    });
    request('post', '/clear', {});
  },
  random: function(i) {
    if (typeof i === 'undefined') {
      i = 1;
    }
    var pixels = [];
    for (var x = 0; x < i; ++x) {
      pixels.push(this._pixels[Math.floor(Math.random() * (config.size * config.size))]);
    }
    return new Pixels(_.uniq(pixels));
  },
  set: function(data) {
    if (typeof data === 'string') {
      this.all().set(data);
    } else {
      var commands = [];
      _.each(data, function(pixel, i) {
        commands.push(_.extend({
          command: 'set',
          index: i
        }, pixel));
      }, this);
      $.ajax({
        type: 'post',
        url: '/update',
        data: {commands: commands}
      });
    }
  },
  js: function() {
    var yellw = {
      r: 241,
      g: 220,
      b: 63
    },
    black = {
      r: 50,
      g: 51,
      b: 48
    };
    this.set([
      yellw, yellw, yellw, yellw, yellw, yellw, yellw, yellw,
      yellw, yellw, yellw, yellw, yellw, yellw, yellw, yellw,
      yellw, yellw, yellw, yellw, yellw, yellw, yellw, yellw,
      yellw, black, black, black, yellw, black, black, black,
      yellw, yellw, black, yellw, yellw, black, yellw, yellw,
      yellw, yellw, black, yellw, yellw, black, black, black,
      yellw, yellw, black, yellw, yellw, yellw, yellw, black,
      yellw, black, black, yellw, yellw, black, black, black
    ]);
  }
};

//TODO: mixin Backbone.Events

function Pixels(pixels) {
  this._pixels = [];
  this.length = 0;
  _.each(pixels, addPixel, this);
}

function addPixel(pixel) {
  this[this.length] = pixel;
  this._pixels.push(pixel);
  ++this.length;
}

Pixels.prototype.has = function(index) {
  // Can be a pixel or a number
  var i = index.index || index;
  return _.find(this._pixels, function(pixel) {
    return pixel.index === i;
  });
};

Pixels.prototype.each = function(callback, context) {
  _.each(this._pixels, callback, context);
  return this;
};

Pixels.prototype.add = function() {
  _.flatten(_.toArray(arguments)).forEach(function(pixels) {
    pixels._pixels.forEach(function(pixel) {
      if (!this.has(pixel)) {
        addPixel.call(this, pixel);
      }
    }, this);
  }, this);
  return this;
};

Pixels.prototype.filter = function(callback, context) {
  return new Pixels(_.filter(this._pixels, callback, context));
};

Pixels.prototype.eq = function(index) {
  var pixel = _.find(this._pixels, function(pixel) {
    return pixel.index === index;
  });
  return new Pixels(pixel ? [pixel] : []);
};

Pixels.prototype.toArray = function() {
  return _.toArray(this._pixels);
};

Pixels.prototype.first = function() {
  return new Pixels([this._pixels[0]]);
};

Pixels.prototype.last = function() {
  return new Pixels([this._pixels[this._pixels.length - 1]]);
};

Pixels.prototype.next = function(options) {
  options = options || {
    wrap: true
  };
  var pixel = this.last()[0];
  if (!pixel) {
    return empty();
  } else {
    var targetIndex = pixel.index + 1;
    if (options.wrap) {
      return board.at(targetIndex > MAX_SIZE ? 0 : targetIndex);
    } else if (targetIndex > MAX_SIZE) {
      return empty();
    } else {
      return board.at(targetIndex);
    }
  }
};

Pixels.prototype.previous = function(options) {
  options = options || {
    wrap: true
  };
  var pixel = this.first()[0];
  if (!pixel) {
    return empty();
  } else {
    var targetIndex = pixel.index - 1;
    if (options.wrap) {
      return board.at(targetIndex < 0 ? MAX_SIZE : targetIndex);
    } else if (targetIndex < 0) {
      return empty();
    } else {
      return board.at(targetIndex);
    }
  }
};

Pixels.prototype.above = function(options) {
  options = options || {
    wrap: true
  };
  if (!this._pixels.length) {
    return empty();
  } else {
    var arr = [];
    _.each(this._pixels, function(pixel) {
        var targetY = pixel.y - 1;
        if (targetY < 0) {
          if (!options.wrap) {
            return;
          }
          targetY = config.size - 1;
        }
        arr.push(board.at(pixel.x, targetY)[0]);
    });
    return new Pixels(arr);
  }
};

Pixels.prototype.below = function(options) {
  options = options || {
    wrap: true
  };
  if (!this._pixels.length) {
    return empty();
  } else {
    var arr = [];
    _.each(this._pixels, function(pixel) {
        var targetY = pixel.y + 1;
        if (targetY > (config.size - 1)) {
          if (!options.wrap) {
            return;
          }
          targetY = 0;
        }
        arr.push(board.at(pixel.x, targetY)[0]);
    });
    return new Pixels(arr);
  }
};

Pixels.prototype.left = function(options) {
  options = options || {
    wrap: true
  };
  if (!this._pixels.length) {
    return empty();
  } else {
    var arr = [];
    _.each(this._pixels, function(pixel) {
        var targetX = pixel.x - 1;
        if (targetX < 0) {
          if (!options.wrap) {
            return;
          }
          targetX = config.size - 1;
        }
        arr.push(board.at(targetX, pixel.y)[0]);
    });
    return new Pixels(arr);
  }
};

Pixels.prototype.right = function(options) {
  options = options || {
    wrap: true
  };
  if (!this._pixels.length) {
    return empty();
  } else {
    var arr = [];
    _.each(this._pixels, function(pixel) {
        var targetX = pixel.x + 1;
        if (targetX > (config.size - 1)) {
          if (!options.wrap) {
            return;
          }
          targetX = 0;
        }
        arr.push(board.at(targetX, pixel.y)[0]);
    });
    return new Pixels(arr);
  }
};

function convertColor() {
  var color;
  if (arguments.length === 1 && typeof arguments[0] === 'string') {
    var hex = arguments[0];
    if (!hex.match(/^#/)) {
      hex = hexFromColorName(hex);
    }
    hex = hex.replace(/^#/, '');
    color = {
      r: parseInt(hex.substr(0, 2), 16),
      g: parseInt(hex.substr(2, 2), 16),
      b: parseInt(hex.substr(4, 2), 16)
    };
  } else {
    color = arguments[0] || {
      r: 0,
      g: 0,
      b: 0
    };
  }
  return color;
}

function hexFromColorName(colour) {
  var colours = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
  "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
  "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
  "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
  "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
  "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
  "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
  "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
  "honeydew":"#f0fff0","hotpink":"#ff69b4",
  "indianred ":"#cd5c5c","indigo ":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
  "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
  "lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
  "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
  "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
  "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
  "navajowhite":"#ffdead","navy":"#000080",
  "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
  "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
  "red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
  "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
  "tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
  "violet":"#ee82ee",
  "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
  "yellow":"#ffff00","yellowgreen":"#9acd32"};

  if (typeof colours[colour.toLowerCase()] != 'undefined') {
    return colours[colour.toLowerCase()];
  }

  return false;
};

Pixels.prototype.set = function(color) {
  color = convertColor.apply(this, arguments);
  _.each(this._pixels, function(pixel) {
    pixel.set(color);
  });
  var commands = [];
  _.each(this._pixels, function(pixel) {
    commands.push(_.extend({
      command: 'set',
      index: pixel.index
    }, pixel.color));
  }, this);
  request('post', '/update', {commands: commands});
  return this;
};

Pixels.prototype.fade = function(from, to, duration, complete) {
  var args = arguments;
  _.each(this._pixels, function(pixel) {
    pixel.fade.apply(pixel, args);
  });
  if (complete) {
    setTimeout(complete, duration);
  }
  to = convertColor(to);
  from = convertColor(from);
  var commands = [];
  _.each(this._pixels, function(pixel) {
    commands.push({
      command: 'fade',
      index: pixel.index,
      from: from,
      to: to,
      duration: duration
    });
  }, this);
  request('post', '/update', {commands: commands});
  return this;
};

Pixels.prototype.inspect = function() {
  var output = 'Pixels (' + this.length + ')';
  if (this.length) {
    output += '{' + this._pixels.map(function(pixel) {
      return pixel.index + ': ' + (JSON.stringify({
        x: pixel.x,
        y: pixel.y,
        color: pixel.color
      }));
    }).join(' ,') + '}';
  }
  return output;
};

function Pixel(index, color) {
  this.index = index;
  this.x = index % config.size;
  this.y = Math.floor(index / config.size);
  this.set(color);
}

Pixel.prototype.set = function(color) {
  this.color = convertColor.apply(this, arguments);
};

Pixel.prototype.fade = function() {
  //...
};

function empty() {
  return new Pixels([]);
}

// init board
_.each(_.range(0, 64), function(i) {
  board[i] = board._pixels[i] = new Pixel(i);
});

if (typeof module !== 'undefined') {
  module.exports = board;
  var makeRequest = require('request'),
      url;

  board.connect = function(endpoint) {
    url = endpoint.replace(/\/$/, '');
  };

  request = function(type, urlFragment, data) {
    if (!url) {
      throw new Error('use board.connect() to set the endpoint');
    }
    makeRequest({
      headers: {
        "Content-type": "application/json"
      },
      method: type.toUpperCase(),
      url: url + urlFragment,
      body: JSON.stringify(data)
    }, function(error, response, body) {
      if (error) {
        console.log(error);
      }
    });
  };

} else {
  request = function(type, url, data) {
    return $.ajax({
      type: type,
      url: url,
      data: data
    });
  };
}