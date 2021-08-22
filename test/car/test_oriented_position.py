import operator

import pytest

from countryroad.car import *


@pytest.mark.parametrize("op1,op,op2,result", [
    (OrientedPosition(Direction.NORTH, 5), operator.eq, OrientedPosition(Direction.NORTH, 5), True),
    (OrientedPosition(Direction.NORTH, 5), operator.lt, OrientedPosition(Direction.NORTH, 5), False),
    (OrientedPosition(Direction.NORTH, 5), operator.le, OrientedPosition(Direction.NORTH, 5), True),

    (OrientedPosition(Direction.NORTH, 5), operator.lt, OrientedPosition(Direction.NORTH, 10), True),

    (OrientedPosition(Direction.SOUTH, 5), operator.lt, OrientedPosition(Direction.SOUTH, 10), False),
    (OrientedPosition(Direction.SOUTH, 10), operator.lt, OrientedPosition(Direction.SOUTH, 5), True),

    (OrientedPosition(Direction.NORTH, 5), operator.lt, OrientedPosition(Direction.SOUTH, 5), ValueError),
])
def test_oriented_position_comparison(op1, op, op2, result):
    if isinstance(result, type) and issubclass(result, Exception):
        with pytest.raises(result) as e:
            op(op1, op2)
    else:
        assert op(op1, op2) == result


@pytest.mark.parametrize("op,amount,max_position,result", [
    # Go north unrestricted
    (OrientedPosition(Direction.NORTH, 50), 60, None, 110),
    # Go north but keep the distance
    (OrientedPosition(Direction.NORTH, 50), 60, 100, 100),
    # Do not reverse to keep the distance when going north, idle instead
    (OrientedPosition(Direction.NORTH, 50), 60, 40, 50),
    # Go south unrestricted
    (OrientedPosition(Direction.SOUTH, 50), 40, None, 10),
    # Go south but keep the distance
    (OrientedPosition(Direction.SOUTH, 50), 40, 30, 30),
    # Do not reverse to keep the distance when going south, idle instead
    (OrientedPosition(Direction.SOUTH, 50), 40, 60, 50),
])
def test_oriented_position_advance(op, amount, max_position, result):
    assert op.advance(amount, max_position) == result
