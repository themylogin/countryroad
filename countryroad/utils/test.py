from collections import namedtuple

from ..car import *
from ..model import Model


LoadedCar = namedtuple("LoadedCar", ["id", "position", "length", "is_overtaking"])


def load_geometries(s: str):
    geometries = []
    for line in s.rstrip().split("\n"):
        if line == "_":
            continue

        parts = f"{line} ".split(" | ")
        if not geometries:
            geometries = [f"{part}\n" for part in parts]
        else:
            assert len(geometries) == len(parts)
            for i, part in enumerate(parts):
                geometries[i] += f"{part}\n"

    if geometries[-1].strip() == "":
        geometries.pop()

    return list(map(load_geometry, geometries))


def load_geometry(s: str):
    southbound = ""
    northbound = ""
    for line in s.rstrip("\n").split("\n"):
        if line == "_":
            continue

        assert len(line) <= 3
        line = line + " " * (3 - len(line))
        assert line[1] == " "
        southbound += line[0]
        northbound += line[2]

    cars_by_id = {}
    for loaded_car in load_northbound(northbound):
        cars_by_id[loaded_car.id] = car_from_loaded_car(loaded_car, Lane.NORTHBOUND)
    for loaded_car in load_southbound(southbound):
        if loaded_car.id in cars_by_id:
            raise ValueError(f"Duplicate car ID {loaded_car.id}")
        cars_by_id[loaded_car.id] = car_from_loaded_car(loaded_car, Lane.SOUTHBOUND)

    return Model(list(cars_by_id.values()))


def load_northbound(s: str):
    # 0###    ###1
    # normal  overtaking
    cars_by_id = {}
    is_car = False
    id = None
    position = None
    length = 0
    is_overtaking = False

    def add_car():
        nonlocal cars_by_id, is_car, id, position, length, is_overtaking

        if id in cars_by_id:
            raise ValueError(f"Duplicate id {id!r} while parsing {s!r}")

        cars_by_id[id] = LoadedCar(id, position, length, is_overtaking)

        is_car = False
        id = None
        position = None
        length = 0
        is_overtaking = False

    for i, c in enumerate(s + " "):
        if c.isalnum():
            if is_car and not is_overtaking:
                raise ValueError(f"Unexpected id {id!r} while parsing {s!r}")

            if c.isdigit():
                id = int(c)
            else:
                if c.islower():
                    id = 10 + (ord(c) - ord("a"))
                else:
                    id = 36 + (ord(c) - ord("A"))

            if is_car:  # here `is_overtaking == True`
                position = len(s) - i - 1
                length += 1
                add_car()
            else:
                is_car = True
                position = len(s) - i
                length = 1
        elif c == "#":
            if is_car:
                length += 1
            else:
                is_car = True
                length = 1
                is_overtaking = True
        elif c == " ":
            if is_car:
                if is_overtaking:
                    raise ValueError(f"Car without id while parsing {s!r}")

                add_car()
        else:
            raise ValueError(f"Invalid character {c!r}")

    return list(cars_by_id.values())


def load_southbound(s):
    return [
        LoadedCar(
            loaded_car.id,
            len(s) - loaded_car.position,
            loaded_car.length,
            loaded_car.is_overtaking,
        )
        for loaded_car in reversed(load_northbound("".join(reversed(s))))
    ]


def car_from_loaded_car(loaded_car, lane):
    return Car(
        id=loaded_car.id,
        generation=0,
        direction={
            (Lane.NORTHBOUND, False): Direction.NORTH,
            (Lane.NORTHBOUND, True): Direction.SOUTH,
            (Lane.SOUTHBOUND, False): Direction.SOUTH,
            (Lane.SOUTHBOUND, True): Direction.NORTH,
        }[lane, loaded_car.is_overtaking],
        lane=lane,
        position=loaded_car.position,
        speed={
            2: 2,
            4: 1,
        }[loaded_car.length],
        length=loaded_car.length,
        safety_distance={
            2: 2,
            4: 4,
        }[loaded_car.length],
    )


def index_by_id(model, id):
    for i, car in enumerate(model.cars):
        if car.id == id:
            return i

    raise ValueError(id)


def dump_geometry(model):
    height = max([car.position for car in model.cars])
    geometry = [[" "] * 3 for _ in range(height)]

    for car in model.cars:
        if car.lane == Lane.NORTHBOUND:
            col = 2
        else:
            col = 0

        geometry[height - car.position][col] = chr(ord("0") + car.id)
        for i in range(1, car.length):
            geometry[height - car.position + i][col] = "#"

    return "\n".join(map(lambda v: "".join(v), geometry))


def join_geometry_dumps(dumps):
    dumps = [dump.split("\n") for dump in dumps]
    assert [len(dump) == len(dumps[0]) for dump in dumps]

    result = []
    for i in range(len(dumps[0])):
        result.append(" | ".join([dump[i] for dump in dumps]))

    return "\n".join(result)
