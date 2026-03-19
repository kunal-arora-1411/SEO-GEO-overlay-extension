def aggregate_scores(seo_score: int, geo_score: int) -> dict:
    """Combine SEO and GEO scores into a single grade.

    Weighting: 40 % SEO, 60 % GEO -- reflecting that GEO readiness is
    the primary differentiator this tool provides.
    """
    combined = round(seo_score * 0.4 + geo_score * 0.6)

    grades = {
        "A+": (90, 100),
        "A": (80, 89),
        "B": (70, 79),
        "C": (60, 69),
        "D": (50, 59),
        "F": (0, 49),
    }

    grade = "F"
    for g, (lo, hi) in grades.items():
        if lo <= combined <= hi:
            grade = g
            break

    return {
        "combined_score": combined,
        "grade": grade,
        "seo_score": seo_score,
        "geo_score": geo_score,
    }
