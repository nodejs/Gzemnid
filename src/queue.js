'use strict';

// TODO: replace with upstream @chalker/queue
class Queue {
  constructor(limit = 1) {
    this.limit = limit;
    this.busy = 0;
    this.queue = [];
    this.onend = [];
  }

  run() {
    if (this.busy < this.limit && this.queue.length > 0) {
      this.queue.shift()();
    }
    while (this.busy === 0 && this.onend.length > 0) {
      this.onend.shift()();
    }
  }

  async end() {
    if (this.busy === 0) return;
    await new Promise(resolve => this.onend.push(resolve));
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
