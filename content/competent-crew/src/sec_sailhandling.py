# -*- coding: utf-8 -*-
"""02 Sail handling — bending on, hoisting, furling, reefing, winches, stowing.

Day Skipper already carries the two rigging sequences and the reefing drill as
order-following lists, so those are pointers. What is written here is the
handling a crew member does with their hands: winches, tailing, the difference
between easing and letting go, and putting the sail away afterwards.
"""
from ds import ref

SECTION = ("cc-sailhandling", "02 Sail handling", [

 # --- bending on -------------------------------------------------------
 ("How do you bend a mainsail on?",
  "<b>Bending on</b> means attaching a sail to the spars. Shackle the tack down at the <b>gooseneck</b>, where the boom meets the mast,<br>feed the foot into the boom groove and pull the clew out to the outhaul,<br>feed the luff slides or bolt rope into the mast track from the head downwards,<br>shackle the halyard to the head and check it runs clear of the spreaders,<br>then put sail ties on until she is wanted.",
  "fig:sail-parts@head,tack,clew,luff,foot,boom,mast"),

 ref("handling", "How do you rig a headsail correctly?"),

 # --- hoisting ---------------------------------------------------------
 ("Why is the boat turned head to wind to hoist the mainsail?",
  "So the sail flaps down the middle of the boat instead of filling. A sail with wind in it jams its slides against the mast track and no amount of winching will get it up. Head to wind the boom is also central and the mainsheet can be free. Expect a lot of flapping and noise while you hoist &mdash; that is what it is supposed to do."),

 ("What is your part in hoisting the mainsail?",
  "Take off every sail tie and count them, because one left on will tear the sail or stop the hoist dead,<br>check the halyard is not wrapped round anything,<br>ease the mainsheet and the kicker,<br>haul hand over hand while it goes up easily,<br>take the last of it on the winch,<br>then let the topping lift off once the sail is carrying the boom."),

 ("How much halyard tension does the mainsail want?",
  "Enough that the creases running back from the luff just disappear, and no more. Hard vertical wrinkles up the luff mean you have over-tightened it; loose scallops between the slides mean it is slack. More wind wants it tighter. Set it, then ask the skipper to look."),

 # --- headsail furling -------------------------------------------------
 ("How do you unroll a furling headsail?",
  "Keep a turn of the furling line on the winch or a hand on it the whole way, so the sail comes out under control rather than unrolling in one bang. Someone pulls the leeward sheet while the furling line is fed off the drum against that resistance, which is what makes the line lie in neat turns for next time."),

 ("How do you furl a headsail away?",
  "One person pulls the furling line while the other keeps a turn on the sheet and lets it go grudgingly, so the sail rolls up tight instead of flogging its way in. Never let the sheet run free. Finish with the furling line cleated hard and both sheet tails coiled, or the sail will unroll itself in the night."),

 # --- reefing ----------------------------------------------------------
 ("What does reefing do, and what will you feel before the skipper calls for one?",
  "<b>Reefing</b> makes the sail smaller so the boat stands up and steers instead of lying over. Before the call comes she will heel far more, bury the leeward rail, feel heavy and hard on the helm, and start banging into waves rather than driving through them. Say what you are feeling. Whether to reef is the skipper's call, but nobody else is sitting where you are."),

 ref("handling", "How do you put a reef in with slab reefing?"),
 ref("handling", "How do you shake out a reef?"),
 ref("handling", "What is a preventer and when do you rig it?"),

 # --- winches ----------------------------------------------------------
 ("How many turns go on a winch, and which way round?",
  "<b>Three turns</b> before any load comes on, and <b>clockwise</b> &mdash; every winch on the boat turns the same way and there is no left-handed one. Put the first turns on while the rope is slack. Extra turns go on <b>as the load builds</b>, which is normal and you will be asked to do it &mdash; but add them with the back of your hand to the drum and your fingers well clear of where the rope feeds on."),

 ("What is tailing?",
  "Pulling in the rope that comes off the winch drum while somebody else winds the handle. Pull steadily and <b>downwards</b>, so the turns stay tight and stack down the drum. A loop standing proud of the others is a riding turn about to happen."),

 ("What is a self-tailing winch, and when should you not use the self-tailer?",
  "The jaw on the top grips the rope so one person can wind and tail at once. Feed the rope up through the arm into the jaw after the turns are on. Take it out of the jaw before you ease anything under load &mdash; the jaw is designed not to let go, which is the opposite of what easing needs."),

 ("Where do your hands go near a loaded winch?",
  "Flat on top of the turns, pressing down, and nowhere else. Never wrap a sheet round your hand and never put fingers where the rope feeds onto the drum. A genoa sheet in a gust does not stop for a finger. If a rope is running away from you, let it go and shout &mdash; do not grab at it."),

 ref("terms", "Riding turn"),

 ("What causes a riding turn, and how do you keep from making one?",
  "Turns put on loosely, a rope led upwards into the drum instead of level or slightly below, or slack tailing that lets one loop climb over another. Keep the lead low, keep the tail pulled down and tight, start with three turns and add the fourth only once the load is already on."),

 ("What do you do with the winch handle when you have finished with it?",
  "Take it out and put it back in its pocket, every single time. Left in the winch it gets kicked overboard or catches somebody's shin the moment the boat lurches."),

 # --- the two easings --------------------------------------------------
 ("What is the difference between 'ease the sheet' and 'let it fly'?",
  "<b>Ease</b> &mdash; let rope out slowly with the turns still on the winch and the load still yours.<br><b>Let it fly</b> &mdash; take the turns off and let the sheet go completely, so the sail flaps and all the drive comes off at once. Letting fly is a stop button for a sail. Do it only when you are told, because the rope end whips and the sail flogs."),

 ("What does 'sweat it up' mean?",
  "Getting the last of a halyard up with two people and no winch. One hauls the halyard sideways away from the mast and lets it back to the cleat, the other takes in the slack that appears each time it goes soft."),

 # --- putting it away --------------------------------------------------
 ("How do you stow the mainsail once it is down?",
  "Take up the topping lift first so the boom cannot drop on anybody. Then flake the sail from side to side over the boom in folds, working outwards from the middle, pulling the leech and the foot straight as you go &mdash; a stuffed sail comes out full of creases next time. Finish with sail ties round boom and sail about every arm's length."),

])
