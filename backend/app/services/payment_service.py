PAYMENT_METHODS = {"transferencia", "debito_credito", "efectivo"}


def is_valid_payment_method(value: str | None) -> bool:
    """Valida contra métodos conocidos antes de guardar una venta."""
    return value in PAYMENT_METHODS


def calculate_cash_rounding(amount: int | float) -> int:
    """Calcula ajuste al múltiplo de 10 usado en pagos en efectivo."""
    total = max(0, round(float(amount or 0)))
    last_digit = total % 10
    if 1 <= last_digit <= 5:
        return -last_digit
    if last_digit >= 6:
        return 10 - last_digit
    return 0


def calculate_payment_totals(amount: int | float, payment_method: str | None) -> dict:
    """Centraliza totales para que backend y frontend usen la misma regla."""
    unrounded_total = max(0, round(float(amount or 0)))
    rounding_adjustment = calculate_cash_rounding(unrounded_total) if payment_method == "efectivo" else 0
    return {
        "unroundedTotal": unrounded_total,
        "roundingAdjustment": rounding_adjustment,
        "finalTotal": unrounded_total + rounding_adjustment,
    }
