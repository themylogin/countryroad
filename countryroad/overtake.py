from collections import namedtuple
import math

from .car import *
from .car_utils import *


def can_overtake(model, index: int):
    car = model.cars[index]

    assert not car.is_overtaking

    car_in_the_front_index = model.car_in_the_front_index(index)
    assert car_in_the_front_index is not None

    car_in_the_front = model.cars[car_in_the_front_index]

    speed_difference = car.speed - car_in_the_front.speed
    if speed_difference <= 0:
        return False

    distance_to_travel = (
        abs(car.next_position(1) - car_in_the_front.back) +
        car_in_the_front.length +
        car.length
    )

    time_to_travel = int(math.ceil(distance_to_travel / speed_difference))

    for oncoming_car_index in model.cars_to_account(index):
        oncoming_car = model.cars[oncoming_car_index]
        if oncoming_car.direction != car.direction:
            if cars_trajectories_overlap(car, oncoming_car, time_to_travel):
                return False

    return True


def can_finish_overtake(model, index: int, new_position: float):
    car = model.cars[index]

    car_in_the_back_index = model.car_in_the_back_index(index)
    if car_in_the_back_index is not None:
        car_in_the_back = model.cars[car_in_the_back_index]
        new_car_in_the_back_position = car_in_the_back.oriented_position.advance(car_in_the_back.speed)
        if not cars_overlap(
            car.advance(position=new_position),
            car_in_the_back.advance(position=new_car_in_the_back_position),
        ):
            return True
