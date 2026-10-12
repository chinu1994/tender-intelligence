class AIProviderError(Exception):
    """
    Raised when an AI provider fails.

    The message is human-readable on purpose: the spec requires clear
    error messages to be shown for failed document processing.
    """
