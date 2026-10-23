// Fixed-timestep game loop. Physics runs at a steady rate (default 120 steps per
// second) no matter the screen refresh rate; rendering happens once per display
// frame with an interpolation factor so motion stays smooth on 60/144/240 Hz screens.

export class Loop {
  constructor({ step = 1 / 120, maxSteps = 8, update, render }) {
    this.step = step;
    this.maxSteps = maxSteps;
    this.update = update; // (dt) => void, fixed step
    this.render = render; // (frameDt, alpha) => void
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.timeScale = 1;
    this.frame = 0;
    this.simTime = 0;
    this.fps = 0;
    this._fpsAcc = 0;
    this._fpsFrames = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
  }

  _tick(now) {
    if (!this.running) return;
    requestAnimationFrame(this._tick);
    let frameDt = (now - this.last) / 1000;
    this.last = now;
    if (frameDt > 0.25) frameDt = 0.25; // tab was hidden or a long stall: don't spiral
    if (frameDt < 0) frameDt = 0;
    this._fpsAcc += frameDt;
    this._fpsFrames++;
    if (this._fpsAcc >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAcc;
      this._fpsAcc = 0;
      this._fpsFrames = 0;
    }
    this.acc += frameDt * this.timeScale;
    let steps = 0;
    while (this.acc >= this.step && steps < this.maxSteps) {
      this.update(this.step);
      this.simTime += this.step;
      this.acc -= this.step;
      steps++;
    }
    if (steps >= this.maxSteps) this.acc = 0;
    this.frame++;
    this.render(frameDt, this.acc / this.step);
  }
}
