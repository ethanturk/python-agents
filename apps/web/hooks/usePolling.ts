import { useState, useEffect, useRef } from "react";
import { API_BASE } from "@/lib/config";
import axios from "axios";
import { auth } from "@/lib/firebase";

interface UsePollingProps {
  onMessage: (data: unknown) => void;
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
  const onMessageRef = useRef<(data: unknown) => void>(onMessage);
  const isPolling = useRef<boolean>(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      if (!mounted) return;
      if (isPolling.current) return;
      isPolling.current = true;

      try {
        if (!auth) {
          console.warn("Auth not initialized");
          return;
        }
        const firebaseAuth = auth;
        if (!firebaseAuth) {
          console.warn("Firebase auth not initialized");
          if (mounted) setIsConnecting(false);
          setTimeout(() => {
            if (mounted) {
              isPolling.current = false;
              poll();
            }
          }, 3000);
          return;
        }
        const user = firebaseAuth.currentUser;
        if (!user) {
          console.warn("No authenticated user for polling");
          if (mounted) setIsConnecting(false);
          setTimeout(() => {
            if (mounted) {
              isPolling.current = false;
              poll();
            }
          }, 3000);
          return;
        }

        const token = await user.getIdToken();
        const response = await axios.get(`${API_BASE}/poll`, {
          params: { since_id: lastId.current },
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 25000,
        });

        if (mounted) {
          setIsConnected(true);
          setIsConnecting(false);
        }

        const messages = response.data.messages || [];
        for (const msg of messages) {
          lastId.current = Math.max(lastId.current, msg.id);
          onMessageRef.current?.(msg.data);
        }

        if (mounted) {
          isPolling.current = false;
          poll();
        }
      } catch (error) {
        console.error("Polling error:", error);
        if (mounted) {
          setIsConnected(false);
          setIsConnecting(false);
        }

        setTimeout(() => {
          if (mounted) {
            isPolling.current = false;
            poll();
          }
        }, 3000);
      }
    };

    poll();

    return () => {
      mounted = false;
      isPolling.current = false;
    };
  }, []);

  return { isConnected, isConnecting };
}
