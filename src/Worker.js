import _ from 'lodash';
import assert from 'assert';
import Bluebird from 'bluebird';
import _debug from 'debug';
import { EventEmitter } from 'events'
import util from 'util';

const debug = _debug('kopeer:worker');

/**
 * Error when a piece of work failed.
 */
function WorkFailedError(work, e) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = `Work ${ work.toString() } failed: '${ e.toString() }'`;
  this.work = work;
  this.reason = e;
};

util.inherits(WorkFailedError, Error);

/**
 * A promise-based worker that scales as needed.
 */
export default class Worker extends EventEmitter {

  /**
   * A worker
   *
   * @constructor
   *
   * @param {Function} fn
   * The work function. Each piece of work is applied to this function. This
   * function should return a promise.
   *
   * @param {Object} opts
   *
   * @param {Number} opts.limit
   * The maximum amount of spawned workers.
   *
   * @param {Function} recover
   * The recovery function. When a piece of work failes, this function will be
   * invoked with a "retry" trigger, that - if invoked - will cause the failed
   * computation to re-run.
   */
  constructor(fn, { limit=512, recover }) {
    super();
    assert.strictEqual(typeof fn, 'function');
    this._fn = fn;
    this._recover = recover || _.constant(undefined);
    this._limit = limit;
    this._threads = [];
    this._queue = [];
    this._disposed = false;
    this._errors = new Bluebird.AggregateError();
  }

  _debugStatus() {
    debug(
      'threads:', this._threads.length
    , 'queue:',   this._queue.length
    )
  }

  /**
   * Run a single piece of work.
   *
   * The worker will keep looking for new work after completion by popping the
   * queue. If the queue is empty, the worker will halt execution until later.
   *
   * For every completed item the `next` event is emitted with the result of the
   * work.
   *
   * Whenever all items in the queue have been processed, the `drain` event
   * is fired.
   *
   * @param {any} work
   * The work to process.
   *
   * @param {Number} threadIndex
   * The index of this thread in the thread map.
   *
   * @returns {Promise}
   */
  _run(work, threadIndex) {
    this._debugStatus();
    const ldebug = function() {
      debug.apply(
        null, ['thread-' + threadIndex].concat(_.toArray(arguments)));
    };
    return this._fn(work)
      .cancellable()
      .tap(this.emit.bind(this, 'next'))
      .then(
        next => {
          ldebug('completed work');
          this._debugStatus();
          if (this._queue.length) {
            ldebug('processing next work off queue');
            return this._run(this._queue.shift(), threadIndex);
          } else {
            if (_.all(
              this._threads, (t, i) => i === threadIndex || !t.isPending()))
            {
              ldebug('no threads pending - emitting `drain`');
              this.emit('drain');
            }
            return Bluebird.resolve();
          }
        }
      , e => {
          if (e instanceof Bluebird.CancellationError) {
            ldebug('Cancelled!');
            this._errors.push(new WorkFailedError(work, e));
          } else {
            let shouldRetry = false;
            this._recover(e, () => { shouldRetry = true; });
            if (shouldRetry) {
              return this._run(work, threadIndex);
            } else {
              this._errors.push(new WorkFailedError(work, e));
              this.kill();
            }
          }
        });
  }

  /**
   * Queue a single piece of work.
   *
   * If the pool of workers is not yet exhaused (reached the limit), create a
   * new worker and run the work. Otherwise push it onto the queue for
   * processing later.
   *
   * @param {any} work
   * The work to process.
   *
   * @returns {undefined}
   */
  queue(work) {
    if (this._disposed) { return; } // XXX: Throw error?

    const freeIndex = _.findIndex(this._threads, t => !t.isPending())
    if (freeIndex === -1) {
      if (this._threads.length < this._limit) {
        debug('creating new thread');
        this._threads.push(this._run(work, this._threads.length));
        this._debugStatus();
      } else {
        debug('full! Pushing work on queue');
        this._queue.push(work);
        this._debugStatus();
      }
    } else {
      debug('running on free worker');
      this._thread[freeIndex] =
        this._thread[freeIndex]
          .then(() => this._run(work, freeIndex));
      this._debugStatus();
    }
  }

  dispose() {
    if (this._disposed) { return; }

    _.each(this._threads, t => t.cancel());

    if (this._errors.length) {
      this.emit('failed', this._errors);
    } else {
      this.emit('completed');
    }

    this._threads.length = 0;
    this._queue.length = 0;
  }

  kill() {
    this.dispose();
  }
}
