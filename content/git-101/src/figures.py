"""Small, code-native teaching figures for Git 101."""


def figure(body, caption, labels, view_box="0 0 580 280"):
    return {"b": body, "cap": caption, "l": labels, "note": "", "vb": view_box}


FIGURES = {
    "three-areas": figure(
        """
<rect class="f-panel" data-l="working" x="18" y="82" width="150" height="96" rx="12"/>
<rect class="f-panel" data-l="staging" x="215" y="82" width="150" height="96" rx="12"/>
<rect class="f-panel" data-l="repository" x="412" y="82" width="150" height="96" rx="12"/>
<path class="f-arrow" data-l="add" d="M168 130H207M197 122L207 130L197 138"/>
<path class="f-arrow" data-l="commit" d="M365 130H404M394 122L404 130L394 138"/>
<text data-l="working" x="93" y="112" text-anchor="middle">working tree</text>
<text class="f-note c-mut" data-l="working" x="93" y="138" text-anchor="middle">files you edit</text>
<text data-l="staging" x="290" y="112" text-anchor="middle">staging area</text>
<text class="f-note c-mut" data-l="staging" x="290" y="138" text-anchor="middle">next snapshot</text>
<text data-l="repository" x="487" y="112" text-anchor="middle">repository</text>
<text class="f-note c-mut" data-l="repository" x="487" y="138" text-anchor="middle">saved history</text>
<text class="c-acc" data-l="add" x="187" y="105" text-anchor="middle">add</text>
<text class="c-acc" data-l="commit" x="384" y="105" text-anchor="middle">commit</text>
""".strip(),
        "The three local areas. Add chooses the next snapshot; commit records it.",
        ["working", "staging", "repository", "add", "commit"],
    ),
    "snapshots": figure(
        """
<path class="f-thin" d="M66 144H500"/>
<circle class="f-node" data-l="commits" cx="80" cy="144" r="15"/>
<circle class="f-node" data-l="commits" cx="200" cy="144" r="15"/>
<circle class="f-node" data-l="commits" cx="320" cy="144" r="15"/>
<circle class="f-node c-acc" data-l="head" cx="440" cy="144" r="17"/>
<text data-l="commits" x="80" y="190" text-anchor="middle">A</text>
<text data-l="commits" x="200" y="190" text-anchor="middle">B</text>
<text data-l="commits" x="320" y="190" text-anchor="middle">C</text>
<text data-l="commits" x="440" y="190" text-anchor="middle">D</text>
<path class="f-lead" data-l="branch" d="M440 126V82H500"/>
<rect class="f-label" data-l="branch" x="492" y="65" width="70" height="30" rx="15"/>
<text data-l="branch" x="527" y="86" text-anchor="middle">main</text>
<path class="f-lead c-acc" data-l="head" d="M440 162V220H382"/>
<rect class="f-label c-acc" data-l="head" x="315" y="205" width="78" height="30" rx="15"/>
<text class="c-acc" data-l="head" x="354" y="226" text-anchor="middle">HEAD</text>
""".strip(),
        "Commits form a parent chain; the branch and HEAD identify the current tip.",
        ["commits", "branch", "head"],
    ),
    "branch-merge": figure(
        """
<path class="f-thin" data-l="main" d="M45 188H535"/>
<circle class="f-node" data-l="main" cx="70" cy="188" r="12"/>
<circle class="f-node" data-l="main" cx="170" cy="188" r="12"/>
<circle class="f-node" data-l="diverge" cx="290" cy="188" r="12"/>
<circle class="f-node c-acc" data-l="merge" cx="490" cy="188" r="14"/>
<path class="c-grn" data-l="feature" d="M170 188C205 188 210 96 270 96H374C430 96 442 188 490 188"/>
<circle class="f-node c-grn" data-l="feature" cx="270" cy="96" r="12"/>
<circle class="f-node c-grn" data-l="feature" cx="374" cy="96" r="12"/>
<path class="f-dash c-amb" data-l="fast-forward" d="M290 230H490"/>
<path class="f-dash c-blu" data-l="rebase" d="M270 56H470M460 48L470 56L460 64"/>
<text data-l="main" x="52" y="225">main</text>
<text class="c-grn" data-l="feature" x="270" y="76" text-anchor="middle">feature</text>
<text class="c-acc" data-l="merge" x="490" y="224" text-anchor="middle">merge</text>
<text class="c-amb f-note" data-l="fast-forward" x="390" y="252" text-anchor="middle">fast-forward: move the name</text>
<text class="c-blu f-note" data-l="rebase" x="370" y="36" text-anchor="middle">rebase: replay onto a new base</text>
<text class="f-note c-mut" data-l="diverge" x="290" y="168" text-anchor="middle">both sides moved</text>
""".strip(),
        "A feature branch can fast-forward, diverge and merge, or be replayed by rebase.",
        ["main", "feature", "fast-forward", "diverge", "merge", "rebase"],
    ),
    "conflict": figure(
        """
<rect class="f-panel" data-l="ours" x="24" y="66" width="148" height="150" rx="12"/>
<rect class="f-panel" data-l="theirs" x="216" y="66" width="148" height="150" rx="12"/>
<rect class="f-panel c-acc" data-l="resolved" x="408" y="66" width="148" height="150" rx="12"/>
<text data-l="ours" x="98" y="96" text-anchor="middle">ours</text>
<path data-l="ours" d="M50 128H146M50 151H132M50 174H144"/>
<text data-l="theirs" x="290" y="96" text-anchor="middle">theirs</text>
<path data-l="theirs" d="M242 128H338M242 151H322M242 174H340"/>
<path class="f-arrow c-acc" data-l="resolved" d="M370 142H400M390 134L400 142L390 150"/>
<text class="c-acc" data-l="resolved" x="482" y="96" text-anchor="middle">resolved</text>
<path class="c-acc" data-l="resolved" d="M434 128H530M434 151H514M434 174H528"/>
<text class="f-note c-mut" data-l="resolved" x="482" y="244" text-anchor="middle">a decision, then tests</text>
""".strip(),
        "A conflict is a request to decide the final content, not a broken repository.",
        ["ours", "theirs", "resolved"],
    ),
    "remote-loop": figure(
        """
<rect class="f-panel" data-l="local" x="42" y="72" width="182" height="142" rx="14"/>
<rect class="f-panel" data-l="remote" x="356" y="72" width="182" height="142" rx="14"/>
<circle class="f-node" data-l="local" cx="92" cy="150" r="12"/>
<circle class="f-node" data-l="local" cx="142" cy="150" r="12"/>
<circle class="f-node" data-l="local" cx="192" cy="150" r="12"/>
<circle class="f-node" data-l="remote" cx="406" cy="150" r="12"/>
<circle class="f-node" data-l="remote" cx="456" cy="150" r="12"/>
<circle class="f-node" data-l="remote" cx="506" cy="150" r="12"/>
<path class="c-grn" data-l="push" d="M230 120H350M340 112L350 120L340 128"/>
<path class="c-blu" data-l="fetch" d="M350 184H230M240 176L230 184L240 192"/>
<text data-l="local" x="133" y="104" text-anchor="middle">local repo</text>
<text data-l="remote" x="447" y="104" text-anchor="middle">origin</text>
<text class="c-grn" data-l="push" x="290" y="105" text-anchor="middle">push</text>
<text class="c-blu" data-l="fetch" x="290" y="211" text-anchor="middle">fetch</text>
""".strip(),
        "Push publishes commits; fetch updates your local knowledge of the remote.",
        ["local", "remote", "push", "fetch"],
    ),
    "undo-map": figure(
        """
<path class="f-thin" d="M76 64V226"/>
<circle class="f-node c-grn" data-l="unstage" cx="76" cy="70" r="13"/>
<circle class="f-node c-amb" data-l="revert" cx="76" cy="122" r="13"/>
<circle class="f-node c-blu" data-l="reflog" cx="76" cy="174" r="13"/>
<circle class="f-node c-red" data-l="danger" cx="76" cy="226" r="13"/>
<text class="c-grn" data-l="unstage" x="112" y="76">restore --staged: keep edits</text>
<text class="c-amb" data-l="revert" x="112" y="128">revert: undo with a new commit</text>
<text class="c-blu" data-l="reflog" x="112" y="180">reflog: find moved references</text>
<text class="c-red" data-l="danger" x="112" y="232">reset --hard / clean: can destroy work</text>
<path class="f-dash-red" data-l="discard" d="M420 60V104"/>
<text class="c-red f-note" data-l="discard" x="420" y="42" text-anchor="middle">restore file</text>
<text class="c-red f-note" data-l="discard" x="420" y="122" text-anchor="middle">discards unstaged edits</text>
""".strip(),
        "Match the undo tool to the layer; pause before commands that discard files or rewrite history.",
        ["unstage", "discard", "revert", "reflog", "danger"],
    ),
    "agent-loop": figure(
        """
<rect class="f-label" data-l="brief" x="18" y="112" width="78" height="42" rx="18"/>
<rect class="f-label" data-l="branch" x="110" y="112" width="78" height="42" rx="18"/>
<rect class="f-label" data-l="diff" x="202" y="112" width="70" height="42" rx="18"/>
<rect class="f-label" data-l="test" x="286" y="112" width="70" height="42" rx="18"/>
<rect class="f-label" data-l="review" x="370" y="112" width="84" height="42" rx="18"/>
<rect class="f-label c-acc" data-l="merge" x="468" y="112" width="92" height="42" rx="18"/>
<path class="f-thin" d="M96 133H110M188 133H202M272 133H286M356 133H370M454 133H468"/>
<text data-l="brief" x="57" y="139" text-anchor="middle">brief</text>
<text data-l="branch" x="149" y="139" text-anchor="middle">branch</text>
<text data-l="diff" x="237" y="139" text-anchor="middle">diff</text>
<text data-l="test" x="321" y="139" text-anchor="middle">test</text>
<text data-l="review" x="412" y="139" text-anchor="middle">review</text>
<text class="c-acc" data-l="merge" x="514" y="139" text-anchor="middle">merge</text>
<path class="f-dash c-blu" data-l="review" d="M412 164C412 218 149 218 149 164"/>
<text class="f-note c-blu" data-l="review" x="280" y="230" text-anchor="middle">feedback returns to the isolated branch</text>
""".strip(),
        "Agent work stays a proposal until its diff, checks, and review support a merge.",
        ["brief", "branch", "diff", "test", "review", "merge"],
    ),
    "worktrees": figure(
        """
<rect class="f-panel c-acc" data-l="shared" x="204" y="26" width="172" height="54" rx="14"/>
<text class="c-acc" data-l="shared" x="290" y="59" text-anchor="middle">shared Git objects</text>
<path class="f-thin" d="M290 80V106M90 106H490M90 106V132M290 106V132M490 106V132"/>
<rect class="f-panel" data-l="scout" x="20" y="132" width="140" height="86" rx="12"/>
<rect class="f-panel" data-l="builder" x="220" y="132" width="140" height="86" rx="12"/>
<rect class="f-panel" data-l="reviewer" x="420" y="132" width="140" height="86" rx="12"/>
<text data-l="scout" x="90" y="165" text-anchor="middle">scout</text>
<text class="f-note c-mut" data-l="branches" x="90" y="193" text-anchor="middle">agent/map</text>
<text data-l="builder" x="290" y="165" text-anchor="middle">builder</text>
<text class="f-note c-mut" data-l="branches" x="290" y="193" text-anchor="middle">agent/build</text>
<text data-l="reviewer" x="490" y="165" text-anchor="middle">reviewer</text>
<text class="f-note c-mut" data-l="branches" x="490" y="193" text-anchor="middle">agent/review</text>
<path class="c-grn" data-l="scope" d="M90 224C90 260 260 260 274 238M490 224C490 260 320 260 306 238"/>
<rect class="f-label c-acc" data-l="integrator" x="244" y="226" width="92" height="38" rx="16"/>
<text class="c-acc" data-l="integrator" x="290" y="251" text-anchor="middle">integrate</text>
""".strip(),
        "Parallel worktrees isolate files and branches while one integrator owns the combined result.",
        ["shared", "branches", "scope", "scout", "builder", "reviewer", "integrator"],
    ),
    "pr-gate": figure(
        """
<path class="f-thin" d="M44 142H536"/>
<circle class="f-node" data-l="diff" cx="100" cy="142" r="24"/>
<circle class="f-node" data-l="tests" cx="220" cy="142" r="24"/>
<circle class="f-node" data-l="human" cx="340" cy="142" r="24"/>
<circle class="f-node c-acc" data-l="main" cx="480" cy="142" r="28"/>
<text data-l="diff" x="100" y="148" text-anchor="middle">diff</text>
<text data-l="tests" x="220" y="148" text-anchor="middle">tests</text>
<text data-l="human" x="340" y="148" text-anchor="middle">review</text>
<text class="c-acc" data-l="main" x="480" y="148" text-anchor="middle">main</text>
<path class="f-arrow c-acc" data-l="main" d="M368 142H444M434 134L444 142L434 150"/>
<text class="f-note c-mut" x="290" y="210" text-anchor="middle">proposal crosses every required gate</text>
""".strip(),
        "A protected branch moves only after the proposed diff passes its required gates.",
        ["diff", "tests", "human", "main"],
    ),
}
