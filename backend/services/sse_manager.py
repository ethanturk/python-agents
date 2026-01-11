import asyncio
from collections import defaultdict
from typing import Dict, Set
import logging

logger = logging.getLogger(__name__)


class SSEConnectionManager:
    """Manages SSE connections with in-memory message queuing."""

    def __init__(self):
        # Map of connection_id -> asyncio.Queue
        self.connections: Dict[str, asyncio.Queue] = {}
        # Map of user_id -> Set[connection_id] for multi-tab support
        self.user_connections: Dict[str, Set[str]] = defaultdict(set)

    async def connect(self, connection_id: str, user_id: str) -> asyncio.Queue:
        """Register new SSE connection and return its message queue."""
        queue = asyncio.Queue(maxsize=100)  # Prevent memory bloat
        self.connections[connection_id] = queue
        self.user_connections[user_id].add(connection_id)
        logger.info(f"SSE client {connection_id} connected. Total: {len(self.connections)}")
        return queue

    def disconnect(self, connection_id: str, user_id: str):
        """Remove connection and cleanup."""
        self.connections.pop(connection_id, None)
        self.user_connections[user_id].discard(connection_id)
        logger.info(f"SSE client {connection_id} disconnected. Total: {len(self.connections)}")

    async def broadcast(self, message: dict, user_id: str = None):
        """
        Broadcast message to connections.
        If user_id specified, only send to that user's connections.
        Otherwise broadcast to all.
        """
        target_connections = (
            self.user_connections.get(user_id, set()) if user_id else set(self.connections.keys())
        )

        dead_connections = []
        for conn_id in target_connections:
            queue = self.connections.get(conn_id)
            if queue:
                try:
                    queue.put_nowait(message)
                except asyncio.QueueFull:
                    logger.warning(f"Queue full for {conn_id}, dropping message")
            else:
                dead_connections.append(conn_id)

        # Cleanup dead connections
        for conn_id in dead_connections:
            if user_id:
                self.disconnect(conn_id, user_id)


sse_manager = SSEConnectionManager()
