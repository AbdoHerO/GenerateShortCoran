"""Verification gate. Exit code 1 = do NOT render.

Checks
  A. Quran text   - API words re-join to the verse text; second independent source (Tanzil Uthmani)
                    matches after NFC + a small, documented list of pure encoding equivalences.
  B. Audio timing - one timing per verse, segments cover every word, inside the verse window;
                    reciter repetitions are reported (renderer must handle them).
  C. Storyboard   - chapters cover every verse once, in order; every gloss excerpt is a VERBATIM
                    substring of the cited tafsir and contains no Quran quotation ({...}).
  D. Translation / tafsir resources are the expected ones.
  E. Fonts        - every code point drawn exists in the font that draws it (no silent fallback).

Usage: python pipeline/verify.py storyboard/15_57-77.json
"""
import json, pathlib, re, sys, unicodedata, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
UA = "quran-video-builder/0.1"
FONTS = ROOT / "renderer" / "fonts"

# Pure encoding differences between the QF (quran.com) Uthmani text and Tanzil Uthmani.
# Each maps to the same visual Mushaf glyph; anything not listed here fails the check.
EQUIVALENCES = [
    ("ـٰ", "ٰ", "tatweel + superscript alef == superscript alef (dagger alef)"),
    ("ـَٔ", "ءَ", "tatweel+fatha+hamza-above == standalone hamza + fatha"),
    ("ـَٔ", "ءَ", "tatweel+hamza-above+fatha == standalone hamza + fatha"),
    (" ۜ", "ۜ", "sakt sign (U+06DC small high seen) after a space (Tanzil) == the same sign attached to the word (QF); e.g. 18:1"),
]

CATALOG = json.loads((ROOT / "renderer" / "js" / "scene_catalog.json").read_text(encoding="utf-8"))
# hand-made scenes only work for the passage they were drawn for (their timings reference specific words)
CUSTOM_SCENES = {
    (15, 57, 77): {"abraham", "rescue", "arrival", "night", "crowd", "refusal", "heedless", "blast", "overturn", "lesson"},
    (26, 60, 68): {"musa_pursuit", "musa_meet", "musa_trust", "musa_sea", "musa_rescue", "musa_lesson"},
}
TONES = {"red", "green", "blue", "amber"}
LABEL_RE = re.compile(r"^[ء-ي ]{2,30}$")      # Arabic letters and spaces only (a name label)
ID_RE = re.compile(r"^[a-z][a-z0-9_]{0,15}$")
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def nfc(s): return unicodedata.normalize("NFC", s)
def strip_html(s): return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()
def clean_translation(s): return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", re.sub(r"<sup[^>]*>.*?</sup>", "", s))).strip()
def cps(s): return " ".join(f"U+{ord(c):04X}" for c in s)


def canon(s):
    s = nfc(s.replace("﻿", ""))
    for a, b, _ in EQUIVALENCES:
        s = s.replace(nfc(a), nfc(b))
    return nfc(re.sub(r"\s+", " ", s).strip())


def _tanzil(chapter, cache):
    if not cache.exists():
        url = f"https://api.alquran.cloud/v1/surah/{chapter}/quran-uthmani"
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
            cache.write_bytes(r.read())
    return json.loads(cache.read_text(encoding="utf-8"))["data"]


def second_source(chapter, data_dir):
    """Tanzil Uthmani via alquran.cloud. That API prefixes verse 1 of every surah except 1 and 9 with the basmala; the
    prefix is removed using Tanzil's OWN text of 1:1 (never a typed basmala), and only if it matches exactly."""
    d = _tanzil(chapter, data_dir / "second_source_tanzil_uthmani.json")
    ayahs = {a["numberInSurah"]: a["text"] for a in d["ayahs"]}
    ed = dict(d.get("edition", {}))
    if chapter not in (1, 9) and 1 in ayahs:
        (ROOT / "data" / "_tanzil").mkdir(parents=True, exist_ok=True)
        basmala = canon(_tanzil(1, ROOT / "data" / "_tanzil" / "001.json")["ayahs"][0]["text"])
        a1 = canon(ayahs[1])
        if a1.startswith(basmala + " "):
            ayahs[1] = a1[len(basmala) + 1:]
            ed["basmala_note"] = "verse 1: basmala prefix added by alquran.cloud removed (matched Tanzil 1:1 exactly)"
    return ayahs, ed


def apply_timing_corrections(src, sb, report=None):
    """Explicit, logged fixes for known errors in the QF word-timing data. Each fix only applies if the raw data
    still shows exactly the error it describes; otherwise it fails (the data changed - re-check by ear)."""
    T = {t["verse_key"]: t for t in src["recitation"]["timestamps"]}
    ch = sb["passage"]["chapter"]
    applied = []
    for c in sb.get("timing_corrections", []):
        t = T.get(f"{ch}:{c['verse']}")
        seg = t["segments"][c["segment_index"]] if t and c["segment_index"] < len(t["segments"]) else None
        if seg is None or seg[0] != c["expect_word"]:
            if report: report("FAIL", "audio", f"{ch}:{c['verse']} timing correction no longer matches the data (segment {c['segment_index']} = {seg}) - re-check by ear")
            continue
        seg[0] = c["set_word"]
        applied.append({**c, "start_ms": seg[1], "end_ms": seg[2]})
        if report: report("INFO", "audio", f"{ch}:{c['verse']} timing correction applied: segment {c['segment_index']} word {c['expect_word']} -> {c['set_word']} ({seg[1]}-{seg[2]} ms). NEEDS LISTENING CONFIRMATION. {c.get('note','')}")
    return applied


AR_MARKS = re.compile(r"[ؐ-ًؚ-ٟۖ-ۭ࣓-ࣿ]")
def skel(s):
    """Letters-only Arabic skeleton, so Uthmani and plain (imla'i) spellings of the same word compare equal."""
    s = nfc(s).replace("ىٰ", "ى").replace("ـٰ", "ا").replace("ٰ", "ا").replace("ـ", "")
    s = AR_MARKS.sub("", s)
    s = s.translate(str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي", "ء": None}))
    return re.findall(r"[ء-ي]+", s)


def word_variants(w):
    """Skeleton spellings a plain-text writer may use for one Quran word (stricter wording checks, never looser):
    the dagger alef read as a written alef («السماوات») or as nothing («إله», «ذلك»), and an accusative tanween
    alef dropped («قياما» -> «قيام»). Returns a set of token tuples."""
    out = {tuple(skel(w))}
    if "ٰ" in w:
        out.add(tuple(skel(nfc(w).replace("ـٰ", "").replace("ٰ", ""))))
    if "ً" in w:
        out |= {t[:-1] + (t[-1][:-1],) for t in list(out) if t and len(t[-1]) > 2 and t[-1].endswith("ا")}
    return {t for t in out if t}


PREFIXES = ("اف", "او", "و", "ف", "ب", "ك", "ل", "ا")
def unprefixed(t):
    """Token without a leading conjunction, preposition or interrogative («أفحكم» -> «حكم», «والكتاب» -> «الكتاب»,
    «للناس» -> «الناس»): used for titles only, which must not restate the passage at all."""
    out = {t}
    if t.startswith("لل") and len(t) > 4:
        out.add("ا" + t[2:])
    for p in PREFIXES:
        if t.startswith(p) and len(t) - len(p) >= 3 and not (p == "ا" and t.startswith("ال")):
            out.add(t[len(p):])
    return out


def quran_bigrams(word_texts, prefixes=False):
    """All skeleton bigrams of consecutive Quran words, over every spelling variant of each word."""
    seqs = [word_variants(w) for w in word_texts]
    if prefixes:
        seqs = [{tuple(x) for t in s for x in _prod([unprefixed(y) for y in t])} for s in seqs]
    bg = set()
    for s in seqs:
        for t in s:
            bg |= set(zip(t, t[1:]))
    for a, b in zip(seqs, seqs[1:]):
        bg |= {(x[-1], y[0]) for x in a for y in b}
    return bg


def _prod(lists):
    out = [()]
    for l in lists:
        out = [o + (x,) for o in out for x in l]
    return out


def first_diff(a, b):
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            return i
    return min(len(a), len(b))


def font_cmap(name):
    from fontTools.ttLib import TTFont
    return set(TTFont(FONTS / name).getBestCmap().keys())


def scene_anchors(c):
    p = c.get("params") or {}
    extra = {"motif"} if p.get("motifs") else set()   # v3: the arrow may point at the motif on screen
    if c["scene"] == "ambient":
        return set(CATALOG["ambient"]["anchors"]) | extra
    if c["scene"] == "stage":
        return set(CATALOG["stage"]["anchors_base"]) | {a.get("id") for a in p.get("actors", [])} | extra
    return None   # hand-made scene: anchors are whatever the scene defines


def check_motifs(c, p, word_ref, errs, seg_start):
    """Motion graphics v3: params.motifs and params.transition (contract: scene_catalog.json motifs/transitions)."""
    MO = CATALOG["motifs"]
    if "transition" in p and p["transition"] not in CATALOG["transitions"]["kinds"]:
        errs.append(f"transition '{p['transition']}' unknown (use one of {', '.join(CATALOG['transitions']['kinds'])})")
    motifs = p.get("motifs")
    if motifs is None:
        return
    if not isinstance(motifs, list):
        errs.append("motifs must be a list"); return
    if len(motifs) > MO["max_per_chapter"]:
        errs.append(f"{len(motifs)} motifs (max {MO['max_per_chapter']})")
    starts = []
    for m in motifs:
        mid = m.get("motif")
        if mid not in MO["library"]:
            errs.append(f"motif '{mid}' unknown"); continue
        if m.get("place") not in MO["places"]:
            errs.append(f"motif {mid}: place '{m.get('place')}' unknown ({', '.join(MO['places'])})")
        if m.get("size") not in MO["sizes"]:
            errs.append(f"motif {mid}: size '{m.get('size')}' unknown ({', '.join(MO['sizes'])})")
        if "exit" in m and m["exit"] not in MO["exits"]:
            errs.append(f"motif {mid}: exit '{m['exit']}' unknown ({', '.join(MO['exits'])})")
        if m.get("at") is None:
            errs.append(f"motif {mid} needs 'at'"); continue
        word_ref(m.get("at"), f"motif {mid} at")
        word_ref(m.get("until"), f"motif {mid} until")
        ok_ref = lambda r: isinstance(r, list) and len(r) == 2
        ts = seg_start.get(tuple(m["at"])) if ok_ref(m.get("at")) else None
        te = seg_start.get(tuple(m["until"])) if ok_ref(m.get("until")) else None
        if ts is not None:
            starts.append(ts)
            if te is not None and te <= ts:
                errs.append(f"motif {mid}: 'until' {m['until']} is not after 'at' {m['at']}")
    starts.sort()
    for x, y in zip(starts, starts[1:]):
        if y - x < 800:
            errs.append(f"two motifs start only {y - x} ms apart (min 800 ms)"); break


def check_motion(sb, T, fail, ok):
    """v3 storyboards (\"motion\": 3): something must happen on screen at least every 6 s of recitation in every
    chapter (a beat, a motif or an event), and the video must use motifs."""
    if sb.get("motion") != 3:
        return
    ch = sb["passage"]["chapter"]
    total_motifs, static = 0, 0
    for c in sb["chapters"]:
        p = c.get("params") or {}
        if c.get("scene") not in ("ambient", "stage"):
            continue
        segs = [s for n in c["verses"] for s in (T.get(f"{ch}:{n}") or {}).get("segments") or [] if len(s) >= 3]
        if not segs:
            continue
        start = {}
        for n in c["verses"]:
            for s in (T.get(f"{ch}:{n}") or {}).get("segments") or []:
                start.setdefault((n, s[0]), s[1])
        a, b = min(s[1] for s in segs), max(s[2] for s in segs)
        acts = [start.get(tuple(x["at"])) for k in ("beats", "motifs", "events") for x in (p.get(k) or [])
                if isinstance(x.get("at"), list) and len(x["at"]) == 2]
        acts = sorted(t for t in acts if t is not None)
        total_motifs += len(p.get("motifs") or [])
        pts = [a] + acts + [b]
        # a gap counts only where a word starts inside it (+-1 s): actions are tied to word starts, so a single word
        # held for a long time cannot be filled (the motifs and the scene keep living through it)
        wstarts = sorted(start.values())
        gaps = [((y - x), x) for x, y in zip(pts, pts[1:]) if any(x + 1000 < w < y - 1000 for w in wstarts)]
        gap, where = max(gaps) if gaps else (0, a)
        if gap > 6000:
            static += 1
            fail("scenes", f"chapter '{c['id']}': {gap / 1000:.1f} s of recitation with no beat, motif or event "
                           f"(from {(where - a) / 1000:.1f} s into the chapter); motion graphics v3 needs one every 4-6 s")
    if total_motifs == 0:
        fail("scenes", "motion graphics v3: the storyboard has no motifs")
    elif not static:
        ok("scenes", f"motion v3: {total_motifs} motifs, no chapter is static for more than 6 s")


EVENT_NEEDS = {   # event -> (allowed settings or None, actor type that must be present or None)
    "sea_part": (("sea_shore", "river"), None), "sun_arc": (("cave",), None), "turn_sleepers": (None, "sleepers"), "wake": (None, "sleepers"),
    "wither": (("garden",), None), "fish_escape": (None, "fish"), "ship_hole": (None, "ship"), "wall_repair": (None, "wall"),
    "barrier_build": (("pass",), "barrier"),
}


def check_beats(c, p, word_ref, errs, seg_start):
    B = CATALOG["beats"]
    beats = p.get("beats") or []
    if not isinstance(beats, list):
        errs.append("beats must be a list"); return
    if len(beats) > B["max_per_chapter"]:
        errs.append(f"{len(beats)} beats (max {B['max_per_chapter']})")
    stage = c["scene"] == "stage"
    allowed = set(B["camera"]) | set(B["scene"]) | (set(B["actor"]) if stage else set(B["ambient"]))
    actor_ids = {a.get("id"): a for a in p.get("actors") or []}
    anchors = scene_anchors(c)
    places = set(CATALOG["stage"]["places"])
    times = []
    for b in beats:
        d = b.get("do")
        if d not in allowed:
            errs.append(f"beat '{d}' is not allowed in a {c['scene']} scene"); continue
        word_ref(b.get("at"), f"beat {d} at")
        if b.get("at") is None:
            errs.append(f"beat {d} needs 'at'"); continue
        who, to = b.get("who") or "", b.get("to") or ""
        if d in B["actor"]:
            if who not in actor_ids:
                errs.append(f"beat {d}: 'who' must be an actor id of this chapter, got '{who}'")
            elif d == "glow" and actor_ids[who].get("type") not in ("prophet", "angel", "honored"):
                errs.append(f"beat glow: '{who}' is not a light drop")
            if d in ("point", "walk_to") and to not in places | set(actor_ids):
                errs.append(f"beat {d}: 'to' must be left|center|right or an actor id, got '{to}'")
        elif d == "shot_close" and who not in anchors:
            errs.append(f"beat shot_close: 'who' must be an actor id or anchor ({', '.join(sorted(anchors))}), got '{who}'")
        elif d == "sparkle" and who and who not in anchors:
            errs.append(f"beat sparkle: 'who' must be an actor id or anchor, got '{who}'")
        t = seg_start.get(tuple(b["at"])) if isinstance(b.get("at"), list) and len(b["at"]) == 2 else None
        if t is not None:
            times.append(t)
    times.sort()
    for x, y in zip(times, times[1:]):
        if y - x < 800:
            errs.append(f"two beats only {y - x} ms apart (min 800 ms)"); break


def check_scenes(sb, verses, ok, fail, info, q_bigrams=frozenset(), seg_start=None):
    """Validate chapter scene ids/params against the scene catalog (contract shared with the renderer)."""
    P = sb["passage"]
    seg_start = seg_start or {}
    nwords = {n: len([w for w in v["words"] if w["char_type_name"] == "word"]) for n, v in verses.items()}
    custom = CUSTOM_SCENES.get((P["chapter"], P["from"], P["to"]), set())
    amb, stg = CATALOG["ambient"], CATALOG["stage"]
    for c in sb["chapters"]:
        cid, scene, p = c.get("id"), c.get("scene"), c.get("params") or {}
        errs = []
        title = (c.get("title") or "").strip()
        if not title:
            errs.append("empty title")
        elif len(title) > 28:
            errs.append(f"title too long ({len(title)} chars, max 28)")
        if scene in ("ambient", "stage") and title:
            # titles are UI text: they must never quote the Quran (no diacritics, no two consecutive Quran words)
            if AR_MARKS.search(title):
                errs.append("title must not carry diacritics")
            tsk = skel(title)
            shared = [" ".join(x) for x in zip(tsk, tsk[1:]) if x in q_bigrams]
            if shared:
                errs.append(f"title repeats Quran wording ({', '.join(shared)}); use a descriptive heading")
        if "bg" in c and not HEX_RE.match(str(c["bg"])):
            errs.append(f"bg colour '{c['bg']}' is not #rrggbb")

        def word_ref(ref, what):
            if ref is None:
                return
            if not (isinstance(ref, list) and len(ref) == 2 and ref[0] in c["verses"] and isinstance(ref[1], int)
                    and 1 <= ref[1] <= nwords.get(ref[0], 0)):
                errs.append(f"{what} {ref} is not a word of this chapter's verses {c['verses']}")

        if scene == "ambient":
            if p.get("mood") not in amb["moods"]:
                errs.append(f"ambient mood '{p.get('mood')}' unknown (use one of {', '.join(amb['moods'])})")
            check_beats(c, p, word_ref, errs, seg_start)
            check_motifs(c, p, word_ref, errs, seg_start)
        elif scene == "stage":
            if p.get("setting") not in stg["settings"]:
                errs.append(f"stage setting '{p.get('setting')}' unknown")
            if p.get("time") not in stg["times"]:
                errs.append(f"stage time '{p.get('time')}' unknown")
            actors, events = p.get("actors") or [], p.get("events") or []
            if len(actors) > 5: errs.append(f"{len(actors)} actors (max 5)")
            if len(events) > 4: errs.append(f"{len(events)} events (max 4)")
            ids = [a.get("id") for a in actors]
            if len(set(ids)) != len(ids): errs.append("actor ids are not unique")
            for a in actors:
                spec = stg["actors"].get(a.get("type"))
                if not spec:
                    errs.append(f"actor type '{a.get('type')}' unknown"); continue
                if not ID_RE.match(str(a.get("id"))) or a.get("id") in stg["anchors_base"]:
                    errs.append(f"actor id '{a.get('id')}' must be a short lowercase slug, not one of {stg['anchors_base']}")
                if a.get("place") not in stg["places"]: errs.append(f"actor {a.get('id')}: place '{a.get('place')}' unknown")
                if a.get("pose") not in stg["poses"]: errs.append(f"actor {a.get('id')}: pose '{a.get('pose')}' unknown")
                mx = 12 if spec["group"] else 1
                if not (isinstance(a.get("count"), int) and 1 <= a["count"] <= mx):
                    errs.append(f"actor {a.get('id')}: count {a.get('count')} out of range (1-{mx})")
                label = (a.get("label") or "").strip()
                if spec["needs_label"] and not LABEL_RE.match(label):
                    errs.append(f"actor {a.get('id')} ({a['type']}) needs an Arabic name label of letters only, got '{label}'")
                if not spec["needs_label"] and label and label not in spec.get("optional_label", []):
                    errs.append(f"actor {a.get('id')} ({a['type']}) must not carry a label (no text in the art)")
                if "uncountable" in a and (not isinstance(a["uncountable"], bool) or (a["uncountable"] and not spec["group"])):
                    errs.append(f"actor {a.get('id')}: 'uncountable' must be true/false and only on group actors")
                look = a.get("look") or ""
                if a["type"] == "man":
                    if look and look not in stg["looks"]: errs.append(f"actor {a.get('id')}: look '{look}' unknown ({', '.join(stg['looks'])})")
                elif look:
                    errs.append(f"actor {a.get('id')}: 'look' is only for type 'man'")
                word_ref(a.get("enter"), f"actor {a.get('id')} enter")
                word_ref(a.get("exit"), f"actor {a.get('id')} exit")
            types = {a.get("type") for a in actors}
            for e in events:
                if e.get("type") not in stg["events"]:
                    errs.append(f"event type '{e.get('type')}' unknown"); continue
                if e.get("at") is None: errs.append(f"event {e['type']} needs 'at'")
                word_ref(e.get("at"), f"event {e['type']} at")
                word_ref(e.get("until"), f"event {e['type']} until")
                settings_ok, needs_actor = EVENT_NEEDS.get(e["type"], (None, None))
                if settings_ok and p.get("setting") not in settings_ok:
                    errs.append(f"event {e['type']} needs setting {' or '.join(settings_ok)}")
                if needs_actor and needs_actor not in types:
                    errs.append(f"event {e['type']} needs an actor of type '{needs_actor}'")
            check_beats(c, p, word_ref, errs, seg_start)
            check_motifs(c, p, word_ref, errs, seg_start)
        elif scene in custom:
            pass
        else:
            errs.append(f"scene '{scene}' unknown for this passage (use 'ambient' or 'stage')")
        if errs:
            fail("scenes", f"chapter '{cid}': " + "; ".join(errs))
        else:
            ok("scenes", f"chapter '{cid}': {scene}" + (f" ({p.get('mood') or p.get('setting')})" if scene in ("ambient", "stage") else " (hand-made)"))


def check(sb, src, data_dir):
    """Run every check; returns a list of (level, area, message). Works on a copy of src."""
    import copy
    src = copy.deepcopy(src)
    results = []
    def ok(area, msg): results.append(("PASS", area, msg))
    def fail(area, msg): results.append(("FAIL", area, msg))
    def info(area, msg): results.append(("INFO", area, msg))
    P = sb["passage"]; ch = P["chapter"]
    want = list(range(P["from"], P["to"] + 1))
    verses = {v["verse_number"]: v for v in src["verses"]}

    # ---------- A. Quran text ----------
    if sorted(verses) == want and all(verses[n]["verse_key"] == f"{ch}:{n}" for n in want):
        ok("text", f"{len(want)} verses {ch}:{want[0]}-{want[-1]}, keys and numbers consistent")
    else:
        fail("text", f"verse set mismatch: got {sorted(verses)}")
    tanzil, ed = second_source(ch, data_dir)
    info("text", f"second source: {ed.get('identifier')} / {ed.get('englishName')} via alquran.cloud (Tanzil)")
    if ed.get("basmala_note"):
        info("text", ed["basmala_note"])
    used_eq = set()
    sp = lambda x: re.sub(r"\s+", " ", nfc(x)).strip()
    for n in want:
        v = verses[n]
        words = [w for w in v["words"] if w["char_type_name"] == "word"]
        pos = [w["position"] for w in words]
        if pos != list(range(1, len(words) + 1)):
            fail("text", f"{ch}:{n} word positions not contiguous: {pos}")
        joined = " ".join(w["text_uthmani"] for w in words)   # this is exactly what the renderer draws
        if sp(joined) != sp(v["text_uthmani"]):
            # QF's verse-level field drops the small high/low meem (U+06E2 / U+06ED) that its word-level field and Tanzil
            # carry, and spaces the sakt sign differently. Both are QF's own fields; the word-level text is what is drawn.
            stripped = canon(sp(joined).replace("ۢ", "").replace("ۭ", ""))
            if stripped == canon(sp(v["text_uthmani"]).replace("ۢ", "").replace("ۭ", "")):
                info("text", f"{ch}:{n} QF verse-level text differs from QF word-level text only by small-meem marks (U+06E2/U+06ED) or sakt spacing; rendering word-level text (identical to Tanzil, checked below)")
            else:
                i = first_diff(sp(joined), sp(v["text_uthmani"]))
                fail("text", f"{ch}:{n} QF word-level and verse-level text differ at char {i} beyond known marks")
        a, b = canon(joined), canon(tanzil[n])
        if a == b:
            for x, y, why in EQUIVALENCES:
                if nfc(x) in nfc(joined):
                    used_eq.add(why)
            ok("text", f"{ch}:{n} identical to Tanzil Uthmani ({len(words)} words)")
        else:
            i = first_diff(a, b)
            fail("text", f"{ch}:{n} differs from Tanzil at char {i}: QF[{cps(a[max(0,i-2):i+4])}] vs Tanzil[{cps(b[max(0,i-2):i+4])}]  QF='{a[max(0,i-6):i+6]}' Tanzil='{b[max(0,i-6):i+6]}'")
    for why in sorted(used_eq):
        info("text", f"encoding equivalence applied: {why}")

    # ---------- B. Audio timing ----------
    apply_timing_corrections(src, sb, report=lambda lvl, area, msg: results.append((lvl, area, msg)))
    T = {t["verse_key"]: t for t in src["recitation"]["timestamps"]}
    nb = src["recitation"].get("neighbors") or {}
    prev_to = nb.get("prev_end")     # last word of the verse before the passage (if any)
    for n in want:
        k = f"{ch}:{n}"; t = T.get(k)
        if not t:
            fail("audio", f"{k} has no timing"); continue
        nw = len([w for w in verses[n]["words"] if w["char_type_name"] == "word"])
        segs = t.get("segments") or []
        seen = [s[0] for s in segs]
        missing = sorted(set(range(1, nw + 1)) - set(seen))
        extra = sorted(set(seen) - set(range(1, nw + 1)))
        starts = [s[1] for s in segs]
        problems = []
        if missing: problems.append(f"words without timing {missing}")
        if extra: problems.append(f"segments for non-existent words {extra}")
        if starts != sorted(starts): problems.append("segments not time-ordered")
        if any(s[2] < s[1] for s in segs): problems.append("segment with end<start")
        if segs:
            lead, tail = t["timestamp_from"] - segs[0][1], max(s[2] for s in segs) - t["timestamp_to"]
            # the word segments are what drive the highlight and the audio cut; the verse window is only a hint.
            # Small boundary jitter is normal; what must never happen is overlap with a neighbouring verse's words.
            if lead > 1000 or tail > 1000:
                problems.append(f"segments stray >1 s outside the verse window (lead {lead}ms, tail {tail}ms) - timing data looks broken")
            elif lead > 80 or tail > 80:
                info("audio", f"{k}: first/last word segment {max(lead,0)}/{max(tail,0)} ms outside the verse window (aligner jitter; no overlap with neighbouring words)")
            if prev_to is not None and segs[0][1] < prev_to:
                problems.append(f"first word starts {prev_to - segs[0][1]}ms before previous verse's last word ends")
            prev_to = max(s[2] for s in segs)
            if n == want[-1] and nb.get("next_start") is not None and prev_to > nb["next_start"]:
                problems.append(f"last word ends {prev_to - nb['next_start']}ms after the next verse's first word starts")
        if problems:
            fail("audio", f"{k}: " + "; ".join(problems))
        else:
            ok("audio", f"{k}: {len(segs)} segments cover all {nw} words")
        rep = [s for i, s in enumerate(seen) if s in seen[:i]]
        if rep:
            info("audio", f"{k}: reciter repeats word(s) {sorted(set(rep))} - highlight must jump back (handled by renderer)")
    rec, rid = src["recitation"], src["meta"]["recitation_id"]
    if (src.get("reciter_en") or {}).get("id") == rid and re.search(rf"/0*{ch}\.mp3$", rec.get("audio_url", "")):
        ok("audio", f"reciter {rid} = {src['reciter_en']['name']} ({src['reciter_en']['style']['name']}), file {rec['audio_url']}")
    else:
        fail("audio", f"reciter/audio file mismatch: recitation {rid}, file {rec.get('audio_url')}")
    if sb.get("recitation_id", rid) != rid:
        fail("audio", f"storyboard expects recitation {sb.get('recitation_id')} but data has {rid}")

    # ---------- C. Storyboard ----------
    flat = [n for c in sb["chapters"] for n in c["verses"]]
    if flat == want:
        ok("storyboard", f"{len(sb['chapters'])} chapters cover every verse exactly once, in order")
    else:
        fail("storyboard", f"chapters cover {flat}, expected {want}")
    taf = src["tafsirs"]
    q_bigrams, q_words, t_bigrams = set(), set(), set()
    for v in verses.values():
        wt = [w["text_uthmani"] for w in v["words"] if w["char_type_name"] == "word"]
        sk = skel(" ".join(wt))
        q_words |= set(sk); q_bigrams |= set(zip(sk, sk[1:]))
        q_bigrams |= quran_bigrams(wt)
        t_bigrams |= quran_bigrams(wt, prefixes=True)
    t_bigrams |= q_bigrams
    seg_start0 = {}
    for t in src["recitation"]["timestamps"]:
        for sg in t.get("segments") or []:
            seg_start0.setdefault((int(t["verse_key"].split(":")[1]), sg[0]), sg[1])
    check_scenes(sb, verses, ok, fail, info, t_bigrams, seg_start0)
    check_motion(sb, {t["verse_key"]: t for t in src["recitation"]["timestamps"]}, fail, ok)
    # cover (first frame / thumbnail): UI text, same rules as titles
    cv = sb.get("cover")
    if cv is not None:
        errs = []
        for k in ("series_ar", "title_ar"):
            s = (cv.get(k) or "").strip()
            if not s:
                errs.append(f"cover {k} is empty"); continue
            if len(s) > 26: errs.append(f"cover {k} too long ({len(s)} chars, max 26)")
            if AR_MARKS.search(s): errs.append(f"cover {k} must not carry diacritics")
            tsk = skel(s)
            shared = [" ".join(x) for x in zip(tsk, tsk[1:]) if x in t_bigrams]
            if shared and k == "title_ar":
                errs.append(f"cover title repeats Quran wording ({', '.join(shared)}); use a descriptive title")
            elif shared:
                info("scenes", f"cover series name '{s}' uses Quran wording ({', '.join(shared)}): acceptable only as the story's well-known name - check it")
        for k in ("series_en", "title_en"):
            if len(cv.get(k) or "") > 60: errs.append(f"cover {k} too long (max 60)")
        at = cv.get("at")
        if at is not None and not (isinstance(at, list) and len(at) == 2 and at[0] in verses and isinstance(at[1], int)
                                   and 1 <= at[1] <= len([w for w in verses[at[0]]["words"] if w["char_type_name"] == "word"])):
            errs.append(f"cover 'at' {at} is not a word of the passage")
        if errs: fail("scenes", "cover: " + "; ".join(errs))
        else: ok("scenes", f"cover: {cv.get('series_ar')} / {cv.get('title_ar')}")
    else:
        info("scenes", "no cover block: the video opens on a default cover (surah name + first chapter title)")
    chapter_of = {n: c for c in sb["chapters"] for n in c["verses"]}
    for g in sb["glosses"]:
        n, (w0, w1), tid = g["verse"], g["words"], str(g["tafsir"])
        k = f"{ch}:{n}"
        if n not in verses:
            fail("gloss", f"{k}: verse not in passage"); continue
        words = [w for w in verses[n]["words"] if w["char_type_name"] == "word"]
        if not (1 <= w0 <= w1 <= len(words)):
            fail("gloss", f"{k}: word range {w0}-{w1} invalid (verse has {len(words)} words)"); continue
        chip = " ".join(w["text_uthmani"] for w in words[w0 - 1:w1])
        if tid not in taf or k not in taf[tid]:
            fail("gloss", f"{k}: tafsir {tid} not fetched"); continue
        body = nfc(strip_html(taf[tid][k]["text"]))
        ex = nfc(g["excerpt"].strip())
        ex_sk = skel(ex)
        shared = [" ".join(b) for b in zip(ex_sk, ex_sk[1:]) if b in q_bigrams]
        vocal = [w for w in ex.split() if len(AR_MARKS.findall(w)) >= 2 and skel(w) and skel(w)[0] in q_words]
        if "{" in ex or "}" in ex or "﴿" in ex or "﴾" in ex:
            fail("gloss", f"{k}: excerpt contains a Quran quotation bracket - glosses must be explanation only")
        elif shared:
            fail("gloss", f"{k}: excerpt repeats Quran wording ({', '.join(shared)}) - choose explanation text only")
        elif vocal:
            fail("gloss", f"{k}: excerpt contains a vocalised Quran word ({', '.join(vocal)}) - likely an unmarked quotation")
        elif ex not in body:
            # help the editor: locate the closest start
            i = body.find(ex[:6])
            fail("gloss", f"{k}: excerpt is NOT verbatim in tafsir {tid}: '{ex}'" + (f" | tafsir near: '{body[i:i+len(ex)+8]}'" if i >= 0 else ""))
        else:
            # make sure the excerpt is not inside a {...} quotation in the tafsir
            j = body.find(ex)
            inside = body.rfind("{", 0, j) > body.rfind("}", 0, j)
            if inside:
                fail("gloss", f"{k}: excerpt lies inside a Quran quotation in the tafsir")
            else:
                ok("gloss", f"{k} [{chip}] <- {sb['tafsir_labels'][tid]}: verbatim")
        if len(ex) > 64:
            fail("gloss", f"{k}: excerpt too long for the tooltip ({len(ex)} chars)")
        if g.get("tone") not in TONES:
            fail("gloss", f"{k}: tone '{g.get('tone')}' must be one of {sorted(TONES)}")
        c = chapter_of.get(n)
        anchors = scene_anchors(c) if c else None
        if anchors is not None and g.get("target") and g["target"] not in anchors:
            fail("gloss", f"{k}: arrow target '{g['target']}' is not an anchor of scene '{c['scene']}' ({', '.join(sorted(anchors))}); use one of those or an empty string")
    # glosses must not pop up on top of each other
    seg_start = {}
    for t in src["recitation"]["timestamps"]:
        n = int(t["verse_key"].split(":")[1])
        for sg in t.get("segments") or []:
            seg_start.setdefault((n, sg[0]), sg[1])
    starts = sorted((seg_start.get((g["verse"], g["words"][0]), -1), g["verse"], g["words"][0]) for g in sb["glosses"])
    for (a, n1, w1), (b, n2, w2) in zip(starts, starts[1:]):
        if a >= 0 and b - a < 1000:
            fail("gloss", f"glosses at {ch}:{n1} word {w1} and {ch}:{n2} word {w2} start only {b - a} ms apart (min 1000 ms); drop one")

    # ---------- D. Resources ----------
    tr = src.get("translation_resource") or {}
    if tr.get("name") == sb["translation_expect"] and tr.get("id") == src["meta"]["translation_id"]:
        ok("resources", f"translation {tr['id']} = {tr['name']}")
    else:
        fail("resources", f"translation resource unexpected: {tr}")
    for t in src["tafsir_resources"]:
        exp = sb["tafsir_expect"].get(str(t["id"]))
        if exp and exp.lower() in (t["name"] + " " + str(t.get("slug", ""))).lower():
            ok("resources", f"tafsir {t['id']} = {t['name']} -> label '{sb['tafsir_labels'][str(t['id'])]}'")
        else:
            fail("resources", f"tafsir {t['id']} name '{t['name']}' does not match expected '{exp}'")
    for n in want:
        trs = verses[n].get("translations") or []
        if not trs or trs[0].get("resource_id") != src["meta"]["translation_id"] or not clean_translation(trs[0]["text"]):
            fail("resources", f"{ch}:{n} translation missing")
        elif "<" in clean_translation(trs[0]["text"]):
            fail("resources", f"{ch}:{n} translation has leftover markup")

    # ---------- E. Fonts ----------
    quran = set("".join(w["text_uthmani"] for v in verses.values() for w in v["words"] if w["char_type_name"] == "word")) | set("٠١٢٣٤٥٦٧٨٩")
    labels = [a.get("label") or "" for c in sb["chapters"] for a in (c.get("params") or {}).get("actors", [])]
    ui_ar = set("".join([c["title"] for c in sb["chapters"]] + [g["excerpt"] for g in sb["glosses"]] + labels +
                        list(sb["tafsir_labels"].values()) + [sb["credits"]["reciter_ar"], "إبراهيم لوط عليه السلام ملائكة سورة الآيات بصوت القارئ – · ! ؟", src["chapter"]["name_arabic"]]))
    en = set("".join(clean_translation(verses[n]["translations"][0]["text"]).upper() + clean_translation(verses[n]["translations"][0]["text"]) for n in want)
             + "".join(sb["credits"][k] for k in ("translation_en", "data_en")) + "SURAT " + src["chapter_en"]["name_simple"].upper() + " 0123456789·–—")
    cv = sb.get("cover") or {}
    cover_ar = "".join([cv.get("series_ar") or "", cv.get("title_ar") or ""])
    ui_ar |= set(cover_ar)
    en |= set("".join([cv.get("series_en") or "", cv.get("title_en") or ""]) + "".join([cv.get("series_en") or "", cv.get("title_en") or ""]).upper() + "VERSES")
    display = set("".join([c["title"] for c in sb["chapters"]]) + cover_ar + "سورة " + src["chapter"]["name_arabic"])   # Lalezar: titles, cover, outro
    sch = font_cmap("ScheherazadeNew-Regular.ttf")
    for fname, chars in (("ScheherazadeNew-Regular.ttf", quran), ("Tajawal-Bold.ttf", ui_ar), ("Tajawal-ExtraBold.ttf", ui_ar),
                         ("Lalezar-Regular.ttf", display), ("Montserrat-Medium.ttf", en), ("Montserrat-SemiBold.ttf", en)):
        cm = font_cmap(fname)
        miss = sorted(c for c in chars if not c.isspace() and ord(c) not in cm)
        if fname.startswith("Montserrat") and miss:
            # the English line is drawn with the stack "Montserrat", "Scheherazade New" (e.g. ﷺ in Saheeh International)
            fb = [c for c in miss if ord(c) in sch]
            if fb:
                info("fonts", f"{fname}: {', '.join(f'{c!r} U+{ord(c):04X}' for c in fb)} drawn with the Scheherazade New fallback (covered)")
            miss = [c for c in miss if ord(c) not in sch]
        if miss:
            fail("fonts", f"{fname} lacks {len(miss)} code points: " + ", ".join(f"{c!r} U+{ord(c):04X}" for c in miss))
        else:
            ok("fonts", f"{fname} covers all {len(chars)} code points it draws")

    return results


def main(sb_path, as_json=False):
    sb = json.loads((ROOT / sb_path).read_text(encoding="utf-8"))
    data_dir = ROOT / sb["data_dir"]
    src = json.loads((data_dir / "source.json").read_text(encoding="utf-8"))
    results = check(sb, src, data_dir)
    fails = [r for r in results if r[0] == "FAIL"]
    if as_json:   # dry run for the web app: no report file is written
        print("@@ " + json.dumps({"verify": {"passed": not fails, "results": results}}, ensure_ascii=False))
        sys.exit(1 if fails else 0)
    P = sb["passage"]; ch = P["chapter"]; want = list(range(P["from"], P["to"] + 1))
    lines = [f"# Verification report - {ch}:{want[0]}-{want[-1]}", "",
             f"Result: **{'FAILED' if fails else 'PASSED'}**  ({sum(r[0]=='PASS' for r in results)} pass, {len(fails)} fail, {sum(r[0]=='INFO' for r in results)} info)", ""]
    for area in ("text", "audio", "storyboard", "scenes", "gloss", "resources", "fonts"):
        rows = [r for r in results if r[1] == area]
        if rows:
            lines.append(f"## {area}")
            lines += [f"- {lvl}: {msg}" for lvl, _, msg in rows]
            lines.append("")
    (data_dir / "verify_report.md").write_text("\n".join(lines), encoding="utf-8")
    for lvl, area, msg in results:
        if lvl != "PASS":
            print(f"[{lvl}] {area}: {msg}")
    print(f"\n{'FAILED' if fails else 'PASSED'}: {sum(r[0]=='PASS' for r in results)} pass, {len(fails)} fail -> {data_dir / 'verify_report.md'}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    main(args[0] if args else "storyboard/15_57-77.json", as_json="--json" in sys.argv)
