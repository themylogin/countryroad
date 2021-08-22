import textwrap

import pytest

from countryroad.overtake import *
from countryroad.utils.test import *


@pytest.mark.parametrize("position_2,speed_2,result", [
    (10, 2, False),
    (100, 2, True),
    (100, 10, True),
    (100, 20, False),
    (1000, 20, True),
])
def test_can_overtake_1(position_2, speed_2, result):
    # Car 0 wants to overtake truck 1 but car 2 is oncoming
    model = load_geometry(textwrap.dedent("""\
        #
        2

          1
          #
          #
          #

          0
          #
    """))

    model.cars[index_by_id(model, 1)].speed = 1

    model.cars[index_by_id(model, 2)].generation = 1
    model.cars[index_by_id(model, 2)].position = position_2
    model.cars[index_by_id(model, 2)].speed = speed_2

    assert can_overtake(model, 0) == result
