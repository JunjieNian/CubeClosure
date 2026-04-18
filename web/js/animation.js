/**
 * animation.js — Phase transition animation with smooth interpolation
 */

export class AnimationController {
  constructor() {
    this.states = [];
    this.titles = [];
    this.currentState = 0;
    this.playing = false;
    this.speed = 1.0;
    this.autoLoop = true;

    // Animation timing
    this._transitioning = false;
    this._transitionStart = 0;
    this._transitionDuration = 1000; // ms
    this._pauseBetween = 600; // ms pause at each state
    this._lastStateTime = 0;

    // Callbacks
    this.onStateChange = null;
    this.onTransitionProgress = null;
  }

  /** Load states from codebook computation */
  loadStates(states, titles) {
    this.states = states;
    this.titles = titles;
    this.currentState = 0;
    this._transitioning = false;
  }

  get totalStates() { return this.states.length; }
  get currentTitle() { return this.titles[this.currentState] || ''; }
  get currentPositions() { return this.states[this.currentState]; }

  /** Get the major phase number (0, 1, or 2) */
  get currentPhase() {
    const s = this.currentState;
    if (s <= 0) return 0;
    if (s <= 3) return '0→1';
    if (s <= 6) return '1→2';
    if (s <= 9) return '2→0';
    return 0;
  }

  /** Get sub-step description */
  get subStep() {
    const s = this.currentState % 3;
    if (this.currentState === 0) return '';
    if (s === 1) return 'X axis';
    if (s === 2) return 'X+Y axes';
    if (s === 0) return 'X+Y+Z axes (complete)';
    return '';
  }

  play() {
    this.playing = true;
    this._lastStateTime = performance.now();
  }

  pause() {
    this.playing = false;
  }

  togglePlay() {
    if (this.playing) this.pause();
    else this.play();
    return this.playing;
  }

  stepForward() {
    if (this._transitioning) return;
    const next = this.currentState + 1;
    if (next < this.states.length) {
      this._startTransition(next);
    } else if (this.autoLoop) {
      this._startTransition(0);
    }
  }

  stepBackward() {
    if (this._transitioning) return;
    const prev = this.currentState - 1;
    if (prev >= 0) {
      this._startTransition(prev);
    } else if (this.autoLoop) {
      this._startTransition(this.states.length - 1);
    }
  }

  goToState(index) {
    if (index >= 0 && index < this.states.length && !this._transitioning) {
      this._startTransition(index);
    }
  }

  setSpeed(speed) {
    this.speed = Math.max(0.25, Math.min(4.0, speed));
  }

  _startTransition(targetState) {
    this._transitioning = true;
    this._transitionStart = performance.now();
    this._targetState = targetState;

    if (this.onStateChange) {
      this.onStateChange(targetState, this.titles[targetState]);
    }
  }

  /**
   * Update animation. Call every frame.
   * Returns { positions, progress, stateChanged } or null if no update needed.
   */
  update(now) {
    if (this._transitioning) {
      const elapsed = now - this._transitionStart;
      const duration = this._transitionDuration / this.speed;
      let t = Math.min(elapsed / duration, 1.0);

      // Ease in-out cubic
      t = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

      if (elapsed >= duration) {
        // Transition complete
        this.currentState = this._targetState;
        this._transitioning = false;
        this._lastStateTime = now;

        return {
          positions: this.states[this.currentState],
          progress: 1.0,
          stateChanged: true,
          snap: true,
        };
      }

      // Interpolate between current state positions and target state positions
      const from = this.states[this.currentState];
      const to = this.states[this._targetState];
      const interpolated = [];
      for (let i = 0; i < from.length; i++) {
        interpolated.push([
          from[i][0] + (to[i][0] - from[i][0]) * t,
          from[i][1] + (to[i][1] - from[i][1]) * t,
          from[i][2] + (to[i][2] - from[i][2]) * t,
        ]);
      }

      return {
        positions: interpolated,
        progress: t,
        stateChanged: false,
        snap: false,
      };
    }

    // Auto-play: advance after pause
    if (this.playing) {
      const pauseDuration = this._pauseBetween / this.speed;
      if (now - this._lastStateTime > pauseDuration) {
        const next = this.currentState + 1;
        if (next < this.states.length) {
          this._startTransition(next);
        } else if (this.autoLoop) {
          this._startTransition(0);
        } else {
          this.playing = false;
        }
      }
    }

    return null;
  }
}
