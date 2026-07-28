# 08 Position, distance and speed

## How is latitude defined and measured?

The angular distance north or south of the equator, from 0&deg; at the equator to 90&deg; at the poles, measured up the <b>side</b> of the chart. Parallels of latitude are all parallel to the equator.

![diagram](fig:latlong@latitude)

## How is longitude defined and measured?

The angular distance east or west of the Greenwich meridian, from 0&deg; to 180&deg;, measured along the <b>top and bottom</b> of the chart. Meridians of longitude all run from pole to pole and converge at the poles.

![diagram](fig:latlong@longitude)

## How do you write a position, and in what order?

Latitude first, then longitude, each in degrees, minutes and decimals of a minute, with the hemisphere letter: <b>50&deg;42'.3 N 001&deg;18'.7 W</b>. Longitude is written with three digits of degrees.

![diagram](fig:latlong@position)

## What is a nautical mile, and how does it relate to latitude?

One minute of latitude, defined internationally as <b>1,852 metres</b>. Because meridians converge, one minute of <b>longitude</b> equals a nautical mile only at the equator — so always measure distance on the <b>latitude</b> scale at the side of the chart.

![diagram](fig:latlong@mile,latitude)

## What is a knot?

One nautical mile per hour.

## The three quantities in every speed, time and distance sum

Distance = speed &times; time.<br>Speed = distance / time.<br>Time = distance / speed. Work in decimal hours, or use 'minutes = distance &times; 60 / speed'.

## At 5.5 knots, how long does 8.3 miles take?

8.3 / 5.5 = 1.509 hours. 0.509 &times; 60 = 30.5, so <b>1 h 30&frac12; min</b> — call it 1 h 31 for an ETA. (Or 8.3 &times; 60 / 5.5 = 90.5 minutes.)

## What is a great circle and a rhumb line?

A <b>great circle</b> is the shortest route between two points on the globe. A <b>rhumb line</b> crosses every meridian at the same angle and plots as a straight line on a Mercator chart — it is what you steer on a short coastal passage, where the difference is negligible.

## Why is a Mercator projection convenient for navigation, and what is its cost?

Meridians and parallels are straight and at right angles, so a constant course is a straight line and angles are true. The cost is that scale increases with latitude, so areas at high latitude are exaggerated and you must measure distance at the latitude you are in.

## What is a true bearing, and how is it written?

A direction measured clockwise from true north, always in three figures: 007&deg;, 095&deg;, 270&deg;. Suffix T for true, M for magnetic, C for compass.

## Relative bearing versus compass bearing

A <b>relative</b> bearing is measured from the boat's head — 'a ship on the starboard bow', 'fine to port', '30&deg; on the port bow'. A <b>compass</b> bearing is measured from north. Convert by adding a relative bearing measured <b>clockwise from the bow</b> to your heading, subtracting 360&deg; if the total exceeds it. If it is given as so many degrees <b>on the port bow</b>, subtract instead: heading 100&deg;, 30&deg; on the port bow = 070&deg;.

## Speed over the ground versus speed through the water

<b>Through the water</b> is what the log reads. <b>Over the ground</b> is what the GNSS reads, and it includes the tidal stream. The difference is the tide, plus any log error.

## Course, heading and track — what is the difference?

<b>Heading</b> is where the bow points at this instant. <b>Course</b> is the direction you intend to steer. <b>Water track</b> is the path through the water, so heading corrected for leeway. <b>Ground track</b> (course over ground) is the path over the seabed, so water track corrected for tide.

## What is the depth reading on an echo sounder measured from, and why does that matter?

It depends on the calibration — from the transducer, from the waterline, or under the keel. Know which yours does and by how much, because your clearance calculation depends on it. Set it to read depth below the keel or add the offset every time.

## What is 'height of eye' used for?

Calculating the distance to the visible horizon and the geographical range of a light, and it appears in the rising/dipping distance tables. In a small yacht it is typically 2-3 m.

## How do you estimate distance off using a vertical sextant angle or by eye?

With the charted height of an object and the measured vertical angle you can read distance off from a table or use distance (M) = 1.854 &times; height (m) / angle (minutes). By eye, learn your own boat's marks: hull down, features visible, windows distinguishable — and always distrust it.

## Why must you check the chart datum of a GNSS position before plotting it?

A latitude and longitude referenced to WGS84 will not fall in the same place on a chart drawn to another horizontal datum such as OSGB36 — the error can be over 100 m. Modern charts note the shift; set the GNSS to match the chart, or apply the correction printed on it.
