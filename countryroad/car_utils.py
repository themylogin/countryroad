from .car import *
from .utils.math import *


def cars_overlap(car1: Car, car2: Car):
    """
    True if cars bodies would have intersected if they had been put on the same lane.
    """
    return overlap(car1.segment, car2.segment)


def cars_trajectories_overlap(car1: Car, car2: Car, time: float):
    """
    True if cars trajectories will overlap within next `time` seconds
    """
    trajectory1 = (car1.back, car1.next_position(time))
    trajectory2 = (car2.back, car2.next_position(time))
    return overlap(trajectory1, trajectory2)
