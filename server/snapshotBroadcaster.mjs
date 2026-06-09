export function createSnapshotBroadcaster({
  intervalMs,
  sendSnapshot,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let timer;

  function requestBroadcast() {
    if (timer) {
      return;
    }

    timer = setTimer(() => {
      timer = undefined;
      sendSnapshot();
    }, intervalMs);
  }

  function broadcastNow() {
    if (timer) {
      clearTimer(timer);
      timer = undefined;
    }

    sendSnapshot();
  }

  return {
    requestBroadcast,
    broadcastNow,
  };
}
