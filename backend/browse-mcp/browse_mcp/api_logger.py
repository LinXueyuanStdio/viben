"""API request/response logging in JSONL format.

This module provides logging for API requests and responses to track usage,
performance, and errors. Logs are stored in JSONL format for easy analysis.

Log file location: {logs_dir}/{run_id}.jsonl

The run_id can be provided via the BROWSE_MCP_RUN_ID environment variable
to enable unified session logging with server logs (which use {run_id}.log).

Each log entry contains:
- timestamp: ISO 8601 timestamp
- api_key_hash: SHA256 hash of first 8 chars of API key (for privacy)
- provider: Provider name (e.g., 'academic')
- source: Data source name (e.g., 'arxiv')
- method: Operation type ('search', 'download', 'read')
- request: Request parameters (sanitized)
- response: Response summary (count, status)
- latency_ms: Request duration in milliseconds
- status: 'success' or 'error'
- error: Error message if failed
"""
import hashlib
import json
import os
import time
import uuid
from datetime import datetime
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union
from dataclasses import dataclass, asdict

from loguru import logger


# Type variable for generic return types
T = TypeVar("T")


@dataclass
class ApiLogEntry:
    """A single API log entry."""

    timestamp: str
    run_id: str
    api_key_hash: Optional[str]
    provider: str
    source: str
    method: str  # 'search', 'download', 'read'
    request: Dict[str, Any]
    response: Dict[str, Any]
    latency_ms: float
    status: str  # 'success', 'error'
    error: Optional[str] = None


class ApiLogger:
    """Logger for API requests and responses.

    Logs are written to JSONL files in the logs directory.
    Each run gets its own log file identified by run_id.
    """

    def __init__(self, logs_dir: Optional[str] = None, run_id: Optional[str] = None):
        """Initialize the API logger.

        Args:
            logs_dir: Directory to store log files. Defaults to ~/.browse-mcp/logs.
            run_id: Unique identifier for this run. Can be provided via BROWSE_MCP_RUN_ID
                   environment variable for unified session logging with server logs.
        """
        try:
            self._logs_dir = logs_dir or self._get_default_logs_dir()
            # Check for run_id from environment variable (for unified session logging)
            self._run_id = run_id or os.getenv("BROWSE_MCP_RUN_ID") or self._generate_run_id()
            self._api_key_hash: Optional[str] = None
            self._enabled = True
            self._write_count = 0

            # Store API logs directly in logs directory (unified with server logs)
            # Server logs: {run_id}.log, API logs: {run_id}.jsonl
            self._api_logs_dir = Path(self._logs_dir)
            self._api_logs_dir.mkdir(parents=True, exist_ok=True)

            # Log initialization at INFO level for visibility
            logger.info(
                f"API Logger initialized: run_id={self._run_id}, "
                f"log_file={self.log_file_path}"
            )

            # Verify directory is writable by creating a test file
            test_file = self._api_logs_dir / ".write_test"
            try:
                test_file.write_text("test")
                test_file.unlink()
                logger.debug(f"API logs directory is writable: {self._api_logs_dir}")
            except Exception as e:
                logger.error(
                    f"API logs directory is NOT writable: {self._api_logs_dir}, error: {e}"
                )
                self._enabled = False

        except Exception as e:
            logger.error(f"Failed to initialize API Logger: {e}")
            # Set safe defaults
            self._logs_dir = "."
            self._run_id = "error"
            self._api_key_hash = None
            self._enabled = False
            self._write_count = 0
            self._api_logs_dir = Path(".")

    @staticmethod
    def _get_default_logs_dir() -> str:
        """Get the default logs directory."""
        # Check environment variable first
        if env_path := os.getenv("BROWSE_MCP_LOGS_DIR"):
            return env_path

        # Use platform-specific data directory
        if os.name == "nt":  # Windows
            base = os.getenv("LOCALAPPDATA", os.path.expanduser("~"))
            return os.path.join(base, "browse-mcp", "logs")
        else:  # Unix-like
            xdg_data = os.getenv("XDG_DATA_HOME", os.path.expanduser("~/.local/share"))
            return os.path.join(xdg_data, "browse-mcp", "logs")

    @staticmethod
    def _generate_run_id() -> str:
        """Generate a unique run ID."""
        return uuid.uuid4().hex[:12]

    @property
    def run_id(self) -> str:
        """Get the current run ID."""
        return self._run_id

    @property
    def log_file_path(self) -> Path:
        """Get the path to the current log file."""
        return self._api_logs_dir / f"{self._run_id}.jsonl"

    @property
    def enabled(self) -> bool:
        """Check if logging is enabled."""
        return self._enabled

    @enabled.setter
    def enabled(self, value: bool) -> None:
        """Enable or disable logging."""
        self._enabled = value

    def set_api_key(self, api_key: Optional[str]) -> None:
        """Set the API key for logging (hashed for privacy).

        Args:
            api_key: The API key to hash. Only first 8 chars are used.
        """
        if api_key:
            # Hash first 8 characters for privacy
            prefix = api_key[:8] if len(api_key) >= 8 else api_key
            self._api_key_hash = hashlib.sha256(prefix.encode()).hexdigest()[:16]
        else:
            self._api_key_hash = None

    def _sanitize_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize request parameters for logging.

        Removes sensitive information like full API keys.
        """
        sanitized = {}
        sensitive_keys = {"api_key", "key", "token", "secret", "password"}

        for key, value in request.items():
            if key.lower() in sensitive_keys:
                sanitized[key] = "***"
            elif isinstance(value, str) and len(value) > 500:
                # Truncate very long strings
                sanitized[key] = value[:500] + "..."
            else:
                sanitized[key] = value

        return sanitized

    def _write_entry(self, entry: ApiLogEntry) -> None:
        """Write a log entry to the log file."""
        if not self._enabled:
            logger.debug(
                f"API logging disabled, skipping entry for {entry.source}/{entry.method}"
            )
            return

        log_file = self.log_file_path
        try:
            entry_dict = asdict(entry)
            line = json.dumps(entry_dict, ensure_ascii=False, default=str)

            # Open file in append mode with explicit flush
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(line + "\n")
                f.flush()  # Ensure data is written to disk
                os.fsync(f.fileno())  # Force OS to write to disk

            self._write_count += 1
            logger.debug(
                f"API log entry written to {log_file} "
                f"(entry #{self._write_count}, {entry.source}/{entry.method})"
            )
        except PermissionError as e:
            logger.error(
                f"Permission denied writing API log to {log_file}: {e}. "
                f"Check directory permissions for {self._api_logs_dir}"
            )
        except OSError as e:
            logger.error(
                f"OS error writing API log to {log_file}: {e}. "
                f"Disk may be full or path invalid."
            )
        except Exception as e:
            logger.error(
                f"Unexpected error writing API log entry to {log_file}: {e}. "
                f"Entry: {entry.source}/{entry.method}"
            )

    def log_request(
        self,
        provider: str,
        source: str,
        method: str,
        request: Dict[str, Any],
        response: Union[Dict[str, Any], List[Any], Any],
        latency_ms: float,
        status: str = "success",
        error: Optional[str] = None,
    ) -> None:
        """Log an API request and response.

        Args:
            provider: Provider category (e.g., 'academic')
            source: Data source name (e.g., 'arxiv')
            method: Operation type ('search', 'download', 'read')
            request: Request parameters
            response: Response data or summary
            latency_ms: Request duration in milliseconds
            status: 'success' or 'error'
            error: Error message if status is 'error'
        """
        # Build response summary
        if isinstance(response, list):
            response_summary = {"count": len(response), "type": "list"}
        elif isinstance(response, dict):
            response_summary = {"keys": list(response.keys()), "type": "dict"}
        elif isinstance(response, str):
            response_summary = {"length": len(response), "type": "str"}
        else:
            response_summary = {"type": type(response).__name__}

        entry = ApiLogEntry(
            timestamp=datetime.utcnow().isoformat() + "Z",
            run_id=self._run_id,
            api_key_hash=self._api_key_hash,
            provider=provider,
            source=source,
            method=method,
            request=self._sanitize_request(request),
            response=response_summary,
            latency_ms=round(latency_ms, 2),
            status=status,
            error=error,
        )

        self._write_entry(entry)

    def read_logs(self, limit: int = 1000) -> List[Dict[str, Any]]:
        """Read log entries from the current log file.

        Args:
            limit: Maximum number of entries to return

        Returns:
            List of log entries as dictionaries
        """
        entries = []
        log_file = self.log_file_path

        if not log_file.exists():
            return entries

        try:
            with open(log_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            entries.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
                    if len(entries) >= limit:
                        break
        except Exception as e:
            logger.warning(f"Failed to read API logs: {e}")

        return entries

    def get_summary(self) -> Dict[str, Any]:
        """Get a summary of API logs for this run.

        Returns:
            Dictionary with aggregated statistics
        """
        entries = self.read_logs(limit=10000)

        if not entries:
            return {
                "run_id": self._run_id,
                "total_requests": 0,
                "successful_requests": 0,
                "failed_requests": 0,
                "by_source": {},
                "by_method": {},
                "avg_latency_ms": 0,
            }

        by_source: Dict[str, int] = {}
        by_method: Dict[str, int] = {}
        total_latency = 0.0
        success_count = 0
        error_count = 0

        for entry in entries:
            source = entry.get("source", "unknown")
            method = entry.get("method", "unknown")
            status = entry.get("status", "unknown")
            latency = entry.get("latency_ms", 0)

            by_source[source] = by_source.get(source, 0) + 1
            by_method[method] = by_method.get(method, 0) + 1
            total_latency += latency

            if status == "success":
                success_count += 1
            else:
                error_count += 1

        return {
            "run_id": self._run_id,
            "total_requests": len(entries),
            "successful_requests": success_count,
            "failed_requests": error_count,
            "by_source": by_source,
            "by_method": by_method,
            "avg_latency_ms": round(total_latency / len(entries), 2) if entries else 0,
        }


def logged_api_call(
    provider: str,
    source: str,
    method: str,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator for logging API calls.

    Usage:
        @logged_api_call('academic', 'arxiv', 'search')
        def search(self, query: str, **kwargs) -> List[Paper]:
            ...

    Args:
        provider: Provider category
        source: Data source name
        method: Operation type

    Returns:
        Decorated function that logs its calls
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            # Get or create logger from global state
            api_logger = get_api_logger()

            # Build request info
            request_info = {
                "args": [str(a)[:100] for a in args[1:]]
                if len(args) > 1
                else [],  # Skip self
                **kwargs,
            }

            start_time = time.perf_counter()
            error_msg = None
            status = "success"
            result = None

            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                status = "error"
                error_msg = str(e)
                raise
            finally:
                latency_ms = (time.perf_counter() - start_time) * 1000
                api_logger.log_request(
                    provider=provider,
                    source=source,
                    method=method,
                    request=request_info,
                    response=result if result is not None else {},
                    latency_ms=latency_ms,
                    status=status,
                    error=error_msg,
                )

        return wrapper

    return decorator


# Global API logger instance
_api_logger: Optional[ApiLogger] = None


def get_api_logger() -> ApiLogger:
    """Get the global API logger instance.

    Returns:
        The singleton ApiLogger instance.
    """
    global _api_logger
    if _api_logger is None:
        logger.warning(
            "API logger accessed before initialization, creating default instance"
        )
        _api_logger = ApiLogger()
    return _api_logger


def init_api_logger(
    logs_dir: Optional[str] = None,
    run_id: Optional[str] = None,
    api_key: Optional[str] = None,
) -> ApiLogger:
    """Initialize or reinitialize the global API logger.

    Args:
        logs_dir: Directory to store log files
        run_id: Unique identifier for this run
        api_key: API key to hash for logging

    Returns:
        The initialized ApiLogger instance.
    """
    global _api_logger
    try:
        _api_logger = ApiLogger(logs_dir=logs_dir, run_id=run_id)
        if api_key:
            _api_logger.set_api_key(api_key)
        logger.info(
            f"Global API logger initialized successfully: "
            f"run_id={_api_logger.run_id}, enabled={_api_logger.enabled}, "
            f"log_file={_api_logger.log_file_path}"
        )
        return _api_logger
    except Exception as e:
        logger.error(f"Failed to initialize global API logger: {e}")
        # Create a disabled logger as fallback
        _api_logger = ApiLogger()
        _api_logger.enabled = False
        return _api_logger


def reset_api_logger() -> None:
    """Reset the global API logger.

    Primarily useful for testing.
    """
    global _api_logger
    _api_logger = None
