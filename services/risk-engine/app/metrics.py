from collections import defaultdict
import threading

_lock = threading.Lock()
_fusion_counts = defaultdict(int)
_forecast_count = 0
_conflict_count = 0
_degraded_count = 0
_latencies = defaultdict(list)
_signals = defaultdict(list)

def note_fusion(label: str, conflict: bool, degraded: bool):
    with _lock:
        _fusion_counts["total"] += 1
        _fusion_counts[f"label_{label.lower()}"] += 1
        if conflict:
            _fusion_counts["conflict"] += 1
        if degraded:
            _fusion_counts["degraded"] += 1

def note_forecast():
    global _forecast_count
    with _lock:
        _forecast_count += 1

def note_latency(kind: str, dt: float):
    with _lock:
        l = _latencies[kind]
        l.append(dt)
        if len(l) > 200:
            _latencies[kind] = l[-100:]

def note_signal(name: str, value: float):
    with _lock:
        s = _signals[name]
        s.append(value)
        if len(s) > 200:
            _signals[name] = s[-100:]

def metrics_snapshot(default_noise: dict) -> str:
    lines = []
    with _lock:
        lines.append("# HELP risk_fusion_requests_total Total fusion requests processed")
        lines.append("# TYPE risk_fusion_requests_total counter")
        lines.append(f"risk_fusion_requests_total {_fusion_counts['total']}")
        lines.append(f"risk_fusion_conflicts_total {_fusion_counts['conflict']}")
        lines.append(f"risk_fusion_degraded_total {_fusion_counts['degraded']}")

        lines.append("# HELP risk_forecast_requests_total Total forecast requests processed")
        lines.append("# TYPE risk_forecast_requests_total counter")
        lines.append(f"risk_forecast_requests_total {_forecast_count}")

        lines.append("# HELP risk_signal_mean Running average signal values")
        lines.append("# TYPE risk_signal_mean gauge")
        for k, vals in _signals.items():
            mean = sum(vals) / len(vals) if vals else 0.0
            lines.append(f'risk_signal_mean{{signal=\"{k}\"}} {mean:.4f}')
        if not _signals:
            lines.append('risk_signal_mean{{signal=\"default\"}} 0.0')

        for kind, lats in _latencies.items():
            avg_ms = (sum(lats) / len(lats) * 1000) if lats else 0.0
            lines.append(f'risk_latency_avg_ms{{kind=\"{kind}\"}} {avg_ms:.2f}')

    return "\n".join(lines) + "\n"
