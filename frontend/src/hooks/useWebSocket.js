import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../config';

const determineWsUrl = () => {
  let url = API_BASE.replace('http', 'ws');
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('ws://')) {
    url = url.replace('ws://', 'wss://');
  }
  return url + '/ws';
};

const WS_BASE = determineWsUrl();

export default function useWebSocket({ onMessage }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true); // Start as true
  const ws = useRef(null);

  const connect = useCallback(() => {
    setIsConnecting(true);
    ws.current = new WebSocket(WS_BASE);

    ws.current.onopen = () => {
      console.log("WebSocket Connected");
      setIsConnected(true);
      setIsConnecting(false);
    };

    ws.current.onmessage = (event) => {
      if (onMessage) {
        onMessage(event);
      }
    };

    ws.current.onclose = () => {
      console.log("WebSocket Disconnected. Reconnecting...");
      setIsConnected(false);
      setIsConnecting(false); // Connection attempt finished (failed/closed)
      setTimeout(connect, 3000); // Retry every 3 seconds
    };

    ws.current.onerror = (err) => {
      console.error("WebSocket Error:", err);
      // onerror usually precedes onclose, so we rely on onclose to reset state/retry
      // but strictly handling it here:
      ws.current.close(); 
    };
  }, [onMessage]);

  useEffect(() => {
    let timeoutId = null;
    connect();

    return () => {
      if (ws.current) ws.current.close();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [connect]);

  return { isConnected, isConnecting, ws };
}
