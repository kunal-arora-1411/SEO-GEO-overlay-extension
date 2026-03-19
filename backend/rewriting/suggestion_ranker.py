"""Utility for ranking and filtering rewrite suggestions."""


class SuggestionRanker:
    """Ranks suggestions by impact score in descending order."""

    @staticmethod
    def rank(suggestions: list) -> list:
        """Return a new list sorted by ``impact`` descending.

        Each item is expected to be either a dict with an ``impact`` key
        or an object with an ``impact`` attribute.
        """
        def _get_impact(item) -> int:
            if isinstance(item, dict):
                return int(item.get("impact", 0))
            return int(getattr(item, "impact", 0))

        return sorted(suggestions, key=_get_impact, reverse=True)
