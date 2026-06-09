import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshotBroadcaster } from '../server/snapshotBroadcaster.mjs';

test('coalesces many update requests into one broadcast per interval', () => {
  const sentSnapshots = [];
  const timers = [];
  const broadcaster = createSnapshotBroadcaster({
    intervalMs: 100,
    sendSnapshot: () => sentSnapshots.push('snapshot'),
    setTimer: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimer: () => {},
  });

  broadcaster.requestBroadcast();
  broadcaster.requestBroadcast();
  broadcaster.requestBroadcast();

  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 100);
  assert.deepEqual(sentSnapshots, []);

  timers[0].callback();

  assert.deepEqual(sentSnapshots, ['snapshot']);
});

test('broadcasts immediately for join and leave events', () => {
  const sentSnapshots = [];
  const broadcaster = createSnapshotBroadcaster({
    intervalMs: 100,
    sendSnapshot: () => sentSnapshots.push('snapshot'),
    setTimer: () => 1,
    clearTimer: () => {},
  });

  broadcaster.broadcastNow();

  assert.deepEqual(sentSnapshots, ['snapshot']);
});
