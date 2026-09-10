#!/usr/bin/env python3
"""Run kubectl health checks and print a PASSED/FAILED report."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

CONFIG_PATH = Path(__file__).resolve().parent / "config.json"
OUTPUT_PATH = Path(__file__).resolve().parent / "health_check_output.txt"
REPORT_WIDTH = 50
RESTART_LIMIT = 5


@dataclass
class Thresholds:
    pvc_usage_percent: float = 80.0
    cpu_usage_pods_percent: float = 80.0
    mem_usage_pods_percent: float = 80.0
    cpu_vs_limits_percent: float = 80.0
    memory_vs_limits_percent: float = 80.0

    @classmethod
    def from_config(cls, config: dict[str, Any]) -> Thresholds:
        raw = config.get("thresholds") or {}
        if not isinstance(raw, dict):
            raise ValueError("config.json 'thresholds' must be an object")
        return cls(
            pvc_usage_percent=float(raw.get("pvc_usage_percent", 80)),
            cpu_usage_pods_percent=float(raw.get("cpu_usage_pods_percent", 80)),
            mem_usage_pods_percent=float(raw.get("mem_usage_pods_percent", 80)),
            cpu_vs_limits_percent=float(raw.get("cpu_vs_limits_percent", 80)),
            memory_vs_limits_percent=float(raw.get("memory_vs_limits_percent", 80)),
        )

    @property
    def cpu_percent(self) -> float:
        return min(self.cpu_usage_pods_percent, self.cpu_vs_limits_percent)

    @property
    def mem_percent(self) -> float:
        return min(self.mem_usage_pods_percent, self.memory_vs_limits_percent)


@dataclass
class CheckResult:
    passed: bool
    values: list[str] = field(default_factory=list)


def _strip_json_comments(text: str) -> str:
    lines: list[str] = []
    for line in text.splitlines():
        in_string = False
        escaped = False
        cut = len(line)
        index = 0
        while index < len(line) - 1:
            char = line[index]
            nxt = line[index + 1]
            if in_string:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    in_string = False
            elif char == '"':
                in_string = True
            elif char == "/" and nxt == "/":
                cut = index
                break
            index += 1
        lines.append(line[:cut].rstrip())
    return "\n".join(lines)


def _repair_jsonish(text: str) -> str:
    text = _strip_json_comments(text)
    text = re.sub(r"(:\s*)([A-Za-z_][A-Za-z0-9_.-]*)(\s*[,}\r\n])", r'\1"\2"\3', text)
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    return text


def load_config() -> dict[str, Any]:
    if not CONFIG_PATH.is_file():
        raise FileNotFoundError(f"Config file not found: {CONFIG_PATH}")
    text = CONFIG_PATH.read_text(encoding="utf-8-sig")
    try:
        config = json.loads(text)
    except json.JSONDecodeError as exc:
        try:
            config = json.loads(_repair_jsonish(text))
        except json.JSONDecodeError:
            line = text.splitlines()[exc.lineno - 1] if exc.lineno <= len(text.splitlines()) else ""
            raise ValueError(
                f"invalid JSON in {CONFIG_PATH} ({exc.msg}: line {exc.lineno} column {exc.colno})\n"
                f"  {line}\n"
                f'  Namespace must be a quoted string, e.g. "namespace": "default"'
            ) from exc
    namespace = config.get("namespace")
    if isinstance(namespace, str) and namespace.startswith("$"):
        env_name = namespace[1:].strip("{}")
        namespace = os.environ.get(env_name, "")
        config["namespace"] = namespace
    if not namespace or not isinstance(namespace, str):
        raise ValueError('config.json must contain a quoted string "namespace" field')
    return config


def kubectl_get(resource: str, namespace: str | None = None, extra: list[str] | None = None) -> dict[str, Any]:
    cmd = ["kubectl", "get", resource, "-o", "json"]
    if namespace:
        cmd.extend(["-n", namespace])
    if extra:
        cmd.extend(extra)
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(stderr or f"command failed: {' '.join(cmd)}")
    return json.loads(result.stdout)


def kubectl_get_raw(path: str) -> dict[str, Any]:
    result = subprocess.run(
        ["kubectl", "get", "--raw", path],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(stderr or f"command failed: kubectl get --raw {path}")
    return json.loads(result.stdout)


def print_result(label: str, passed: bool) -> None:
    status = "PASSED" if passed else "FAILED"
    dots = max(1, REPORT_WIDTH - len(label) - 1)
    print(f"{label} {'.' * dots}{status}")


def parse_cpu_cores(quantity: str | None) -> float | None:
    if not quantity:
        return None
    value = str(quantity)
    if value.endswith("n"):
        return int(value[:-1]) / 1_000_000_000
    if value.endswith("u"):
        return int(value[:-1]) / 1_000_000
    if value.endswith("m"):
        return int(value[:-1]) / 1000
    return float(value)


def parse_bytes(quantity: str | None) -> int | None:
    if not quantity:
        return None
    value = str(quantity)
    binary = {
        "Ki": 1024,
        "Mi": 1024**2,
        "Gi": 1024**3,
        "Ti": 1024**4,
        "Pi": 1024**5,
        "Ei": 1024**6,
    }
    decimal = {
        "n": 1e-9,
        "u": 1e-6,
        "m": 1e-3,
        "k": 1e3,
        "K": 1e3,
        "M": 1e6,
        "G": 1e9,
        "T": 1e12,
        "P": 1e15,
        "E": 1e18,
    }
    for suffix, multiplier in binary.items():
        if value.endswith(suffix):
            return int(float(value[: -len(suffix)]) * multiplier)
    for suffix, multiplier in decimal.items():
        if value.endswith(suffix):
            return int(float(value[: -len(suffix)]) * multiplier)
    return int(float(value))


def format_cpu(cores: float) -> str:
    millicores = cores * 1000
    if millicores < 1000:
        return f"{millicores:.0f}m"
    return f"{cores:.3f}"


def format_bytes(num_bytes: int) -> str:
    if num_bytes >= 1024**3:
        return f"{num_bytes / 1024**3:.2f}Gi"
    if num_bytes >= 1024**2:
        return f"{num_bytes / 1024**2:.2f}Mi"
    if num_bytes >= 1024:
        return f"{num_bytes / 1024:.2f}Ki"
    return f"{num_bytes}B"


def pod_items(namespace: str) -> list[dict[str, Any]]:
    return kubectl_get("pods", namespace).get("items") or []


def resource_name(item: dict[str, Any]) -> str:
    return (item.get("metadata") or {}).get("name") or "<unnamed>"


def check_container_status(namespace: str) -> CheckResult:
    values: list[str] = []
    passed = True
    pods = pod_items(namespace)
    if not pods:
        return CheckResult(True, ["no pods found"])
    for pod in pods:
        name = resource_name(pod)
        phase = pod.get("status", {}).get("phase")
        if phase == "Succeeded":
            values.append(f"{name}: Succeeded (skipped)")
            continue
        if phase == "Failed":
            passed = False
            values.append(f"{name}: Failed")
            continue
        statuses = pod.get("status", {}).get("containerStatuses") or []
        if not statuses:
            passed = False
            values.append(f"{name}: no container statuses (phase={phase})")
            continue
        ready = sum(1 for status in statuses if status.get("ready"))
        total = len(statuses)
        ok = ready == total
        init_statuses = pod.get("status", {}).get("initContainerStatuses") or []
        for status in init_statuses:
            state = status.get("state") or {}
            if "terminated" in state:
                if (state["terminated"].get("exitCode") or 0) != 0:
                    ok = False
            elif "running" not in state and "waiting" in state:
                ok = False
        if not ok:
            passed = False
        values.append(f"{name}: {ready}/{total} containers Ready (phase={phase})")
    return CheckResult(passed, values)


def _replicas_ready(item: dict[str, Any]) -> tuple[int, int, bool]:
    desired = item.get("spec", {}).get("replicas")
    if desired is None:
        desired = 0
    ready = item.get("status", {}).get("readyReplicas") or 0
    desired_n = int(desired)
    ready_n = int(ready)
    return ready_n, desired_n, desired_n == ready_n


def check_replica_status(namespace: str) -> CheckResult:
    values: list[str] = []
    passed = True
    found = False
    for resource in ("deployments", "statefulsets", "replicationcontrollers"):
        items = kubectl_get(resource, namespace).get("items") or []
        if not items:
            values.append(f"{resource}: none")
            continue
        found = True
        for item in items:
            ready, desired, ok = _replicas_ready(item)
            if not ok:
                passed = False
            values.append(f"{resource}/{resource_name(item)}: {ready}/{desired} ready")
    if not found:
        values.append("no replica-managed workloads found")
    return CheckResult(passed, values)


def check_daemonset_replica_status(namespace: str) -> CheckResult:
    items = kubectl_get("daemonsets", namespace).get("items") or []
    if not items:
        return CheckResult(True, ["no daemonsets found"])
    values: list[str] = []
    passed = True
    for item in items:
        status = item.get("status") or {}
        desired = int(status.get("desiredNumberScheduled") or 0)
        ready = int(status.get("numberReady") or 0)
        ok = desired == ready
        if not ok:
            passed = False
        values.append(f"{resource_name(item)}: {ready}/{desired} ready")
    return CheckResult(passed, values)


def check_restarts(namespace: str) -> CheckResult:
    values: list[str] = []
    passed = True
    pods = pod_items(namespace)
    if not pods:
        return CheckResult(True, ["no pods found"])
    for pod in pods:
        name = resource_name(pod)
        statuses = []
        statuses.extend(pod.get("status", {}).get("containerStatuses") or [])
        statuses.extend(pod.get("status", {}).get("initContainerStatuses") or [])
        if not statuses:
            values.append(f"{name}: no container statuses")
            continue
        for status in statuses:
            restarts = int(status.get("restartCount") or 0)
            container = status.get("name") or "<container>"
            if restarts > RESTART_LIMIT:
                passed = False
            values.append(f"{name}/{container}: {restarts} restarts (limit {RESTART_LIMIT})")
    return CheckResult(passed, values)


def check_pvc_status(namespace: str) -> CheckResult:
    items = kubectl_get("pvc", namespace).get("items") or []
    if not items:
        return CheckResult(True, ["no PVCs found"])
    values: list[str] = []
    passed = True
    for item in items:
        phase = (item.get("status") or {}).get("phase") or "Unknown"
        if phase != "Bound":
            passed = False
        values.append(f"{resource_name(item)}: {phase}")
    return CheckResult(passed, values)


def _volume_usage_by_pvc(namespace: str) -> dict[str, tuple[int, int]]:
    usage: dict[str, tuple[int, int]] = {}
    nodes = kubectl_get("nodes").get("items") or []
    for node in nodes:
        name = (node.get("metadata") or {}).get("name")
        if not name:
            continue
        try:
            summary = kubectl_get_raw(f"/api/v1/nodes/{name}/proxy/stats/summary")
        except RuntimeError:
            continue
        for pod in summary.get("pods") or []:
            ref = pod.get("podRef") or {}
            if ref.get("namespace") != namespace:
                continue
            for volume in pod.get("volume") or []:
                pvc_ref = volume.get("pvcRef") or {}
                pvc_name = pvc_ref.get("name")
                used = volume.get("usedBytes")
                capacity = volume.get("capacityBytes")
                if pvc_name and used is not None and capacity:
                    usage[pvc_name] = (int(used), int(capacity))
    return usage


def check_pvc_usage(namespace: str, thresholds: Thresholds) -> CheckResult:
    items = kubectl_get("pvc", namespace).get("items") or []
    if not items:
        return CheckResult(True, ["no PVCs found"])
    usage = _volume_usage_by_pvc(namespace)
    if not usage:
        bound = check_pvc_status(namespace)
        values = ["volume usage stats unavailable; falling back to Bound status"]
        values.extend(bound.values)
        return CheckResult(bound.passed, values)
    values: list[str] = []
    passed = True
    limit = thresholds.pvc_usage_percent
    for name, (used, capacity) in usage.items():
        if capacity <= 0:
            passed = False
            values.append(f"{name}: invalid capacity {capacity}")
            continue
        percent = (used / capacity) * 100
        if percent > limit:
            passed = False
        values.append(
            f"{name}: {format_bytes(used)}/{format_bytes(capacity)} ({percent:.1f}%, threshold {limit:g}%)"
        )
    return CheckResult(passed, values)


def _container_limits(pod: dict[str, Any]) -> dict[str, dict[str, str]]:
    limits: dict[str, dict[str, str]] = {}
    for container in (pod.get("spec") or {}).get("containers") or []:
        name = container.get("name")
        container_limits = ((container.get("resources") or {}).get("limits") or {})
        if name:
            limits[name] = container_limits
    return limits


def _pod_metrics(namespace: str) -> list[dict[str, Any]]:
    try:
        return kubectl_get("pods.metrics.k8s.io", namespace).get("items") or []
    except RuntimeError:
        raw = kubectl_get_raw(f"/apis/metrics.k8s.io/v1beta1/namespaces/{namespace}/pods")
        return raw.get("items") or []


def check_resource_usage(namespace: str, resource: str, thresholds: Thresholds) -> CheckResult:
    pods_by_name = {
        (pod.get("metadata") or {}).get("name"): pod for pod in pod_items(namespace)
    }
    metrics = _pod_metrics(namespace)
    if not metrics:
        return CheckResult(True, [f"no {resource} metrics found"])
    limit_percent = thresholds.cpu_percent if resource == "cpu" else thresholds.mem_percent
    values: list[str] = []
    passed = True
    compared = False
    for item in metrics:
        pod_name = (item.get("metadata") or {}).get("name")
        pod = pods_by_name.get(pod_name) or {}
        limits = _container_limits(pod)
        for container in item.get("containers") or []:
            name = container.get("name")
            usage = (container.get("usage") or {}).get(resource)
            limit = (limits.get(name) or {}).get(resource)
            label = f"{pod_name}/{name}"
            if not usage:
                values.append(f"{label}: no {resource} usage reported")
                continue
            if not limit:
                values.append(f"{label}: usage {usage}, no {resource} limit set")
                continue
            if resource == "cpu":
                used_value = parse_cpu_cores(usage)
                limit_value = parse_cpu_cores(limit)
                used_text = format_cpu(used_value) if used_value is not None else usage
                limit_text = format_cpu(limit_value) if limit_value is not None else limit
            else:
                used_value = parse_bytes(usage)
                limit_value = parse_bytes(limit)
                used_text = format_bytes(used_value) if used_value is not None else usage
                limit_text = format_bytes(limit_value) if limit_value is not None else limit
            if used_value is None or not limit_value:
                values.append(f"{label}: usage {usage}, limit {limit}")
                continue
            compared = True
            percent = (used_value / limit_value) * 100
            if percent > limit_percent:
                passed = False
            values.append(
                f"{label}: {used_text}/{limit_text} ({percent:.1f}%, threshold {limit_percent:g}%)"
            )
    if not compared and not values:
        values.append(f"no {resource} usage vs limits to compare")
    return CheckResult(passed, values)


def check_pod_status(namespace: str) -> CheckResult:
    allowed = {"Running", "Succeeded"}
    pods = pod_items(namespace)
    if not pods:
        return CheckResult(True, ["no pods found"])
    values: list[str] = []
    passed = True
    for pod in pods:
        name = resource_name(pod)
        phase = (pod.get("status") or {}).get("phase") or "Unknown"
        reasons: list[str] = []
        for status in (pod.get("status") or {}).get("containerStatuses") or []:
            waiting = ((status.get("state") or {}).get("waiting") or {}).get("reason")
            if waiting in {"CrashLoopBackOff", "Error", "ImagePullBackOff", "ErrImagePull"}:
                reasons.append(f"{status.get('name')}:{waiting}")
        ok = phase in allowed and not reasons
        if not ok:
            passed = False
        extra = f" ({', '.join(reasons)})" if reasons else ""
        values.append(f"{name}: {phase}{extra}")
    return CheckResult(passed, values)


def check_node_status() -> CheckResult:
    items = kubectl_get("nodes").get("items") or []
    if not items:
        return CheckResult(False, ["no nodes found"])
    values: list[str] = []
    passed = True
    for node in items:
        conditions = (node.get("status") or {}).get("conditions") or []
        ready = next((c for c in conditions if c.get("type") == "Ready"), None)
        ready_status = (ready or {}).get("status") or "Unknown"
        ok = ready_status == "True"
        if not ok:
            passed = False
        values.append(f"{resource_name(node)}: Ready={ready_status}")
    return CheckResult(passed, values)


def run_check(label: str, func: Callable[[], CheckResult]) -> CheckResult:
    try:
        result = func()
    except Exception as exc:
        result = CheckResult(False, [str(exc)])
    print_result(label, result.passed)
    return result


def write_output_file(
    namespace: str,
    thresholds: Thresholds,
    rows: list[tuple[str, str, CheckResult]],
) -> None:
    lines = [
        "Kubernetes Health Check Report",
        f"Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        f"Namespace: {namespace}",
        "Thresholds:",
        f"  PVC USAGE: {thresholds.pvc_usage_percent:g}%",
        f"  CPU USAGE/PODS: {thresholds.cpu_usage_pods_percent:g}%",
        f"  MEM USAGE/PODS: {thresholds.mem_usage_pods_percent:g}%",
        f"  CPU vs limits: {thresholds.cpu_vs_limits_percent:g}%",
        f"  Memory vs limits: {thresholds.memory_vs_limits_percent:g}%",
        "",
    ]
    for title, description, result in rows:
        status = "PASSED" if result.passed else "FAILED"
        lines.append(title)
        lines.append(description)
        lines.append(f"Result: {status}")
        if result.values:
            lines.append("Values:")
            for value in result.values:
                lines.append(f"  {value}")
        else:
            lines.append("Values: none")
        lines.append("")
    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8-sig")


def main() -> int:
    try:
        config = load_config()
        thresholds = Thresholds.from_config(config)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Failed to load config: {exc}", file=sys.stderr)
        return 1

    namespace = config["namespace"]
    checks: list[tuple[str, str, str, Callable[[], CheckResult]]] = [
        (
            "CHECK CONTAINER STATUS",
            "CONTAINER STATUS",
            "All containers Ready",
            lambda: check_container_status(namespace),
        ),
        (
            "CHECK REPLICA STATUS",
            "REPLICA STATUS",
            "Deployments / StatefulSets / ReplicationControllers ready",
            lambda: check_replica_status(namespace),
        ),
        (
            "CHECK DAEMONSET REPLICA STATUS",
            "DAEMONSET REPLICA STATUS",
            "Desired vs ready",
            lambda: check_daemonset_replica_status(namespace),
        ),
        (
            "CHECK RESTARTS",
            "RESTARTS",
            f"Restart count <= {RESTART_LIMIT}",
            lambda: check_restarts(namespace),
        ),
        (
            "CHECK PVC STATUS",
            "PVC STATUS",
            "All PVCs Bound",
            lambda: check_pvc_status(namespace),
        ),
        (
            "CHECK PVC USAGE",
            "PVC USAGE",
            f"Volume use <= {thresholds.pvc_usage_percent:g}%",
            lambda: check_pvc_usage(namespace, thresholds),
        ),
        (
            "CHECK CPU USAGE/PODS",
            "CPU USAGE/PODS",
            f"CPU vs limits <= {thresholds.cpu_percent:g}%",
            lambda: check_resource_usage(namespace, "cpu", thresholds),
        ),
        (
            "CHECK MEM USAGE/PODS",
            "MEM USAGE/PODS",
            f"Memory vs limits <= {thresholds.mem_percent:g}%",
            lambda: check_resource_usage(namespace, "memory", thresholds),
        ),
        (
            "CHECK POD STATUS",
            "POD STATUS",
            "Running or Succeeded",
            lambda: check_pod_status(namespace),
        ),
        (
            "CHECK NODE STATUS",
            "NODE STATUS",
            "All nodes Ready",
            check_node_status,
        ),
    ]

    rows: list[tuple[str, str, CheckResult]] = []
    all_passed = True
    for console_label, title, description, func in checks:
        result = run_check(console_label, func)
        rows.append((title, description, result))
        if not result.passed:
            all_passed = False

    write_output_file(namespace, thresholds, rows)
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
