# -*- coding: utf-8 -*-
"""01 Sea terms, parts of the boat, rigging and sails.

The bar is understanding an order, not explaining a boat. Most of the naming is
already at beginner level in Day Skipper and is pointed at. What is written here
is the vocabulary a first-timer mishears: the verbs in an order, the direction
words, and the three different things 'tack' means.

Order matters in this section more than anywhere else, because it is the first
thing anybody reads. Objects first, then directions, then spaces, then the rig,
then the wind words that need the rig vocabulary, then the verbs.
"""
from ds import ref

SECTION = ("cc-seaterms", "01 Sea terms, parts of the boat, rigging and sails", [

 # --- the objects, before any word that names one ----------------------
 ref("terms", "Bow, stern, port, starboard — what does each mean?"),

 ("Which parts of the boat should you be able to point at on day one?",
  "<b>Mast</b> &mdash; the tall spar standing up out of the deck.<br><b>Boom</b> &mdash; the horizontal spar along the bottom of the mainsail, swinging across the cockpit at about head height.<br><b>Mainsail</b> &mdash; the sail behind the mast.<br><b>Headsail</b> &mdash; the sail in front of it.<br><b>Keel</b> &mdash; the heavy fin bolted on underneath, in the water.<br><b>Rudder</b> &mdash; the blade at the back that steers her.<br><b>Tiller</b> or <b>wheel</b> &mdash; what your hands are on to move the rudder.<br><b>Winch</b> &mdash; the metal drum you take turns of rope round to pull something in.<br><b>Block</b> &mdash; a pulley."),

 # --- where things are -------------------------------------------------
 ("Forward, aft, fore-and-aft, athwartships — what does each mean?",
  "<b>Forward</b> (say 'for'ard') is towards the bow, <b>aft</b> is towards the stern.<br><b>Fore-and-aft</b> means along her, bow to stern.<br><b>Athwartships</b> means across her, side to side.<br>'Go forward' is an instruction to walk up the deck; 'the foredeck' is where you end up.",
  "fig:hull-plan@bow,stern,beam"),

 ref("terms", "Amidships"),
 ref("terms", "Beam (two meanings)"),
 ref("terms", "Ahead, astern, abeam, abaft, forward of the beam"),

 ("Foredeck, sidedeck, coachroof, cockpit, companionway — where is each?",
  "<b>Foredeck</b> &mdash; the deck forward of the mast.<br><b>Sidedeck</b> &mdash; the strip of deck down each side.<br><b>Coachroof</b> &mdash; the raised cabin top in the middle you walk beside, not on.<br><b>Cockpit</b> &mdash; the well you sit and steer in.<br><b>Companionway</b> &mdash; the steps and hatch down into the cabin."),

 ("Heads, galley, saloon, forepeak, berth — what is each?",
  "<b>Heads</b> &mdash; the toilet.<br><b>Galley</b> &mdash; the kitchen.<br><b>Saloon</b> &mdash; the main cabin where everyone sits.<br><b>Forepeak</b> &mdash; the cabin right forward in the bow.<br><b>Berth</b> &mdash; a bunk, and also the space the boat is tied up in."),

 ref("terms", "Bilge, sole, bulkhead"),
 ref("terms", "Pulpit, pushpit, stanchions, guardrails, jackstay"),

 # --- the shape of the hull --------------------------------------------
 ref("terms", "Draught"),
 ref("terms", "Air draught"),
 ref("terms", "Freeboard"),

 ("Why does a yacht not tip over when she heels?",
  "The keel is a lead or iron weight bolted under the hull, and it is a large fraction of everything the boat weighs. She leans, and then she stops leaning. A gust presses her over and the keel stands her back up, so heeling is normal and is not the boat starting to go over."),

 ref("terms", "Heel versus list"),
 ref("terms", "The three rotational motions of a boat at sea"),

 ("What is a seacock, and what are you expected to know about them?",
  "The valve on a hole through the hull &mdash; the sink drain, the heads, the engine's water intake. Shutting one is what stops the boat filling if a hose or a fitting lets go, so on day one find the heads and sink ones and work out which way each of them closes.<br>In normal use you leave every seacock exactly as the skipper set it: some boats keep them shut and open them to use, others leave them open at sea."),

 # --- rig and sails ----------------------------------------------------
 ref("terms", "Name the three sides and three corners of a mainsail."),
 ref("terms", "Standing rigging versus running rigging"),
 ref("terms", "Halyard versus sheet"),
 ref("terms", "Topping lift"),
 ref("terms", "Genoa versus jib"),

 ("'Ease the kicker' — what are you easing?",
  "The <b>kicker</b>, also called the boom vang: the strut or tackle from the bottom of the mast to the underside of the boom. It holds the boom down. Ease it and the boom is free to lift; take it up and the boom comes down again.",
  "fig:rigging@kicker"),

 # --- wind words -------------------------------------------------------
 ref("terms", "Windward and leeward"),
 ref("terms", "Lee shore — and why it matters"),

 ("The forecast says 'northerly'. Where is the wind coming from?",
  "From the north. A wind takes its name from where it comes <b>from</b>, so a northerly blows out of the north and pushes you south."),

 ("What do 'on the wind' and 'off the wind' mean?",
  "<b>On the wind</b> is sailing as close to the wind as the boat will go: sheets hard in, well heeled, and usually the wettest and slowest-feeling point of sail. <b>Off the wind</b> is anything further round than that, with the sheets eased. 'Head up' or 'come up' takes you towards the wind, 'bear away' takes you off it."),

 ("The word 'tack' means three different things. What are they?",
  "1. The <b>manoeuvre</b> of turning the bow through the wind.<br>2. The bottom forward <b>corner</b> of a sail, the one shackled down at the front.<br>3. Which side the wind is coming over: on <b>port tack</b> the wind is on the port side and the boom is out to starboard, and the other way round on <b>starboard tack</b>.",
  "fig:sail-parts@tack"),

 ("What is the difference between a tack and a gybe?",
  "Both swap the wind from one side of the boat to the other. In a <b>tack</b> the bow turns through the wind, the sails flap through the middle and cross quietly. In a <b>gybe</b> the stern turns through the wind and the boom swings the whole way across, fast and hard. That is why a gybe is announced, controlled and ducked, and a tack is only announced."),

 # No diagram: the answer is four words of command and stands on its own, and
 # ds-points-of-sail.png would put the right-of-way rules under it to say so.
 ref("handling", "What are the commands for tacking and gybing?", media=False),

 ("What does 'underway' mean?",
  "Not tied up, not anchored, not aground. You can be underway and drifting about with the engine off and no sails up."),

 ref("position", "What is a knot?"),

 ("How far is a nautical mile, and why is everything measured in knots?",
  "About 1.15 land miles, or a little under 2 km &mdash; it is the unit every distance at sea is given in. Speed through the water is knots and so is wind speed, so 'six knots' on the log (the boat's own speedometer) and 'twenty knots' in the forecast are the same unit. Six knots is about a gentle jog, and that is about what a cruising yacht does."),

 # --- the verbs in an order --------------------------------------------
 ("On a sheet, what do 'ease', 'harden in' and 'trim' mean?",
  "<b>Ease</b> &mdash; let rope out, slowly and still under your control.<br><b>Harden in</b>, or 'sheet in' &mdash; pull rope in so the sail comes closer to the middle of the boat.<br><b>Trim</b> &mdash; adjust it either way until the sail sets properly. 'Trim the genoa' is not an instruction to pull it in hard."),

])
