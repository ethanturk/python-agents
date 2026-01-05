import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../config';
import { WEBSOCKET } from '../constants';

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
  const onMessageRef = useRef(onMessage);
  const reconnectTimeoutRef = useRef(null);
  const isConnectingRef = useRef(false);

  // Keep onMessage ref up to date without triggering reconnects
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || (ws.current && ws.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // Clear any existing connection
    if (ws.current) {
      ws.current.onopen = null;
      ws.current.onmessage = null;
      ws.current.onclose = null;
      ws.current.onerror = null;
      ws.current.close();
    }

    isConnectingRef.current = true;
    setIsConnecting(true);
    ws.current = new WebSocket(WS_BASE);

    ws.current.onopen = () => {
      console.log("WebSocket Connected");
      setIsConnected(true);
      setIsConnecting(false);
      isConnectingRef.current = false;
    };

    ws.current.onmessage = (event) => {
      if (onMessageRef.current) {
        onMessageRef.current(event);
      }
    };

    ws.current.onclose = () => {
      console.log("WebSocket Disconnected. Reconnecting...");
      setIsConnected(false);
      setIsConnecting(false);
      isConnectingRef.current = false;

      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Retry after configured delay
      reconnectTimeoutRef.current = setTimeout(connect, WEBSOCKET.RECONNECT_DELAY);
    };

    ws.current.onerror = (err) => {
      console.error("WebSocket Error:", err);
      // onerror usually precedes onclose, so we rely on onclose to reset state/retry
      // but strictly handling it here:
      ws.current.close();
    };
  }, []); // No dependencies - stable function

  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onclose = null;
        ws.current.onerror = null;
        ws.current.close();
      }
      isConnectingRef.current = false;
    };
  }, [connect]);

  return { isConnected, isConnecting, ws };
}
