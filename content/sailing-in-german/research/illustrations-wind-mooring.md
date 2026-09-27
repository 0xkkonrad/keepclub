# Wind and mooring illustration terminology

Reviewed 2026-09-27. The JSON contains every SVG text occurrence in original order: 11 for `windward-lee`, 13 for `mooring-lines`, plus both captions. Both source notes are empty. No generated files, geometry, highlight IDs, or course cards were changed by this review.

The main references are Rolf Dreyer's [Segellexikon](https://www.segeln-lernen.de/segellexikon.html), [Bootsschule1's Spring entry](https://bootsschule1.de/lexikon/spring/), and the sail-training organisation LebenLernen auf Segelschiffen's [Roald Amundsen Bordhandbuch](https://www.sailtraining.de/wp-content/uploads/2024/11/LLaS_BHB_D_v6_LOWRES.pdf). The latter's German nautical glossary defines Querleine on printed page 96, PDF page 49. Its definition matches the transverse line drawn from amidships. The PDF was retrieved directly and read with `pdftotext` because the browser reader rejected its size. General dictionaries are not used as evidence.

The captions have source lists and rationales in JSON. All labels and annotations have their own source lists. Ordinary connective wording is authored German; the sources establish the nautical concepts.

Three changes narrow misleading claims in the English source:

- `the sheltered side` becomes `vom Wind abgewandt`. [Lee](https://www.segeln-lernen.de/segellexikon-lee.html) specifies a direction relative to the wind, without promising shelter.
- `and the boom’s side` becomes `hier steht der Baum`. The boom is visibly to leeward in this drawing; the wording does not make it a universal rule during manoeuvres or when sails are held aback.
- `wind blows off it: shelter` becomes `Wind weht vom Land`. [Ablandiger Wind](https://www.segeln-lernen.de/segellexikon-ablandiger-wind.html) supports the wind direction. Offshore wind alone does not establish safe shelter.

The shore labels are deliberately `Küste in Luv` and `Küste in Lee`, measured from the boat. This avoids switching to the perspective of an island when using the compounds Luvküste and Leeküste. Dreyer's [Legerwall](https://www.segeln-lernen.de/segellexikon-legerwall.html) confirms that a nearby coast in Lee is the grounding hazard. The boat's orientation and the wind arrows support the respective labels.

The mooring diagram has its bow to the right. The forward spring runs from the forward attachment diagonally left to the shore, so it is a [Vorspring](https://www.segeln-lernen.de/segellexikon-vorspring.html) and checks forward movement. The after spring runs diagonally right from aft, so it is an [Achterspring](https://www.segeln-lernen.de/segellexikon-achterspring.html) and checks aft movement. Bootsschule1 independently confirms those restraints. `Vorleine` identifies the bow mooring line; `Palstek` would identify the knot called a bowline and would be wrong here. `Querleine` identifies the transverse mooring line; the loanword `Fender` is established German nautical usage.

The existing course cards agree with these directions and terms. Browser label-fit verification remains part of the integrating agent's build review.
