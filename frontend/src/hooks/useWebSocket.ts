import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE } from "../config";
import { WEBSOCKET } from "../constants";

const determineWsUrl = (): string => {
  let url = API_BASE.replace("http", "ws");
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    url.startsWith("ws://")
  ) {
    url = url.replace("ws://", "wss://");
  }
  return url + "/ws";
};

const WS_BASE = determineWsUrl();

interface UseWebSocketProps {
  onMessage: (event: MessageEvent) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
}

export default function useWebSocket({
  onMessage,
}: UseWebSocketProps): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const ws = useRef<WebSocket | null>(null);
  const onMessageRef = useRef<(event: MessageEvent) => void>(onMessage);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isConnectingRef = useRef<boolean>(false);
  const connectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (
      isConnectingRef.current ||
      (ws.current && ws.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

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

    ws.current.onmessage = (event: MessageEvent) => {
      if (onMessageRef.current) {
        onMessageRef.current(event);
      }
    };

    ws.current.onclose = () => {
      console.log("WebSocket Disconnected. Reconnecting...");
      setIsConnected(false);
      setIsConnecting(false);
      isConnectingRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(
        () => connectRef.current?.(),
        WEBSOCKET.RECONNECT_DELAY,
      );
    };

    ws.current.onerror = (err: Event) => {
      console.error("WebSocket Error:", err);
      ws.current?.close();
    };
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connectRef.current?.();

    return () => {
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

  return { isConnected, isConnecting };
}
