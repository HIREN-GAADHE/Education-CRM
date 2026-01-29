"""
DateTime Utilities - Timezone-aware datetime helpers.
Replaces deprecated datetime.utcnow() with timezone-aware alternatives.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional


def utc_now() -> datetime:
    """
    Returns the current UTC time as a timezone-aware datetime.
    Use this instead of datetime.utcnow() which is deprecated in Python 3.12+.
    """
    return datetime.now(timezone.utc)


def utc_now_naive() -> datetime:
    """
    Returns current UTC time as naive datetime (no timezone info).
    For backward compatibility with existing database columns.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def from_timestamp(timestamp: float) -> datetime:
    """Convert Unix timestamp to timezone-aware UTC datetime."""
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def add_minutes(dt: Optional[datetime], minutes: int) -> datetime:
    """Add minutes to a datetime, defaults to now if None."""
    base = dt or utc_now()
    return base + timedelta(minutes=minutes)


def add_days(dt: Optional[datetime], days: int) -> datetime:
    """Add days to a datetime, defaults to now if None."""
    base = dt or utc_now()
    return base + timedelta(days=days)


def is_expired(expiry_dt: datetime) -> bool:
    """Check if a datetime has passed (is expired)."""
    now = utc_now()
    # Handle naive datetimes
    if expiry_dt.tzinfo is None:
        expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
    return now > expiry_dt
