"""Restage existing storyboards (Staging v4): replace chapters' scene/params, keep glosses, cover and verses.

Usage: .venv/bin/python -I -X utf8 restage.py <spec.py>
The spec defines RS = {pid: {"chapters": [ch, ...], "cover_at": [v, w] (optional), "notes": "..." (optional, appended)}}
One entry per existing chapter, in order, matched by "id" (ids/verses never change). Chapter forms:
  {"id": "c1", "keep": True}                                    keep the chapter exactly as it is
  {"id": "c1", "amb": "geometric", "b": [...], "m": [...], "t": "dissolve"}       ambient (unseen, Names, battles)
  {"id": "c1", "set": "prayer_hall", "time": "night", "a": [...], "e": [...], "b": [...], "m": [...], "t": "slide"}
Optional "title": a new chapter title (2-4 words MSA, no Quran phrase).
Actors "a": "id type[:look] place count pose [enter=v:w] [exit=v:w] [label=name_with_underscores] [unc]"
   e.g. "b believers center 3 stand", "p man:poor right 1 sit", "m prophet left 1 stand label=موسى"
Events "e": "type v:w [until=v:w]"      e.g. "rain 22:4 until=22:9"
Beats  "b": "v:w do [who] [to]"         e.g. "113:7 pray b", "114:13 give b p", "114:1 shot_wide"
Motifs "m": "v:w motif [place] [size] [exit=..] [until=v:w]"   (stage motifs default to size s)
After writing, runs autobeats (camera moves in gaps) and verify, and prints PASSED/FAILED per storyboard.
"""
import json, pathlib, runpy, subprocess, sys

ROOT = pathlib.Path('/home/user/GenerateShortCoran')
PY = [str(ROOT / '.venv/bin/python'), '-I', '-X', 'utf8']


def ref(s):
    v, w = s.split(':'); return [int(v), int(w)]


def motif(line, stage):
    p = line.split()
    m = {"at": ref(p[0]), "until": None, "motif": p[1], "place": "top", "size": "s" if stage else "m"}
    for x in p[2:]:
        if x in ("center", "left", "right", "top", "bottom"): m["place"] = x
        elif x in ("s", "m", "l"): m["size"] = x
        elif x.startswith("exit="): m["exit"] = x[5:]
        elif x.startswith("until="): m["until"] = ref(x[6:])
        else: raise SystemExit(f"bad motif token {x!r} in {line!r}")
    return m


def beat(line):
    q = line.split()
    b = {"at": ref(q[0]), "do": q[1]}
    if len(q) > 2: b["who"] = q[2]
    if len(q) > 3: b["to"] = q[3]
    return b


def actor(line):
    q = line.split()
    if len(q) < 5: raise SystemExit(f"bad actor {line!r}: id type[:look] place count pose ...")
    typ, _, look = q[1].partition(':')
    a = {"id": q[0], "type": typ, "label": "", "place": q[2], "count": int(q[3]), "pose": q[4], "enter": None, "exit": None}
    if look: a["look"] = look
    for x in q[5:]:
        if x.startswith("enter="): a["enter"] = ref(x[6:])
        elif x.startswith("exit="): a["exit"] = ref(x[5:])
        elif x.startswith("label="): a["label"] = x[6:].replace('_', ' ')
        elif x == "unc": a["uncountable"] = True
        else: raise SystemExit(f"bad actor token {x!r} in {line!r}")
    return a


def event(line):
    q = line.split()
    e = {"type": q[0], "at": ref(q[1]), "until": None}
    for x in q[2:]:
        if x.startswith("until="): e["until"] = ref(x[6:])
        else: raise SystemExit(f"bad event token {x!r} in {line!r}")
    return e


def build(old, c):
    if c.get("keep"):
        return old
    stage = "set" in c
    prm = {}
    if stage:
        prm.update({"setting": c["set"], "time": c.get("time", "day"), "actors": [actor(x) for x in c.get("a", [])],
                    "events": [event(x) for x in c.get("e", [])]})
    elif "amb" in c:
        prm["mood"] = c["amb"]
    else:
        raise SystemExit(f"chapter {c.get('id')}: needs 'keep', 'set' or 'amb'")
    prm["beats"] = [beat(x) for x in c.get("b", [])]
    prm["motifs"] = [motif(x, stage) for x in c.get("m", [])]
    if c.get("t"): prm["transition"] = c["t"]
    elif old.get("params", {}).get("transition") and c.get("t") is None: prm["transition"] = old["params"]["transition"]
    out = {"id": old["id"], "title": c.get("title", old["title"]), "verses": old["verses"], "scene": "stage" if stage else "ambient", "params": prm}
    return out


def main(spec):
    specs = runpy.run_path(spec)["RS"]
    bad = 0
    for pid, s in specs.items():
        p = ROOT / "storyboard" / f"{pid}.json"
        sb = json.loads(p.read_text(encoding="utf-8"))
        olds = {c["id"]: c for c in sb["chapters"]}
        if [c["id"] for c in s["chapters"]] != [c["id"] for c in sb["chapters"]]:
            raise SystemExit(f"{pid}: chapter ids {[c['id'] for c in s['chapters']]} must match {[c['id'] for c in sb['chapters']]}")
        sb["chapters"] = [build(olds[c["id"]], c) for c in s["chapters"]]
        if s.get("cover_at"): sb["cover"]["at"] = s["cover_at"]
        if s.get("cover_title"): sb["cover"]["title_ar"], sb["cover"]["title_en"] = s["cover_title"]
        d = sb.setdefault("director", {"mode": "hand", "notes": ""})
        if s.get("notes"):   # idempotent: a re-run replaces the v4 note instead of appending it again
            base = d.get("notes", "").split(" STAGING v4: ")[0].split("STAGING v4: ")[0]
            d["notes"] = (base + " STAGING v4: " + s["notes"]).strip()
        sb["staging"] = 4
        sb["motion"] = 3
        p.write_text(json.dumps(sb, ensure_ascii=False, indent=1), encoding="utf-8")
        subprocess.run(PY + ["pipeline/autobeats.py", pid, "--gap", "4.5"], cwd=ROOT, capture_output=True)
        r = subprocess.run(PY + ["pipeline/verify.py", f"storyboard/{pid}.json", "--json"], cwd=ROOT, capture_output=True, text=True)
        line = next((l for l in r.stdout.splitlines() if l.startswith("@@ ")), None)
        res = json.loads(line[3:])["verify"] if line else {"passed": False, "results": [["FAIL", "internal", r.stderr[-400:]]]}
        fails = [x[2] for x in res["results"] if x[0] == "FAIL"]
        print(f"{pid}: {'PASSED' if res['passed'] else 'FAILED'}")
        for f in fails:
            print("   FAIL", f[:300]); bad += 1
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main(sys.argv[1])
