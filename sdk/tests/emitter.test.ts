import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../src/events/emitter.js';

type TestEvents = {
  [key: string]: unknown;
  message: string;
  count: number;
};

describe('EventEmitter', () => {
  it('emits events to listeners', () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();
    emitter.on('message', handler);
    emitter.emit('message', 'hello');
    expect(handler).toHaveBeenCalledWith('hello');
  });

  it('supports multiple listeners on the same event', () => {
    const emitter = new EventEmitter<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on('message', h1);
    emitter.on('message', h2);
    emitter.emit('message', 'test');
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('removes a specific listener with off()', () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();
    emitter.on('message', handler);
    emitter.off('message', handler);
    emitter.emit('message', 'ignored');
    expect(handler).not.toHaveBeenCalled();
  });

  it('removeAllListeners clears everything', () => {
    const emitter = new EventEmitter<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on('message', h1);
    emitter.on('count', h2);
    emitter.removeAllListeners();
    emitter.emit('message', 'ignored');
    emitter.emit('count', 42);
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('does not throw when emitting an event with no listeners', () => {
    const emitter = new EventEmitter<TestEvents>();
    expect(() => emitter.emit('message', 'no one listening')).not.toThrow();
  });

  it('swallows errors from listener callbacks', () => {
    const emitter = new EventEmitter<TestEvents>();
    emitter.on('message', () => { throw new Error('boom'); });
    const after = vi.fn();
    emitter.on('message', after);
    expect(() => emitter.emit('message', 'test')).not.toThrow();
    expect(after).toHaveBeenCalledOnce();
  });
});
