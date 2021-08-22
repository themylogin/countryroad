from .car import *
from .car_utils import *
from .overtake import *


class Model:
    def __init__(self, cars: [Car]):
        self.cars = sorted(cars, key=lambda car: (min(car.segment), car.id))

    def is_valid_index(self, index):
        return 0 <= index < len(self.cars)

    def cars_to_account(self, index):
        """
        Cars that we should account for (they are either at the side or in the front in any of the lanes)
        """
        car = self.cars[index]

        # First check for cars on the sides, for that we might need to go backwards
        yield_index = index
        while True:
            if not self.is_valid_index(yield_index - car.direction.increment):
                break

            if cars_overlap(car, self.cars[yield_index - car.direction.increment]):
                yield_index -= car.direction.increment
            else:
                break

        # Next yield all cars starting `yield_index` except our car
        while True:
            if not self.is_valid_index(yield_index):
                break

            if yield_index != index:
                yield yield_index

            yield_index += car.direction.increment

    def car_in_the_front_index(self, index):
        car = self.cars[index]
        for car_in_the_front_index in self.cars_to_account(index):
            car_in_the_front = self.cars[car_in_the_front_index]
            if car_in_the_front.lane == car.lane:
                return car_in_the_front_index

    def car_in_the_back_index(self, index):
        car = self.cars[index]

        if car.direction == Direction.NORTH:
            decrement = -1
        else:
            decrement = 1

        while self.is_valid_index(index := index + decrement):
            if self.cars[index].direction == car.direction:
                return index

    def advance(self):
        new_cars = self.cars.copy()

        for direction in [Direction.NORTH, Direction.SOUTH]:
            cars = enumerate(self.cars)
            if direction == Direction.NORTH:
                cars = reversed(list(cars))

            car_in_the_front = None
            for index, car in cars:
                if car.direction != direction:
                    continue

                max_position = None
                if car_in_the_front is not None:
                    max_position = car_in_the_front.back_with_safety_distance(car.safety_distance)

                lane = car.lane
                new_position_at_full_speed = car.oriented_position.advance(car.speed)
                new_position = car.oriented_position.advance(car.speed, max_position)
                if car.is_overtaking:
                    new_position = new_position_at_full_speed

                    if can_finish_overtake(self, index, new_position):
                        lane = car.lane.oncoming
                else:
                    if new_position < new_position_at_full_speed:
                        # Either slow down or overtake
                        if can_overtake(self, index):
                            new_position = new_position_at_full_speed
                            lane = car.lane.oncoming

                new_car = car.advance(position=new_position, lane=lane)

                new_cars[index] = new_car

                if not new_car.is_overtaking:
                    car_in_the_front = new_car

        return Model(new_cars)
