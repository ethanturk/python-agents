from abc import ABC, abstractmethod


class ILLMModel(ABC):
    """Abstract interface for LLM models."""

    @abstractmethod
    def run_sync(self, prompt: str):
        """Run synchronous inference."""
        pass


class ITextSplitter(ABC):
    """Abstract interface for text splitters."""

    @abstractmethod
    def split_text(self, text: str) -> list:
        """Split text into chunks."""
        pass
