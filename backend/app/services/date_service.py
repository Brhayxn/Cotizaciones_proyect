from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

CHILE_TIME_ZONE = ZoneInfo("America/Santiago")


def chile_start_of_day(days_ago: int = 0) -> datetime:
    """Inicio del día en Chile para reportes de hoy, semana y mes."""
    today = datetime.now(CHILE_TIME_ZONE).date() - timedelta(days=days_ago)
    return datetime.combine(today, time.min, tzinfo=CHILE_TIME_ZONE)
