from dataclasses import dataclass
import enum

from countryroad.utils.math import *


KPH_TO_MS = 1000 / 3600

TRUCK_SPEED = 80 * KPH_TO_MS
LEGAL_SPEED = 90 * KPH_TO_MS
NORMAL_SPEED = 109 * KPH_TO_MS

LENGTH = 300 * 1000
