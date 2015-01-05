var seedrandom = require("seedrandom");

function lazySeedrandom (seed) {
  var rng;
  return function () {
    if (!rng) rng = seedrandom(seed);
    return rng();
  };
}

/**
 * A Spawner is a PIXI container that contains particles.
 * particles are triggered reccurently based on parameters.
 */
function Spawner (parameters) {
  for (var k in parameters)
    this[k] = parameters[k];

  if (this.speed <= 0) throw new Error("speed must be non null positive.");
  if (typeof this.spawn !== "function") throw new Error("spawn must be a function.");

  this.lastti = null;
}

Spawner.prototype = {

  //// DEFAULTS parameters of Spawner ////

  /**
   * a function which creates a PIXI object to use for the spawing object.
   * params is an object with: {
   *   position: [x, y],
   *   velocity: [vx, vy],
   *   angle: radian,
   *   direction: [dx, dy], // The vector of length 1 oriented through angle
   *   random: aDeterministRandomFunction,
   *   timeIndex: Int,
   *   countIndex: Int
   * }
   * It is your responsability to create, update, destroy the particle depending on your needs.
   */
  spawn: function (params) { console.log("NOT IMPLEMENTED: Spawner#spawn", params); },

  // The initial absolute time
  initialTime: 0,

  // The duration interval in ms between each particle tick
  speed: 1000,

  // How much particles should be spawned per particle tick
  count: 1,
  
  // angle in radians the spawner will rotate for each particle tick
  rot: 0,

  // Spawner position = Particle initial position
  pos: [0,0],

  // Spawner initial angle at initial time
  ang: 0,

  // Spawner particle velocity
  vel: 0,

  // front pixel distance
  front: 0,

  /**
   * an optional array to describe a pattern to loop on when spawing.
   * e.g: [ 2, -1, 3, -2 ] // 2 bullets followed by 1 hole, followed by 3 bullets, followed by 2 holes
   */
  pattern: null,
  patternMask: null, // Alternatively you can use a mask: an array of 1 (bullet) and 0 (hole)

  // Determinist Randomness
  randPos: 0,
  randAng: 0,
  randVel: 0,
  seed: "",

  // The maximum number of particles to catchup after a lag (typically the app running in background in another tab)
  maxCatchup: 1000,
  // The maxium number of particles to trigger in an update loop: N.B. an update loop usually run at max 60fps, so be sure this value is enough high to not limit the spawner's speed, but enough low to not increase a lag (typically when catching up).
  maxPerLoop: 100
};

Object.defineProperty(Spawner.prototype, "pattern", {
  set: function (pattern) {
    this._pattern = pattern;
    if (pattern) {
      var seqlength = pattern.reduce(function (acc, n) { return acc + Math.abs(n); }, 0);
      var patternMask = new Uint8Array(seqlength);
      var p = 0;
      for (var i=0; i<pattern.length; ++i) {
        var v = pattern[i];
        var maskValue = v > 0 ? 1 : 0;
        var abs = Math.abs(v);
        for (var j=0; j<abs; ++j)
          patternMask[p++] = maskValue;
      }
      this.patternMask = patternMask;
    }
  },
  get: function () {
    return this._pattern;
  }
});

Spawner.prototype.timeIndexForTime = function (t) {
  return Math.floor((t - this.initialTime) / this.speed);
};

/**
 * init the spawner from a given time (usually call once with the t given to update)
 * it can be used to trigger a lot of bullets from the past
 */
Spawner.prototype.init = function (currentTime) {
  var ti = this.timeIndexForTime(currentTime);
  
  if (this.patternMask) {
    var ipattern = ti % this.patternMask.length;
    this._ip = ipattern;
  }

  this.lastti = ti;
};

// Compute the current rotation position of "heads" useful for drawing rotating weapons.
Spawner.prototype.getCurrentRotations = function (currentTime) {
  var ti = this.timeIndexForTime(currentTime); // TODO: this should do interpolation
  var angles = [];
  for (var j=0; j<this.count; ++j)
    angles.push( this.ang + (this.rot * (this.count * ti + j)) % (2*Math.PI) );
  return angles;
};

Spawner.prototype.update = function (currentTime) {
  // In case the spawner was not initialized, we use currentTime (means no catchup)
  if (this.lastti === null) this.init(currentTime);

  var currentti = this.timeIndexForTime(currentTime);
  var deltai = currentti - this.lastti;

  if (deltai > this.maxCatchup) { // Avoid overflow of particles
    console.log("Spawner: "+deltai+" particles to catchup. maximized to "+this.maxCatchup+" and lost some.");
    this.lastti = currentti -  this.maxCatchup;
  }

  // Trigger all missing particles from last tick (if any)
  for (var i=0; this.lastti < currentti && i < this.maxPerLoop; ++i) {
    var ti = ++this.lastti;
    if (this.patternMask) {
      var shouldSkip = this.patternMask[this._ip] === 0;
      this._ip = this._ip >= this.patternMask.length - 1 ? 0 : this._ip + 1;
      if (shouldSkip) continue;
    }

    var delta = currentTime - ti * this.speed;
    var random = lazySeedrandom(this.seed + "@" + ti);

    for (var j=0; j<this.count; ++j) {
      var angle = this.ang + this.randAng * (random() - 0.5) + (this.rot * (this.count * ti + j)) % (2*Math.PI);
      var direction = [ Math.cos(angle), Math.sin(angle) ];
      var vel = this.vel + this.randVel * (random() - 0.5);
      var velocity = [ vel * direction[0], vel * direction[1] ];
      var position = [
        this.pos[0] + this.randPos * (random() - 0.5) + velocity[0] * delta + this.front * direction[0],
        this.pos[1] + this.randPos * (random() - 0.5) + velocity[1] * delta + this.front * direction[1]
      ];

      this.spawn({
        random: random,
        timeIndex: ti,
        countIndex: j,
        angle: angle,
        position: position,
        velocity: velocity,
        direction: direction
      });
    }
  }

};

module.exports = Spawner;
