"""Trend calculation using linear regression on analysis score history."""

import logging
from collections import defaultdict
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


class TrendCalculator:
    """Computes trend direction and slope from historical analysis data."""

    def calculate_trend(
        self,
        data_points: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Run linear regression on combined scores over time.

        Args:
            data_points: List of dicts with 'date' (str) and 'combined_score' (float).

        Returns:
            Dict with keys: slope, direction, r_squared.
            Direction is "improving" if slope > 0.5, "declining" if slope < -0.5,
            otherwise "stable".
        """
        n = len(data_points)
        if n < 2:
            return {"slope": 0.0, "direction": "stable", "r_squared": 0.0}

        # Map dates to sequential x values (0, 1, 2, ...)
        x_values = list(range(n))
        y_values = [dp["combined_score"] for dp in data_points]

        # Compute means
        x_mean = sum(x_values) / n
        y_mean = sum(y_values) / n

        # Compute slope and intercept via least squares
        numerator = sum(
            (x - x_mean) * (y - y_mean)
            for x, y in zip(x_values, y_values)
        )
        denominator = sum((x - x_mean) ** 2 for x in x_values)

        if denominator == 0:
            return {"slope": 0.0, "direction": "stable", "r_squared": 0.0}

        slope = numerator / denominator
        intercept = y_mean - slope * x_mean

        # Compute R-squared (coefficient of determination)
        ss_res = sum(
            (y - (slope * x + intercept)) ** 2
            for x, y in zip(x_values, y_values)
        )
        ss_tot = sum((y - y_mean) ** 2 for y in y_values)

        r_squared = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

        # Determine direction based on slope magnitude
        if slope > 0.5:
            direction = "improving"
        elif slope < -0.5:
            direction = "declining"
        else:
            direction = "stable"

        return {
            "slope": round(slope, 4),
            "direction": direction,
            "r_squared": round(max(0.0, min(1.0, r_squared)), 4),
        }

    def aggregate_daily(
        self,
        analyses: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Group analyses by date and compute average scores per day.

        Args:
            analyses: List of analysis dicts. Each must have 'created_at'
                (datetime or ISO string), 'seo_score', 'geo_score', and
                'combined_score'.

        Returns:
            List of dicts sorted by date, each containing: date,
            seo_score, geo_score, combined_score, scan_count.
        """
        daily: dict[str, dict[str, Any]] = defaultdict(
            lambda: {
                "seo_total": 0.0,
                "geo_total": 0.0,
                "combined_total": 0.0,
                "count": 0,
            }
        )

        for analysis in analyses:
            created_at = analysis.get("created_at")
            if isinstance(created_at, datetime):
                date_key = created_at.strftime("%Y-%m-%d")
            elif isinstance(created_at, str):
                # Handle ISO format strings
                date_key = created_at[:10]
            else:
                continue

            bucket = daily[date_key]
            bucket["seo_total"] += float(analysis.get("seo_score", 0))
            bucket["geo_total"] += float(analysis.get("geo_score", 0))
            bucket["combined_total"] += float(analysis.get("combined_score", 0))
            bucket["count"] += 1

        # Build sorted result
        result = []
        for date_key in sorted(daily.keys()):
            bucket = daily[date_key]
            count = bucket["count"]
            result.append({
                "date": date_key,
                "seo_score": round(bucket["seo_total"] / count, 1),
                "geo_score": round(bucket["geo_total"] / count, 1),
                "combined_score": round(bucket["combined_total"] / count, 1),
                "scan_count": count,
            })

        return result
