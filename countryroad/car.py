from dataclasses import dataclass, replace
import enum
import functools


class Direction(enum.Enum):
    NORTH = 0
    SOUTH = 1

    @property
    def increment(self):
        if self == Direction.NORTH:
            return 1
        else:
            return -1

    @property
    def lane(self):
        return {
            Direction.NORTH: Lane.NORTHBOUND,
            Direction.SOUTH: Lane.SOUTHBOUND,
        }[self]

    @property
    def opposite(self):
        if self.value == Direction.NORTH:
            return Direction.SOUTH
        else:
            return Direction.NORTH


class Lane(enum.Enum):
    NORTHBOUND = 0
    SOUTHBOUND = 1

    @property
    def oncoming(self):
        if self == Lane.NORTHBOUND:
            return Lane.SOUTHBOUND
        else:
            return Lane.NORTHBOUND


@functools.total_ordering
class OrientedPosition:
    def __init__(self, direction, position):
        self.direction = direction
        self.position = position

    def __eq__(self, other):
        return self.direction == other.direction and self.position == other.position

    def __lt__(self, other):
        if self.direction != other.direction:
            raise ValueError("Unable to compare OrientedPosition with different directions")

        if self.direction == Direction.NORTH:
            return self.position < other.position
        else:
            return self.position > other.position

    def advance(self, amount, max_position=None):
        assert amount > 0

        if self.direction == Direction.NORTH:
            next_position = self.position + amount
            if max_position is not None:
                if max_position < self.position:
                    max_position = self.position
                if next_position > max_position:
                    next_position = max_position
        else:
            next_position = self.position - amount
            if max_position is not None:
                if max_position > self.position:
                    max_position = self.position
                if next_position < max_position:
                    next_position = max_position

        return next_position


@dataclass
class Car:
    id: int
    generation: int
    direction: Direction
    lane: Lane
    position: float  # Position of the front of the car
    speed: float
    length: float
    safety_distance: float

    @property
    def oriented_position(self):
        return OrientedPosition(self.direction, self.position)

    @property
    def back(self):
        return self.back_with_safety_distance(0)

    def back_with_safety_distance(self, safety_distance):
        if self.direction == Direction.NORTH:
            return self.position - self.length - safety_distance
        else:
            return self.position + self.length + safety_distance

    @property
    def segment(self):
        return tuple(sorted([self.position, self.back]))

    @property
    def is_overtaking(self):
        return self.direction.lane != self.lane

    def next_position(self, seconds):
        assert seconds > 0
        return self.oriented_position.advance(self.speed * seconds)

    def advance(self, **changes):
        changes["generation"] = self.generation + 1
        return replace(self, **changes)
