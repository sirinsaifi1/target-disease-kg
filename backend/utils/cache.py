import functools
import time
from typing import Any, Callable, Dict, Tuple


def _make_cache_key(args: Tuple[Any, ...], kwargs: Dict[str, Any]) -> Tuple[Any, ...]:
    normalized_kwargs = tuple(sorted(kwargs.items()))
    normalized_args = tuple(
        tuple(arg) if isinstance(arg, list) else arg for arg in args
    )
    return normalized_args + normalized_kwargs


def ttl_cache(seconds: int = 300) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        cache: Dict[Tuple[Any, ...], Tuple[float, Any]] = {}

        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            key = _make_cache_key(args, kwargs)
            now = time.time()
            if key in cache:
                expires_at, value = cache[key]
                if now < expires_at:
                    return value
            value = func(*args, **kwargs)
            cache[key] = (now + seconds, value)
            return value

        return wrapper

    return decorator
