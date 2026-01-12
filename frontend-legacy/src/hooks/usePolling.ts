import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE } from "../config";
import axios from "axios";
import { auth } from "../firebase";

interface UsePollingProps {
  onMessage: (data: any) => void;
}

interface UsePollingReturn {
  isConnected: boolean;
  isConnecting: boolean;
}

export default function usePolling({
  onMessage,
}: UsePollingProps): UsePollingReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const lastId = useRef<number>(0);
  const onMessageRef = useRef<(data: any) => void>(onMessage);
  const isPolling = useRef<boolean>(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const poll = useCallback(async () => {
    if (isPolling.current) return;
    isPolling.current = true;

    try {
      const user = auth.currentUser;
      if (!user) {
        console.warn("No authenticated user for polling");
        setIsConnecting(false);
        setTimeout(() => {
          isPolling.current = false;
          poll();
        }, 3000);
        return;
      }

      const token = await user.getIdToken();
      const response = await axios.get(`${API_BASE}/poll`, {
        params: { since_id: lastId.current },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 25000, // 25s timeout (slightly more than server's 20s)
      });

      setIsConnected(true);
      setIsConnecting(false);

      const messages = response.data.messages || [];
      for (const msg of messages) {
        lastId.current = Math.max(lastId.current, msg.id);
        onMessageRef.current?.(msg.data);
      }

      // Immediately poll again (long-polling pattern)
      isPolling.current = false;
      poll();
    } catch (error) {
      console.error("Polling error:", error);
      setIsConnected(false);
      setIsConnecting(false);

      // Retry after error
      setTimeout(() => {
        isPolling.current = false;
        poll();
      }, 3000);
    }
  }, []);

  useEffect(() => {
    poll();

    return () => {
      isPolling.current = false;
    };
  }, [poll]);

  return { isConnected, isConnecting };
}
