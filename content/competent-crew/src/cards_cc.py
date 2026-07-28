# -*- coding: utf-8 -*-
"""The Competent Crew deck, in RYA G158 logbook order.

Each section is its own module so that sections can be written and reviewed
independently. A section is `(key, title, [cards])`; a card is either a
`ref(ds_section, front)` pointing at a Day Skipper card or a tuple
`(question, answer[, figure])` written here.

Section keys carry a `cc-` prefix. Day Skipper's are bare, so when the two decks
share one app there is nothing to disambiguate.
"""
from sec_seaterms import SECTION as S01
from sec_sailhandling import SECTION as S02
from sec_ropework import SECTION as S03
from sec_fire import SECTION as S04
from sec_safetygear import SECTION as S05
from sec_mob import SECTION as S06
from sec_emergency import SECTION as S07
from sec_manners import SECTION as S08
from sec_lookout import SECTION as S09
from sec_tender import SECTION as S10
from sec_weather import SECTION as S11
from sec_seasickness import SECTION as S12
from sec_helming import SECTION as S13
from sec_duties import SECTION as S14

SECTIONS_CC = [
    S01, S02, S03, S04, S05, S06, S07,
    S08, S09, S10, S11, S12, S13, S14,
]
