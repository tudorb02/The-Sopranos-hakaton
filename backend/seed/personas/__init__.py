"""Explicit registry keeps persona order stable across platforms."""

from .balanced import PERSONA as balanced
from .birthday_month import PERSONA as birthday_month
from .daily_coffee import PERSONA as daily_coffee
from .end_of_month import PERSONA as end_of_month
from .goal_2000 import PERSONA as goal_2000
from .unused_gym import PERSONA as unused_gym

PERSONAS = (end_of_month, daily_coffee, unused_gym, birthday_month, goal_2000, balanced)
