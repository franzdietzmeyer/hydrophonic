import random
from collections import Counter
import pretty_midi

# ── Biological data ───────────────────────────────────────────────────────────
AA_PROPERTIES = {
    "A": {"hydrophobicity":  1.8, "mass":  89.1, "charge":  0},
    "R": {"hydrophobicity": -4.5, "mass": 174.2, "charge":  1},
    "N": {"hydrophobicity": -3.5, "mass": 132.1, "charge":  0},
    "D": {"hydrophobicity": -3.5, "mass": 133.1, "charge": -1},
    "C": {"hydrophobicity":  2.5, "mass": 121.2, "charge":  0},
    "Q": {"hydrophobicity": -3.5, "mass": 146.2, "charge":  0},
    "E": {"hydrophobicity": -3.5, "mass": 147.1, "charge": -1},
    "G": {"hydrophobicity": -0.4, "mass":  75.0, "charge":  0},
    "H": {"hydrophobicity": -3.2, "mass": 155.2, "charge":  0},
    "I": {"hydrophobicity":  4.5, "mass": 131.2, "charge":  0},
    "L": {"hydrophobicity":  3.8, "mass": 131.2, "charge":  0},
    "K": {"hydrophobicity": -3.9, "mass": 146.2, "charge":  1},
    "M": {"hydrophobicity":  1.9, "mass": 149.2, "charge":  0},
    "F": {"hydrophobicity":  2.8, "mass": 165.2, "charge":  0},
    "P": {"hydrophobicity": -1.6, "mass": 115.1, "charge":  0},
    "S": {"hydrophobicity": -0.8, "mass": 105.1, "charge":  0},
    "T": {"hydrophobicity": -0.7, "mass": 119.1, "charge":  0},
    "W": {"hydrophobicity": -0.9, "mass": 204.2, "charge":  0},
    "Y": {"hydrophobicity": -1.3, "mass": 181.2, "charge":  0},
    "V": {"hydrophobicity":  4.2, "mass": 117.1, "charge":  0},
}

# ── Scales (all rooted on A, 15 notes spanning A3–A5) ─────────────────────────
_SCALES = {
    "Classical": [57,59,60,62,64,65,67,69,71,72,74,76,77,79,81],  # A natural minor
    "Waltz":     [57,59,60,62,64,65,68,69,71,72,74,76,77,80,81],  # A harmonic minor
    "Ragtime":   [57,59,61,62,64,66,68,69,71,73,74,76,78,80,81],  # A major
    "Jazz":      [57,59,60,62,64,66,67,69,71,72,74,76,78,79,81],  # A Dorian
}
_START_IDX = 4  # all genres start at E4 (index 4 in every scale above)

# ── Velocity from secondary structure (genre-invariant biological signal) ─────
_SS_VELOCITY = {"E": 110, "H": 85, "C": 55}

# ── Genre configurations ───────────────────────────────────────────────────────
_GENRE_CFG = {
    "Classical": {"tempo": 72,  "beat": 60/72},
    "Waltz":     {"tempo": 138, "beat": 60/138},
    "Ragtime":   {"tempo": 96,  "beat": 60/96},
    "Jazz":      {"tempo": 120, "beat": 60/120},
}

# ── Classical: existing dynamic arpeggio chord vocabulary ────────────────────
_CLX_CHORDS = {
    "Am":    (45, 52, 57, 60),
    "C":     (36, 43, 48, 52),
    "F":     (41, 48, 53, 57),
    "G":     (43, 50, 55, 59),
    "Am7":   (45, 52, 55, 57),
    "Dm":    (38, 45, 50, 53),
    "Em":    (40, 47, 52, 55),
    "Bdim":  (47, 53, 59, 62),
    "Esus4": (52, 57, 59, 64),
}
_CLX_PATTERNS = {"H": [0,1,2,3], "E": [0,2,1,2], "C": [3,2,1,0]}

# ── Waltz: A harmonic minor, oom-pah-pah ──────────────────────────────────────
# (oom_pitch, (pah_note1, pah_note2))
_WALTZ_CHORDS = {
    "Am": (45, (52, 57)),   # A2 | E3 A3   → i
    "Dm": (50, (57, 62)),   # D3 | A3 D4   → iv
    "E":  (40, (52, 59)),   # E2 | E3 B3   → V (major from harmonic minor)
    "C":  (36, (55, 60)),   # C2 | G3 C4   → ♭III
    "F":  (41, (53, 57)),   # F2 | F3 A3   → ♭VI
}

# ── Ragtime: A major, stride piano ───────────────────────────────────────────
# (lo_root, lo_fifth) for beats 1&3; (hi…) 3-note chord for beats 2&4
_RAG_CHORDS = {
    "A":   {"lo": (45, 52), "hi": (52, 56, 59)},  # A2/E3 | E3 G#3 B3  → I
    "D":   {"lo": (38, 50), "hi": (50, 54, 57)},  # D2/D3 | D3 F#3 A3  → IV
    "E7":  {"lo": (40, 52), "hi": (52, 56, 59)},  # E2/E3 | E3 G#3 B3  → V7
    "F#m": {"lo": (42, 54), "hi": (54, 57, 61)},  # F#2/F#3 | F#3 A3 C#4 → vi
}

# ── Jazz: A Dorian, walking bass + swing ─────────────────────────────────────
# 4 chord tones for the walking line (root→3rd→5th→7th)
_JAZZ_CHORDS = {
    "Am7":   (45, 52, 55, 57),   # A2  E3  G3  A3
    "Dm7":   (50, 53, 57, 60),   # D3  F3  A3  C4
    "G7":    (43, 47, 50, 53),   # G2  B2  D3  F3
    "Cmaj7": (48, 52, 55, 59),   # C3  E3  G3  B3
    "Fmaj7": (41, 45, 48, 52),   # F2  A2  C3  E3
    "E7b9":  (52, 56, 59, 60),   # E3  G#3 B3  C4
}

_PEDAL_LIFT_LEAD = 0.05


# ── Chord-selection helpers ───────────────────────────────────────────────────

def _clx_chord(total_charge: int, avg_hydro: float) -> str:
    if abs(total_charge) >= 3: return "Esus4" if total_charge > 0 else "Bdim"
    if abs(total_charge) >= 1: return "Em"    if total_charge > 0 else "Dm"
    if avg_hydro > 1.5:  return "Am"
    if avg_hydro > 0.0:  return "C"
    if avg_hydro > -1.5: return "F"
    return "Am7"

def _waltz_chord(total_charge: int, avg_hydro: float) -> str:
    if abs(total_charge) >= 2: return "E"     # major V → tension
    if total_charge < 0:       return "Dm"
    if avg_hydro > 1.5:        return "Am"
    if avg_hydro > 0.0:        return "C"
    return "F"

def _rag_chord(total_charge: int, avg_hydro: float) -> str:
    if total_charge >= 2:  return "E7"
    if total_charge <= -2: return "F#m"
    if avg_hydro > 1.0:    return "A"
    if avg_hydro > -0.5:   return "D"
    return "E7"

def _jazz_chord(total_charge: int, avg_hydro: float) -> str:
    if total_charge >= 3:  return "E7b9"
    if total_charge <= -3: return "Dm7"
    if total_charge >= 1:  return "G7"
    if total_charge <= -1: return "Am7"
    if avg_hydro > 1.0:    return "Am7"
    if avg_hydro > 0.0:    return "Cmaj7"
    if avg_hydro > -1.0:   return "Fmaj7"
    return "Am7"


# ── Right-hand timing per genre ───────────────────────────────────────────────

def _rh_params(ss: str, genre: str, note_idx: int, beat: float) -> tuple:
    """Return (step_dur, note_dur, time_offset) for one melody note."""
    if genre == "Classical":
        tbl = {"E": (0.25, 0.15, 0.0), "H": (0.40, 0.65, 0.0), "C": (0.40, 0.38, 0.0)}
        return tbl.get(ss, tbl["C"])

    if genre == "Waltz":
        note_dur = {"E": 0.12, "H": beat * 0.92, "C": beat * 0.72}.get(ss, beat * 0.72)
        return beat, note_dur, 0.0

    if genre == "Ragtime":
        eighth = beat / 2
        note_dur = {"E": 0.08, "H": eighth * 0.85, "C": eighth * 0.62}.get(ss, eighth * 0.62)
        # Syncopation: odd-indexed melody notes arrive one 16th late
        offset = eighth * 0.45 if note_idx % 2 == 1 else 0.0
        return eighth, note_dur, offset

    if genre == "Jazz":
        # Swing: even notes 2/3 beat, odd notes 1/3 beat
        if note_idx % 2 == 0:
            note_dur = {"E": 0.12, "H": 0.30, "C": 0.22}.get(ss, 0.22)
            return beat * (2/3), note_dur, 0.0
        else:
            note_dur = {"E": 0.08, "H": 0.14, "C": 0.11}.get(ss, 0.11)
            return beat * (1/3), note_dur, 0.0

    return 0.40, 0.35, 0.0


# ── Humanization ─────────────────────────────────────────────────────────────

def humanize(t: float, v: int, t_j: float = 0.018, v_j: int = 5) -> tuple:
    return (
        t + random.uniform(-t_j, t_j),
        max(1, min(127, v + random.randint(-v_j, v_j))),
    )


# ── Left-hand generators ──────────────────────────────────────────────────────

def _pedal(piano, chunk_start: float, chunk_end: float):
    piano.control_changes.append(
        pretty_midi.ControlChange(64, 127, max(0.0, chunk_start - 0.01))
    )
    lift = max(chunk_start + 0.01, chunk_end - _PEDAL_LIFT_LEAD)
    piano.control_changes.append(pretty_midi.ControlChange(64, 0,   lift))
    piano.control_changes.append(pretty_midi.ControlChange(64, 127, lift + 0.01))


def _lh_classical(piano, pairs, note_times):
    chunk_size = 4
    for i in range(0, len(pairs), chunk_size):
        chunk = pairs[i:i+chunk_size]
        props   = [p for p, _ in chunk]
        ss_list = [s for _, s in chunk]

        dominant_ss  = Counter(ss_list).most_common(1)[0][0]
        pattern      = _CLX_PATTERNS.get(dominant_ss, _CLX_PATTERNS["C"])
        avg_mass     = sum(p["mass"] for p in props) / len(props)
        arp_step     = 0.10 if avg_mass < 110 else (0.20 if avg_mass < 155 else 0.40)
        total_charge = sum(p["charge"]         for p in props)
        avg_hydro    = sum(p["hydrophobicity"] for p in props) / len(props)
        chord        = _CLX_CHORDS[_clx_chord(total_charge, avg_hydro)]

        chunk_start = note_times[i][0]
        last_idx    = min(i + chunk_size - 1, len(note_times) - 1)
        chunk_end   = note_times[last_idx][0] + note_times[last_idx][1]
        _pedal(piano, chunk_start, chunk_end)

        t_arp, step = chunk_start, 0
        while t_arp < chunk_end - arp_step * 0.5:
            pitch = chord[pattern[step % len(pattern)]]
            h_s, h_v = humanize(t_arp, 52)
            h_e = max(h_s + 0.05, min(chunk_end - 0.01, h_s + (chunk_end - t_arp)))
            piano.notes.append(pretty_midi.Note(h_v, pitch, h_s, h_e))
            t_arp += arp_step
            step  += 1


def _lh_waltz(piano, pairs, note_times, beat: float):
    chunk_size = 3
    for i in range(0, len(pairs), chunk_size):
        chunk = pairs[i:i+chunk_size]
        props        = [p for p, _ in chunk]
        total_charge = sum(p["charge"]         for p in props)
        avg_hydro    = sum(p["hydrophobicity"] for p in props) / len(props)
        oom, pah     = _WALTZ_CHORDS[_waltz_chord(total_charge, avg_hydro)]

        chunk_start = note_times[i][0]
        last_idx    = min(i + chunk_size - 1, len(note_times) - 1)
        chunk_end   = note_times[last_idx][0] + note_times[last_idx][1]
        _pedal(piano, chunk_start, chunk_end)

        # Beat 1 — Oom (low bass note, nearly full beat)
        h_s, h_v = humanize(chunk_start, 70)
        piano.notes.append(pretty_midi.Note(h_v, oom, h_s, h_s + beat * 0.85))

        # Beats 2 & 3 — Pah (2-note mid chord, short)
        for beat_offset in (1, 2):
            idx = i + beat_offset
            if idx >= len(note_times):
                break
            t_pah = note_times[idx][0]
            h_s2, h_v2 = humanize(t_pah, 50)
            for pitch in pah:
                piano.notes.append(pretty_midi.Note(h_v2, pitch, h_s2, h_s2 + beat * 0.44))


def _lh_ragtime(piano, pairs, note_times, beat: float):
    # Stride: Lo-Hi-Lo(5th)-Hi across 4 8th-note slots per chunk
    eighth = beat / 2
    chunk_size = 4
    for i in range(0, len(pairs), chunk_size):
        chunk = pairs[i:i+chunk_size]
        props        = [p for p, _ in chunk]
        total_charge = sum(p["charge"]         for p in props)
        avg_hydro    = sum(p["hydrophobicity"] for p in props) / len(props)
        cd           = _RAG_CHORDS[_rag_chord(total_charge, avg_hydro)]
        lo_root, lo_fifth = cd["lo"]
        hi            = cd["hi"]

        chunk_start = note_times[i][0]
        last_idx    = min(i + chunk_size - 1, len(note_times) - 1)
        chunk_end   = note_times[last_idx][0] + note_times[last_idx][1]
        _pedal(piano, chunk_start, chunk_end)

        stride = [
            (0, "lo", lo_root,  68, eighth * 0.30),  # beat 1: low root
            (1, "hi", hi,       60, eighth * 0.35),  # beat 1+: chord
            (2, "lo", lo_fifth, 65, eighth * 0.30),  # beat 2: low 5th
            (3, "hi", hi,       58, eighth * 0.35),  # beat 2+: chord
        ]
        for k, kind, pitches_or_pitch, vel_base, dur in stride:
            idx = i + k
            if idx >= len(note_times):
                break
            t_ev = note_times[idx][0]
            if kind == "lo":
                h_s, h_v = humanize(t_ev, vel_base)
                piano.notes.append(pretty_midi.Note(h_v, pitches_or_pitch, h_s, h_s + dur))
            else:
                h_s, h_v = humanize(t_ev, vel_base)
                for pitch in pitches_or_pitch:
                    piano.notes.append(pretty_midi.Note(h_v, pitch, h_s, h_s + dur))


def _lh_jazz(piano, pairs, note_times):
    # Walking bass: one chord tone per melody note, cycling root→3rd→5th→7th
    chunk_size = 4
    for i in range(0, len(pairs), chunk_size):
        chunk = pairs[i:i+chunk_size]
        props        = [p for p, _ in chunk]
        total_charge = sum(p["charge"]         for p in props)
        avg_hydro    = sum(p["hydrophobicity"] for p in props) / len(props)
        chord_tones  = _JAZZ_CHORDS[_jazz_chord(total_charge, avg_hydro)]

        chunk_start = note_times[i][0]
        last_idx    = min(i + chunk_size - 1, len(note_times) - 1)
        chunk_end   = note_times[last_idx][0] + note_times[last_idx][1]
        _pedal(piano, chunk_start, chunk_end)

        for k in range(min(chunk_size, len(pairs) - i)):
            idx = i + k
            if idx >= len(note_times):
                break
            t_walk   = note_times[idx][0]
            step_dur = note_times[idx][1]
            pitch    = chord_tones[k % len(chord_tones)]
            h_s, h_v = humanize(t_walk, 60)
            h_e      = max(h_s + 0.05, h_s + step_dur * 0.90)
            piano.notes.append(pretty_midi.Note(h_v, pitch, h_s, h_e))


# ── Public API ────────────────────────────────────────────────────────────────

def sequence_to_midi(
    sequence:      str,
    sec_structure: str  = "",
    genre:         str  = "Classical",
    output_path:   str  = "melody.mid",
) -> str:
    random.seed(42)
    cfg   = _GENRE_CFG.get(genre, _GENRE_CFG["Classical"])
    scale = _SCALES.get(genre, _SCALES["Classical"])
    beat  = cfg["beat"]

    pm    = pretty_midi.PrettyMIDI(initial_tempo=cfg["tempo"])
    piano = pretty_midi.Instrument(program=0, name="Acoustic Grand Piano")

    if not sec_structure or len(sec_structure) != len(sequence):
        sec_structure = "C" * len(sequence)

    pairs = [
        (AA_PROPERTIES[aa], ss)
        for aa, ss in zip(sequence, sec_structure)
        if aa in AA_PROPERTIES
    ]

    # ── Right hand ──────────────────────────────────────────────────────────
    scale_idx = _START_IDX
    t         = 0.0
    note_times = []   # (grid_start, step_dur) — left hand uses this for alignment

    for note_idx, (props, ss) in enumerate(pairs):
        h = props["hydrophobicity"]
        if h > 0.5:    scale_idx -= 1   # hydrophobic → descend
        elif h < -0.5: scale_idx += 1   # hydrophilic → ascend
        scale_idx = max(0, min(scale_idx, len(scale) - 1))

        step_dur, note_dur, t_offset = _rh_params(ss, genre, note_idx, beat)
        vel_base  = _SS_VELOCITY.get(ss, 55)
        pitch     = scale[scale_idx]

        h_s, h_v = humanize(t + t_offset, vel_base)
        h_e = max(h_s + 0.05, h_s + note_dur + random.uniform(-0.01, 0.01))
        piano.notes.append(pretty_midi.Note(h_v, pitch, h_s, h_e))

        note_times.append((t, step_dur))
        t += step_dur

    # ── Left hand ────────────────────────────────────────────────────────────
    if   genre == "Classical": _lh_classical(piano, pairs, note_times)
    elif genre == "Waltz":     _lh_waltz(piano, pairs, note_times, beat)
    elif genre == "Ragtime":   _lh_ragtime(piano, pairs, note_times, beat)
    elif genre == "Jazz":      _lh_jazz(piano, pairs, note_times)

    # Final pedal release
    if note_times:
        piano.control_changes.append(
            pretty_midi.ControlChange(64, 0, note_times[-1][0] + note_times[-1][1] + 0.5)
        )

    pm.instruments.append(piano)
    pm.write(output_path)
    return output_path


def midi_to_wav(midi_path: str, soundfont_path: str, output_path: str = "output.wav") -> str:
    import subprocess
    result = subprocess.run(
        ["fluidsynth", "-ni", "-F", output_path, "-r", "44100", soundfont_path, midi_path],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"fluidsynth failed: {result.stderr}")
    return output_path
