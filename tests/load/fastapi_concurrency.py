"""Prueba de concurrencia para la API FastAPI.

Este script mide cuántos usuarios concurrentes soporta un endpoint antes de
superar los umbrales definidos de errores y latencia. Está pensado para correr
contra una instancia real de la app, no contra TestClient, porque el objetivo es
medir capacidad aproximada del servidor ASGI, red local y base de datos.

Ejemplo:
    python tests/load/fastapi_concurrency.py --base-url http://127.0.0.1:8000

Para medir usuarios que consultan y crean datos al mismo tiempo:
    python tests/load/fastapi_concurrency.py --scenario mixed-db --path /api/productos?activo=true
"""

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class RequestResult:
    operation: str
    ok: bool
    status_code: int | None
    elapsed_ms: float
    error: str | None = None


@dataclass(frozen=True)
class LevelResult:
    users: int
    total_requests: int
    successes: int
    failures: int
    error_rate: float
    avg_ms: float
    p95_ms: float
    max_ms: float
    requests_per_second: float
    healthy: bool
    reads: dict[str, float | int]
    writes: dict[str, float | int]


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(len(ordered) * fraction + 0.999999) - 1))
    return ordered[index]


def request_once(
    url: str,
    timeout: float,
    *,
    operation: str = "read",
    method: str = "GET",
    payload: dict[str, Any] | None = None,
) -> RequestResult:
    started_at = time.perf_counter()
    headers = {"User-Agent": "cotizaciones-concurrency-test/1.0"}
    body: bytes | None = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode("utf-8")

    request = Request(url, data=body, method=method, headers=headers)

    try:
        with urlopen(request, timeout=timeout) as response:  # noqa: S310 - URL controlada por quien ejecuta la prueba
            response.read()
            status_code = response.getcode()
            elapsed_ms = (time.perf_counter() - started_at) * 1000
            return RequestResult(
                operation=operation,
                ok=200 <= status_code < 400,
                status_code=status_code,
                elapsed_ms=elapsed_ms,
            )
    except HTTPError as error:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        return RequestResult(operation=operation, ok=False, status_code=error.code, elapsed_ms=elapsed_ms, error=str(error))
    except URLError as error:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        return RequestResult(operation=operation, ok=False, status_code=None, elapsed_ms=elapsed_ms, error=str(error.reason))
    except TimeoutError as error:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        return RequestResult(operation=operation, ok=False, status_code=None, elapsed_ms=elapsed_ms, error=str(error))


async def virtual_user(
    *,
    user_index: int,
    read_url: str,
    write_url: str,
    scenario: str,
    requests_per_user: int,
    timeout: float,
    write_every: int,
    run_id: str,
) -> list[RequestResult]:
    results: list[RequestResult] = []
    for request_index in range(requests_per_user):
        should_write = scenario == "mixed-db" and (request_index + 1) % write_every == 0
        if should_write:
            payload = {
                "nombre": f"Carga {run_id} usuario {user_index} solicitud {request_index}",
                "telefono": f"load-{run_id}-{user_index}-{request_index}",
            }
            results.append(
                await asyncio.to_thread(
                    request_once,
                    write_url,
                    timeout,
                    operation="write",
                    method="POST",
                    payload=payload,
                )
            )
        else:
            results.append(await asyncio.to_thread(request_once, read_url, timeout, operation="read"))
    return results


async def run_level(
    *,
    read_url: str,
    write_url: str,
    scenario: str,
    users: int,
    requests_per_user: int,
    timeout: float,
    write_every: int,
    run_id: str,
    max_error_rate: float,
    max_p95_ms: float,
) -> LevelResult:
    started_at = time.perf_counter()
    grouped_results = await asyncio.gather(
        *(
            virtual_user(
                user_index=user_index,
                read_url=read_url,
                write_url=write_url,
                scenario=scenario,
                requests_per_user=requests_per_user,
                timeout=timeout,
                write_every=write_every,
                run_id=f"{run_id}-{users}",
            )
            for user_index in range(users)
        )
    )
    elapsed_seconds = time.perf_counter() - started_at

    results = [result for group in grouped_results for result in group]
    durations = [result.elapsed_ms for result in results]
    successes = sum(1 for result in results if result.ok)
    failures = len(results) - successes
    error_rate = failures / len(results) if results else 1.0
    p95_ms = percentile(durations, 0.95)

    return LevelResult(
        users=users,
        total_requests=len(results),
        successes=successes,
        failures=failures,
        error_rate=error_rate,
        avg_ms=statistics.fmean(durations) if durations else 0.0,
        p95_ms=p95_ms,
        max_ms=max(durations) if durations else 0.0,
        requests_per_second=len(results) / elapsed_seconds if elapsed_seconds > 0 else 0.0,
        healthy=error_rate <= max_error_rate and p95_ms <= max_p95_ms,
        reads=summarize_operation(results, "read"),
        writes=summarize_operation(results, "write"),
    )


def summarize_operation(results: list[RequestResult], operation: str) -> dict[str, float | int]:
    operation_results = [result for result in results if result.operation == operation]
    durations = [result.elapsed_ms for result in operation_results]
    successes = sum(1 for result in operation_results if result.ok)
    return {
        "total": len(operation_results),
        "successes": successes,
        "failures": len(operation_results) - successes,
        "avg_ms": statistics.fmean(durations) if durations else 0.0,
        "p95_ms": percentile(durations, 0.95),
    }


def build_url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def parse_levels(raw_levels: str) -> list[int]:
    levels = [int(value.strip()) for value in raw_levels.split(",") if value.strip()]
    if not levels or any(level < 1 for level in levels):
        raise argparse.ArgumentTypeError("--levels debe contener enteros positivos separados por coma")
    return levels


def print_result(result: LevelResult) -> None:
    status = "OK" if result.healthy else "LIMITE"
    print(
        f"{status:6} usuarios={result.users:4d} | "
        f"ok={result.successes:4d}/{result.total_requests:<4d} | "
        f"errores={result.error_rate * 100:5.1f}% | "
        f"prom={result.avg_ms:7.1f} ms | "
        f"p95={result.p95_ms:7.1f} ms | "
        f"max={result.max_ms:7.1f} ms | "
        f"rps={result.requests_per_second:7.1f}"
    )
    if result.writes["total"]:
        print(
            f"       lecturas ok={result.reads['successes']}/{result.reads['total']} "
            f"p95={result.reads['p95_ms']:.1f} ms | "
            f"escrituras ok={result.writes['successes']}/{result.writes['total']} "
            f"p95={result.writes['p95_ms']:.1f} ms"
        )


async def main() -> int:
    parser = argparse.ArgumentParser(description="Mide usuarios concurrentes soportados por un endpoint FastAPI")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="URL base de la API en ejecución")
    parser.add_argument("--path", default="/api/health", help="Endpoint de lectura a medir. Por defecto no toca la base de datos")
    parser.add_argument(
        "--scenario",
        choices=["read-only", "mixed-db"],
        default="read-only",
        help="read-only solo consulta; mixed-db alterna consultas y creación de clientes de prueba",
    )
    parser.add_argument("--write-path", default="/api/clientes", help="Endpoint POST usado por --scenario mixed-db")
    parser.add_argument("--write-every", type=int, default=3, help="En mixed-db, cada cuántas acciones de un usuario será escritura")
    parser.add_argument("--levels", type=parse_levels, default=parse_levels("1,5,10,25,50,100"))
    parser.add_argument("--requests-per-user", type=int, default=10)
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument("--max-error-rate", type=float, default=0.01, help="Tasa máxima de error permitida. 0.01 = 1%%")
    parser.add_argument("--max-p95-ms", type=float, default=1000.0, help="Latencia p95 máxima saludable")
    parser.add_argument("--json", action="store_true", help="Imprime el resumen final en JSON")
    args = parser.parse_args()

    if args.requests_per_user < 1:
        parser.error("--requests-per-user debe ser mayor o igual a 1")
    if not 0 <= args.max_error_rate <= 1:
        parser.error("--max-error-rate debe estar entre 0 y 1")
    if args.write_every < 1:
        parser.error("--write-every debe ser mayor o igual a 1")

    read_url = build_url(args.base_url, args.path)
    write_url = build_url(args.base_url, args.write_path)
    run_id = str(int(time.time()))

    print(f"Escenario: {args.scenario}")
    print(f"Endpoint lectura: {read_url}")
    if args.scenario == "mixed-db":
        print(f"Endpoint escritura: POST {write_url}")
        print("Aviso: este escenario crea clientes de prueba. Úsalo contra una base de testing o descartable.")
    print(
        f"Criterio saludable: errores <= {args.max_error_rate * 100:.1f}% "
        f"y p95 <= {args.max_p95_ms:.0f} ms\n"
    )

    results: list[LevelResult] = []
    for users in args.levels:
        result = await run_level(
            read_url=read_url,
            write_url=write_url,
            scenario=args.scenario,
            users=users,
            requests_per_user=args.requests_per_user,
            timeout=args.timeout,
            write_every=args.write_every,
            run_id=run_id,
            max_error_rate=args.max_error_rate,
            max_p95_ms=args.max_p95_ms,
        )
        results.append(result)
        print_result(result)

    healthy_levels = [result for result in results if result.healthy]
    maximum_healthy_users = max((result.users for result in healthy_levels), default=0)
    print(f"\nUsuarios concurrentes saludables estimados: {maximum_healthy_users}")

    if args.json:
        payload: dict[str, Any] = {
            "scenario": args.scenario,
            "read_endpoint": read_url,
            "write_endpoint": write_url if args.scenario == "mixed-db" else None,
            "maximum_healthy_users": maximum_healthy_users,
            "criteria": {"max_error_rate": args.max_error_rate, "max_p95_ms": args.max_p95_ms},
            "levels": [result.__dict__ for result in results],
        }
        print(json.dumps(payload, indent=2, ensure_ascii=False))

    return 0 if maximum_healthy_users > 0 else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
