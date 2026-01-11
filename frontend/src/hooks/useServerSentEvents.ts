import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE } from "../config";
import { getIdToken } from "firebase/auth";
import { auth } from "../firebase";

const SSE_BASE = API_BASE + "/sse";

interface UseSSEProps {
  onMessage: (data: any) => void;
}

interface UseSSEReturn {
  isConnected: boolean;
  isConnecting: boolean;
}

export default function useServerSentEvents({
  onMessage,
}: UseSSEProps): UseSSEReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const eventSource = useRef<EventSource | null>(null);
  const onMessageRef = useRef<(data: any) => void>(onMessage);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(async () => {
    if (eventSource.current) {
      eventSource.current.close();
    }

    setIsConnecting(true);

    try {
      // Get Firebase auth token
      const user = auth.currentUser;
      if (!user) {
        console.warn("No authenticated user for SSE");
        setTimeout(() => connect(), 3000);
        return;
      }

      const token = await getIdToken(user);
      const url = `${SSE_BASE}?token=${encodeURIComponent(token)}`;

      const es = new EventSource(url);
      eventSource.current = es;

      es.addEventListener("connected", () => {
        console.log("SSE Connected");
        setIsConnected(true);
        setIsConnecting(false);
      });

      es.addEventListener("message", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch (e) {
          console.error("SSE Parse Error:", e);
        }
      });

      // Handle custom event types (summary_complete, summary_failed)
      ["summary_complete", "summary_failed"].forEach((eventType) => {
        es.addEventListener(eventType, (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            onMessageRef.current?.(data);
          } catch (e) {
            console.error("SSE Parse Error:", e);
          }
        });
      });

      es.onerror = () => {
        console.log("SSE Disconnected. Reconnecting...");
        setIsConnected(false);
        setIsConnecting(false);
        es.close();

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
      };
    } catch (error) {
      console.error("SSE Connection Error:", error);
      setIsConnecting(false);
      setTimeout(() => connect(), 3000);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSource.current) {
        eventSource.current.close();
      }
    };
  }, [connect]);

  return { isConnected, isConnecting };
}
