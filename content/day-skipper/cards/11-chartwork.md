# 11 Chartwork — fixes, DR, EP and course to steer

## What is a position line?

A line somewhere on which you know you are: a compass bearing of a charted object, a transit, a depth contour matched to the echo sounder, or a range from a light. Two crossing position lines give a fix; three give a fix and a check.

## What is a fix, how is it marked, and what do you write next to it?

A position established from two or more position lines taken at effectively the same time. Mark it with a <b>dot inside a small circle</b> and label it with the <b>time</b> and the log reading.

![diagram](ds-ep-plot.png)

## How do you take a good three-bearing fix?

Choose three charted objects you are certain of, spread roughly 60-120&deg; apart. Take the bearing that is changing <b>slowest</b> first and the fastest-changing one <b>last</b>, note the time and log, convert to true and plot each line from the object.

![diagram](ds-fix-pilotage.png)

## What is a cocked hat, and what do you do about it?

The small triangle left when three bearings do not meet at a point. Assume you are at the corner <b>nearest the danger</b>. A large cocked hat means an error — a misidentified mark, a mistake in variation, or too much time between bearings — so take it again.

![diagram](ds-fix-pilotage.png)

## What is a dead reckoning position, and how is it marked?

The position worked up from the last fix using only the course steered and the distance run through the water, with <b>no allowance for tide or leeway</b>. Marked with a <b>cross</b> and the time.

![diagram](ds-ep-plot.png)

## What is an estimated position, and how is it marked?

The DR position corrected for the tidal stream and for leeway — the best estimate of where you actually are without a fix. Marked with a <b>triangle</b> and the time.

![diagram](ds-ep-plot.png)

## How do you construct an estimated position?

From the last fix plot the <b>course steered</b> in true and lay off the distance run by log — that is the <b>DR</b>, marked with a cross.<br>Apply leeway to give the <b>water track</b> (one arrowhead), the same distance run.<br>From the end of the water track plot the <b>tidal stream vector</b> for the time since the fix (three arrowheads).<br>Its end is the <b>EP</b>, marked with a triangle.<br>Fix to EP is the ground track (two arrowheads).

![diagram](ds-ep-plot.png)

## What are the arrowhead conventions on a chart plot?

<b>One</b> arrowhead — water track (course through the water).<br><b>Two</b> arrowheads — ground track (course over the ground).<br><b>Three</b> arrowheads — tidal stream vector.

![diagram](ds-ep-plot.png)

## How do you work out a course to steer?

Draw the <b>ground track</b> you want from your fix to the destination.<br>From the fix, plot the hour's <b>tide vector</b> (set and drift).<br>Set the dividers to the boat's speed for one hour and, from the end of the tide vector, cut the ground track.<br>The direction of that cut is the <b>water track</b> — your course to steer, before leeway and compass corrections.<br>The tide and boat-speed vectors must cover the <b>same period</b>.

![diagram](ds-cts-triangle.png)

## In a course-to-steer triangle, which side is the tide and which is your speed?

The tide vector is plotted <b>from the starting fix</b>, in the direction the stream <b>sets</b>, its length equal to the drift for that period. The boat's speed vector is swung <b>from the end of the tide vector</b> to cut the intended ground track, and must cover the same period as the tide.

![diagram](ds-cts-triangle.png)

## How do you find the speed over the ground and the ETA from a course-to-steer triangle?

Measure the ground track from the start to where the boat-speed vector cuts it. If you built the triangle with <b>one hour</b> of tide and one hour of boat speed, that distance in miles is your SOG in knots; for any other period it is the distance made good in that period, so divide by the period to get SOG. Total leg distance divided by SOG gives the time.

![diagram](ds-cts-triangle.png)

## What is a running fix and when do you use it?

When you can see only one charted object. Take a bearing,<br>note time and log,<br>run on,<br>take a second bearing,<br>then transfer the first position line forward by the course and distance run (corrected for tide) and cross it with the second. Less accurate than a two-object fix, so use it as a check.

## What is a transferred position line?

Any earlier position line moved forward along the ground track by the distance made good, so it can be crossed with a later observation. It is the basis of the running fix.

## Why should you never simply steer straight at a waypoint across a strong cross-tide?

Because the autopilot or helm will crab you round a long curve, sailing extra distance and possibly across a hazard on the inside of the curve. Work out the course to steer that makes good the straight track instead.

## What is cross-track error, and what should you do with it?

The plotter's measure of how far you are off the straight line between waypoints, with the side. Use it as a check on your course to steer, but understand it does not know what is on either side of the line — the chart does.

## How do you use a depth contour as a position line?

Compare the echo sounder reading, corrected for the height of tide and the transducer offset, with the charted depth. The moment you cross a distinct contour you are somewhere <b>on that contour</b> — the contour itself is the position line, running in whatever direction the contour runs. Cross it as near square-on as you can so the moment of crossing is sharp, and cross it with a bearing to get a fix. Excellent when visibility fails.

## Two objects give bearings 040&deg;M and 130&deg;M. Variation is 5&deg;W. What do you plot?

Convert each to true by subtracting the westerly variation when going magnetic to true: <b>035&deg;T and 125&deg;T</b>. Plot each line from its object. They are 90&deg; apart, which is an ideal cut.

## Why does a fix from two bearings taken 15&deg; apart deserve suspicion?

Because a small error in either bearing moves the intersection a long way along the lines. Bearings that cut at close to a right angle give the tightest fix; anything under about 30&deg; is unreliable.

## What is 'the six-minute rule' and how do you use it at the chart table?

In six minutes you travel one tenth of your speed in miles — at 6 knots, 0.6 M. It makes quick mental work of the distance run between fixes and of tidal drift over part of an hour.

## You have no GNSS, no visibility and no depth information you trust. What do you do?

Stop making the situation worse. Heave to or slow down,<br>sound the fog signal,<br>work up an EP from the last known fix,<br>plot the danger areas around it,<br>and either stand off into safe deep water or anchor in a shallow area clear of the channel until visibility lifts.

## Track required 090&deg;T, tide sets 180&deg;T at 1.5 kn, boat speed 5 kn, wind from the north giving 5&deg; leeway, variation 4&deg;W, no deviation. What do you steer?

Plot 1.5 M of tide on 180&deg; from the fix;<br>from its end swing 5 M to cut the 090&deg; track.<br>Water track = <b>073&deg;T</b>, SOG = <b>4.8 kn</b>.<br>The wind is from the north, so steer 5&deg; upwind of the water track: heading <b>068&deg;T</b>.<br>Variation 4&deg;W, so 068 + 4 = <b>072&deg;C</b>.

![diagram](ds-cts-triangle.png)

## How do you lay off and read a course or bearing with a Portland (Breton) plotter?

To <b>read</b> a line: lay the plotter's edge along it, rotate the rose until its grid lines are parallel with a meridian and the arrow points to the top of the chart, and read the true bearing. To <b>plot</b>: set the bearing on the rose first, then slide the plotter until the grid is parallel with a meridian and the edge passes through the object. Distance is separate — dividers on the <b>latitude</b> scale.

## How do you plot 50&deg;38'.4 N 001&deg;33'.6 W on the chart?

Set the dividers to 38'.4 on the latitude scale at the side, step in from the nearest printed parallel and pencil a short line; set them to 33'.6 on the longitude scale at the top or bottom and step in from the nearest meridian, using a straight edge or plotter. The position is the crossing. Check the hemisphere, and that the minutes increase in the direction you expect.

## Your leg will take 40 minutes. What do you put in the course-to-steer triangle?

Vectors for the <b>same period</b>: 40 minutes of tide, so rate &times; 40/60, and 40 minutes of boat speed. Any period works so long as both use it. Over more than an hour, or where the stream changes, work hour by hour or use the resultant of each hour's tide.

![diagram](ds-cts-triangle.png)
