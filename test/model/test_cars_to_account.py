import textwrap

import pytest

from countryroad.utils.test import *


GEOMETRY_1 = """\
#
0

  1
  #

#
2

  3
  #

#
4
"""


@pytest.mark.parametrize("id,cars", [
    (0, [1, 2, 3, 4]),
    (1, [0]),
    (2, [3, 4]),
    (3, [2, 1, 0]),
    (4, []),
])
def test_cars_to_account_1(id, cars):
    m = load_geometry(GEOMETRY_1)
    assert [m.cars[index].id for index in m.cars_to_account(index_by_id(m, id))] == cars


GEOMETRY_2 = """\
  0
  #
  #
# #
#
# 2
1 #
  #
  #
"""


@pytest.mark.parametrize("id,cars", [
    (0, [1]),
    (1, [0, 2]),
    (2, [1, 0]),
])
def test_cars_to_account_1(id, cars):
    m = load_geometry(GEOMETRY_2)
    assert [m.cars[index].id for index in m.cars_to_account(index_by_id(m, id))] == cars
