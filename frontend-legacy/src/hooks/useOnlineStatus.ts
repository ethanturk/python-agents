import { useState, useEffect } from "react";

/**
 * Hook to detect online/offline status
 * @returns {boolean} isOnline - true if online, false if offline
 */
export default function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => {
      console.log("Network connection restored");
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log("Network connection lost");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
