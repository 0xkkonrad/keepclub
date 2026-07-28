# -*- coding: utf-8 -*-
"""11 Meteorology — the Beaufort scale, where a forecast comes from, gale warnings.

Deliberately thin. The bar is the Beaufort scale and knowing where a forecast
comes from; everything that explains *why* the weather does what it does —
fronts, isobars, depressions, sea breezes, fog, the barometer, reading a
Shipping Forecast bulletin — is a hard exclusion and belongs to Day Skipper.
"""
from ds import ref

SECTION = ("cc-weather", "11 Meteorology", [

 # The Competent Crew cut of the sheet: the table only. Day Skipper's version
 # carries a Shipping Forecast footer — visibility bands, pressure-trend jargon
 # — which this syllabus excludes by name.
 ref("meteo", "What are Beaufort forces 0 to 3?", media="cc-beaufort.png"),

 ref("meteo", "What is the Beaufort scale, and what are forces 4, 6 and 8 called?", media="cc-beaufort.png"),

 ref("meteo", "What are the wind speeds for Beaufort forces 5, 7 and 9?", media="cc-beaufort.png"),

 ref("meteo", "What are Beaufort forces 10, 11 and 12?", media="cc-beaufort.png"),

 ref("meteo", "Where can you get a marine forecast at sea?"),

 ("When is the forecast looked at?",
  "<b>Before you leave</b>, so the skipper can decide whether to go at all, and <b>again while you are out</b> &mdash; a forecast is hours old by the time you are using it and the next one may not say the same thing. Getting it is often a crew job: write it down word for word as it is read out, do not summarise it, and hand it to the skipper."),

 ("A <b>gale warning</b> is broadcast for the sea area you are in. What does that mean to you?",
  "A mean wind of <b>force 8</b> or more, <b>or gusts of 43 knots or more</b>, is expected in that sea area within the forecast period. Whether the boat sails is the skipper's call and not yours; your part is to pass the warning on the moment you hear it, and then to expect a reef, lifejackets on and clipped on, hatches and washboards shut, everything below stowed properly, and hot food made early rather than later."),

 ("The skipper asks what the wind is doing. How do you read it off the sea?",
  "By what the water is doing, not by how cold you feel:<br>a few <b>white horses</b> breaking here and there &mdash; about force 3;<br>white horses everywhere and some <b>spray</b> coming off them &mdash; force 5 to 6;<br>foam blowing in <b>streaks</b> down the wind and spray stinging your face &mdash; force 7 and up;<br>the tops of the waves blown off into <b>spindrift</b> &mdash; force 8 and more. Report what you can see and let the skipper put a number on it.",
  "cc-beaufort.png"),

])
