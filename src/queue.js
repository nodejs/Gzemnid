'use strict';

class Queue {
  constructor(limit = 1) {
    this.limit = limit;
    this.busy = 0;
    this.queue = [];
  }

  run() {
    if (this.busy < this.limit && this.queue.length > 0) {
      this.queue.shift()();
    }
  }

  claim() {
    let done = false;
    return new Promise(accept => {
      this.queue.push(() => {
        this.busy++;
        accept(() => {
          if (done) return;
          done = true;
          this.release();
        });
      });
      this.run();
    });
  }

  release() {
    this.busy--;
    this.run();
  }

  get size() {
    return this.queue.length + this.busy;
  }
}

module.exports = Queue;
