export function connect(onMsg: (data: any) => void) {
  let ws: WebSocket | null = null;
  let closed = false;
  let retryTimer: any = null;

  function init() {
    if (closed) return;
    
    // Determine protocol: wss if https, ws if http
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws/tasks`);
    
    ws.onopen = () => {
      console.log('[WS] Connected');
      // Clear retry timer on successful connection
      if (retryTimer) clearTimeout(retryTimer);
    };

    ws.onmessage = e => { 
      try { 
        console.log('[WS] Message:', e.data);
        onMsg(JSON.parse(e.data));
      } catch (err) {
        console.warn('[WS] Parse error:', err);
      } 
    };

    ws.onclose = () => {
      console.log('[WS] Closed');
      if (!closed) {
        console.log('[WS] Reconnecting in 3s...');
        retryTimer = setTimeout(init, 3000);
      }
    };

    ws.onerror = (e) => {
      console.error('[WS] Error:', e);
      ws?.close();
    };
  }

  init();

  return {
    close: () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    }
  };
}
