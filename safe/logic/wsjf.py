def cost_of_delay(user_business_value: int, time_criticality: int, risk_reduction: int) -> int:
    return user_business_value + time_criticality + risk_reduction


def wsjf(
    user_business_value: int, time_criticality: int, risk_reduction: int, job_size: int
) -> float:
    if job_size <= 0:
        raise ValueError("job_size must be positive")
    return round(cost_of_delay(user_business_value, time_criticality, risk_reduction) / job_size, 2)


def rank_features(features: list) -> list:
    return sorted(features, key=lambda f: f.wsjf_score, reverse=True)
