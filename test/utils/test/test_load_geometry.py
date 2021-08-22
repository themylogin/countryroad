import textwrap


import pytest

from countryroad.utils.test import *


@pytest.mark.parametrize("s,result", [
    (
        "0#  a### ##B",
        [LoadedCar(id=0, position=12, length=2, is_overtaking=False),
         LoadedCar(id=10, position=8, length=4, is_overtaking=False),
         LoadedCar(id=37, position=0, length=3, is_overtaking=True)]
    ),
])
def test__load_northbound(s, result):
    assert load_northbound(s) == result


@pytest.mark.parametrize("s,result", [
    (
        "0#  a### ##B",
        [LoadedCar(id=0, position=12, length=2, is_overtaking=True),
         LoadedCar(id=10, position=8, length=4, is_overtaking=True),
         LoadedCar(id=37, position=0, length=3, is_overtaking=False)]
    ),
])
def test__load_southbound(s, result):
    assert load_southbound(s) == result


@pytest.mark.parametrize("s,result", [
    (
        textwrap.dedent("""\
            #
            0
            
              1
              #
            # 
            # #
            # 2
            3
        """),
        [dict(id=3, direction=Direction.SOUTH, lane=Lane.SOUTHBOUND, position=0, length=4),
         dict(id=2, direction=Direction.SOUTH, lane=Lane.NORTHBOUND, position=1, length=2),
         dict(id=1, direction=Direction.NORTH, lane=Lane.NORTHBOUND, position=6, length=2),
         dict(id=0, direction=Direction.SOUTH, lane=Lane.SOUTHBOUND, position=7, length=2)]
    ),
])
def test__load_geometry(s, result):
    assert [
        {k: getattr(car, k) for k in ["id", "direction", "lane", "position", "length"]}
        for car in load_geometry(s).cars
    ] == result
