#!/usr/bin/env python3
"""Private, fixed-workload MicroSandbox verifier for the demo control plane.

This service deliberately does not accept arbitrary code, commands, images, or
sandbox settings. The only endpoint runs a short, deterministic verification
sequence and removes every microVM it creates before responding.
"""

from __future__ import annotations

import hmac
import json
import os
import re
import subprocess
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

HOST = os.environ.get("SANDBOX_RUNNER_HOST", "127.0.0.1")
PORT = int(os.environ.get("SANDBOX_RUNNER_PORT", "8787"))
TOKEN = os.environ.get("SANDBOX_RUNNER_TOKEN", "")
MSB_BINARY = os.environ.get("MSB_BINARY", "/home/deploy/.local/bin/msb")
COMMAND_TIMEOUT_SECONDS = 90
OUTPUT_LIMIT = 8_000


def runner_environment() -> dict[str, str]:
    environment = os.environ.copy()
    environment["HOME"] = "/home/deploy"
    environment["PATH"] = "/home/deploy/.local/bin:" + environment.get("PATH", "")
    return environment


def run_msb(*arguments: str) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            [MSB_BINARY, *arguments],
            check=False,
            cwd="/home/deploy",
            env=runner_environment(),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=COMMAND_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "output": "Command timed out."}
    except OSError as error:
        return {"ok": False, "output": f"Unable to start Microsandbox: {error}"}

    return {
        "ok": completed.returncode == 0,
        "output": completed.stdout[-OUTPUT_LIMIT:].strip(),
    }


def cleanup_sandboxes(names: list[str]) -> dict[str, str]:
    cleanup: dict[str, str] = {}
    for name in names:
        result = run_msb("rm", "--force", name)
        cleanup[name] = "removed" if result["ok"] else "not-found-or-already-removed"
    return cleanup


def verify() -> dict[str, Any]:
    run_id = f"finops-{int(time.time() * 1000)}"
    fibonacci_name = f"{run_id}-fib"
    first_name = f"{run_id}-a"
    second_name = f"{run_id}-b"
    sandbox_names = [fibonacci_name, first_name, second_name]
    result: dict[str, Any] = {}

    def complete(payload: dict[str, Any]) -> dict[str, Any]:
        result.update(payload)
        return result

    try:
        host_check = run_msb("doctor")
        if not host_check["ok"]:
            return complete({
                "status": "failed",
                "step": "host-check",
                "detail": host_check["output"],
            })

        fibonacci = run_msb(
            "run", "alpine", "--name", fibonacci_name, "--cpus", "1",
            "--memory", "128M", "--no-net", "--", "sh", "-lc",
            "a=0; b=1; n=0; while [ \"$n\" -lt 10 ]; do next=$((a + b)); a=$b; b=$next; n=$((n + 1)); done; printf 'fibonacci(10)=%s\\n' \"$a\"; hostname; uname -sr",
        )
        if not fibonacci["ok"]:
            return complete({
                "status": "failed",
                "step": "fibonacci-proof",
                "detail": fibonacci["output"],
            })

        first = run_msb(
            "create", "--name", first_name, "--cpus", "1", "--memory", "128M", "alpine"
        )
        second = run_msb(
            "create", "--name", second_name, "--cpus", "1", "--memory", "128M", "alpine"
        )
        if not first["ok"] or not second["ok"]:
            return complete({
                "status": "failed",
                "step": "create-isolation-pair",
                "detail": "\n".join([first["output"], second["output"]]).strip(),
            })

        first_ip = run_msb(
            "exec", first_name, "--", "sh", "-lc", "hostname -i | awk '{print $1}'"
        )
        match = re.search(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", first_ip["output"])
        if not first_ip["ok"] or not match:
            return complete({
                "status": "failed",
                "step": "read-sandbox-address",
                "detail": first_ip["output"],
            })

        listener = run_msb(
            "exec", first_name, "--", "sh", "-lc",
            "(busybox nc -lk -p 9000 >/tmp/listener.log 2>&1 &) && sleep 1 && echo listener-ready",
        )
        if not listener["ok"]:
            return complete({
                "status": "failed",
                "step": "start-isolation-listener",
                "detail": listener["output"],
            })

        probe = run_msb(
            "exec", second_name, "--", "sh", "-lc",
            f"if timeout 3 busybox nc -z -w 2 {match.group(0)} 9000; then echo REACHED; else echo BLOCKED; fi",
        )
        if not probe["ok"] or "BLOCKED" not in probe["output"]:
            return complete({
                "status": "failed",
                "step": "sibling-isolation-probe",
                "detail": probe["output"],
            })

        return complete({
            "status": "verified",
            "hostCheck": "KVM ready",
            "fibonacci": fibonacci["output"],
            "siblingIsolation": "BLOCKED",
        })
    finally:
        cleanup = cleanup_sandboxes(sandbox_names)
        remaining = run_msb("list")
        result["teardown"] = "complete" if all(
            status in {"removed", "not-found-or-already-removed"}
            for status in cleanup.values()
        ) else "attempted"
        result["remainingSandboxCheck"] = (
        "no verification sandboxes remain"
        if remaining["ok"] and not any(name in remaining["output"] for name in sandbox_names)
        else "verification sandbox cleanup needs review"
        )


class VerificationHandler(BaseHTTPRequestHandler):
    server_version = "CloudCostSandboxRunner/1.0"

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path != "/v1/verify":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
            return

        if not TOKEN:
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "Runner is not configured."})
            return

        provided = self.headers.get("Authorization", "").removeprefix("Bearer ")
        if not hmac.compare_digest(provided, TOKEN):
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "Unauthorized."})
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length > 1024:
            self.send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "Request is too large."})
            return

        try:
            payload = json.loads(self.rfile.read(content_length) or b"{}")
        except json.JSONDecodeError:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Request must be valid JSON."})
            return

        if payload != {}:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "This endpoint accepts no executable input."})
            return

        self.send_json(HTTPStatus.OK, verify())

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path == "/healthz":
            self.send_json(HTTPStatus.OK, {"status": "ok"})
            return
        self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})

    def log_message(self, _format: str, *_args: object) -> None:
        # Avoid logging authorization failures or any request content.
        return

    def send_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), VerificationHandler).serve_forever()
