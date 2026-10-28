from app.analytics.detectors.payday_cycle import PaydayCycleDetector
from app.analytics.detectors.recurring import RecurringDetector
from app.analytics.detectors.time_of_day import TimeOfDayDetector
from app.analytics.detectors.unused_subscription import UnusedSubscriptionDetector

DETECTORS = [RecurringDetector(), PaydayCycleDetector(), TimeOfDayDetector(), UnusedSubscriptionDetector()]
