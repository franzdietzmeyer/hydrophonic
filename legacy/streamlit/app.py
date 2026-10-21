import streamlit as st
import py3Dmol
from stmol import showmol
import tempfile
import os
from Bio.PDB import PDBList, MMCIFParser
from Bio.PDB.MMCIF2Dict import MMCIF2Dict
from Bio.SeqUtils import seq1
from music_engine import sequence_to_midi, midi_to_wav

SOUNDFONT = os.path.join(os.path.dirname(__file__), "soundfont.sf2")
MIDI_PATH = os.path.join(os.path.dirname(__file__), "melody.mid")
WAV_PATH = os.path.join(os.path.dirname(__file__), "output.wav")

st.set_page_config(
    page_title="MidiFasta – Protein Music",
    layout="wide",
    page_icon="🎵",
)

st.title("MidiFasta – Protein Structures as Music")
st.markdown(
    "Every protein has a unique amino-acid sequence. "
    "This app translates that sequence into playable music: "
    "**secondary structure** drives the instrument, "
    "**hydrophobicity** drives the melody direction, "
    "**mass** drives note speed, and **charge** drives volume. "
    "Paste a [PDB ID](https://www.rcsb.org/) below and press *Generate*."
)

_GENRE_DESCRIPTIONS = {
    "Classical": "Dynamic arpeggios · A natural minor · 72 BPM",
    "Waltz":     "Oom-pah-pah · A harmonic minor · 138 BPM · 3/4",
    "Ragtime":   "Stride piano · A major · 96 BPM · syncopated",
    "Jazz":      "Walking bass · A Dorian · 120 BPM · swing",
}

with st.sidebar:
    st.header("Settings")
    pdb_id = st.text_input("PDB ID", value="1A2C").strip().upper()
    genre = st.selectbox("Genre", list(_GENRE_DESCRIPTIONS.keys()), index=0)
    st.caption(_GENRE_DESCRIPTIONS[genre])
    generate = st.button("Generate", type="primary", use_container_width=True)

    st.divider()
    st.subheader("Sonification Legend")
    st.markdown("**Solo Acoustic Piano** — all melody and bass on one instrument")
    st.markdown(
        "<span style='color:#3498db'>**■ Beta-Sheet (E)**</span> — Loud, short, punchy (Staccato)",
        unsafe_allow_html=True,
    )
    st.caption("velocity 110 · note duration 0.15 s")
    st.markdown(
        "<span style='color:#e74c3c'>**■ Alpha-Helix (H)**</span> — Smooth, flowing, sustained (Legato)",
        unsafe_allow_html=True,
    )
    st.caption("velocity 85 · note duration 0.65 s (overlaps next note)")
    st.markdown(
        "<span style='color:#95a5a6'>**■ Random Coil (C)**</span> — Soft, delicate",
        unsafe_allow_html=True,
    )
    st.caption("velocity 55 · note duration 0.38 s")
    st.divider()
    st.caption("**Pitch**: hydrophobic AAs step down; hydrophilic step up (A-minor scale)")
    st.caption("**Left hand**: single bass note every 4 residues, pitch = avg. hydrophobicity")


def _build_ss_map(mmcif: dict, target_label_asym: str) -> dict[int, str]:
    """Build {label_seq_id -> 'H'|'E'} from _struct_conf and _struct_sheet_range."""
    ss_map: dict[int, str] = {}

    conf_types  = mmcif.get("_struct_conf.conf_type_id", [])
    conf_beg    = mmcif.get("_struct_conf.beg_label_seq_id", [])
    conf_end    = mmcif.get("_struct_conf.end_label_seq_id", [])
    conf_chain  = mmcif.get("_struct_conf.beg_label_asym_id", [])
    for ctype, beg, end, ch in zip(conf_types, conf_beg, conf_end, conf_chain):
        if ch == target_label_asym and "HELX" in ctype:
            for i in range(int(beg), int(end) + 1):
                ss_map[i] = "H"

    sheet_beg   = mmcif.get("_struct_sheet_range.beg_label_seq_id", [])
    sheet_end   = mmcif.get("_struct_sheet_range.end_label_seq_id", [])
    sheet_chain = mmcif.get("_struct_sheet_range.beg_label_asym_id", [])
    for beg, end, ch in zip(sheet_beg, sheet_end, sheet_chain):
        if ch == target_label_asym:
            for i in range(int(beg), int(end) + 1):
                ss_map[i] = "E"

    return ss_map


def get_protein_data(pdb_id: str) -> tuple[str, str, str]:
    """Return (amino_acid_sequence, secondary_structure_string, chain_id).

    Secondary structure uses: H = alpha-helix, E = beta-sheet, C = coil/loop.
    Both strings are the same length and aligned residue-by-residue.
    """
    tmpdir = tempfile.mkdtemp()
    pdbl = PDBList(verbose=False)
    cif_path = pdbl.retrieve_pdb_file(pdb_id, file_format="mmCif", pdir=tmpdir)
    if not os.path.exists(cif_path):
        raise ValueError(f"PDB entry '{pdb_id}' not found.")

    # Parse 3-D structure for residues
    parser = MMCIFParser(QUIET=True)
    structure = parser.get_structure(pdb_id, cif_path)
    model = structure[0]
    chain_ids = [c.get_id() for c in model]
    if not chain_ids:
        raise ValueError(f"No chains found in {pdb_id}.")
    chain_id = "A" if "A" in chain_ids else chain_ids[0]
    residues = [r for r in model[chain_id].get_residues() if r.get_id()[0] == " "]
    sequence = "".join(seq1(r.get_resname()) for r in residues)
    if not sequence:
        raise ValueError(f"No amino-acid residues in chain {chain_id} of {pdb_id}.")

    # Parse raw MMCIF dict to extract secondary structure
    mmcif = MMCIF2Dict(cif_path)

    # Build (auth_asym_id, auth_seq_id) -> label_seq_id from _atom_site
    atom_auth_asym  = mmcif.get("_atom_site.auth_asym_id", [])
    atom_auth_seq   = mmcif.get("_atom_site.auth_seq_id", [])
    atom_label_asym = mmcif.get("_atom_site.label_asym_id", [])
    atom_label_seq  = mmcif.get("_atom_site.label_seq_id", [])
    atom_group      = mmcif.get("_atom_site.group_PDB", [])

    auth_to_label_asym: dict[str, str] = {}
    auth_seq_to_label_seq: dict[tuple, str] = {}
    for aa, aseq, la, ls, grp in zip(
        atom_auth_asym, atom_auth_seq, atom_label_asym, atom_label_seq, atom_group
    ):
        if grp == "ATOM":
            auth_to_label_asym[aa] = la
            auth_seq_to_label_seq[(aa, aseq)] = ls

    target_label_asym = auth_to_label_asym.get(chain_id, "")
    ss_map = _build_ss_map(mmcif, target_label_asym)

    # Align SS to residue sequence
    ss_chars = []
    for r in residues:
        auth_seq_id = str(r.get_id()[1])
        label_seq_id_str = auth_seq_to_label_seq.get((chain_id, auth_seq_id))
        if label_seq_id_str is not None:
            ss = ss_map.get(int(label_seq_id_str), "C")
        else:
            ss = "C"
        ss_chars.append(ss)
    sec_structure = "".join(ss_chars)

    try:
        os.remove(cif_path)
    except OSError:
        pass

    return sequence, sec_structure, chain_id


def render_protein_3d(pdb_id: str):
    viewer = py3Dmol.view(query=f"pdb:{pdb_id}", width=680, height=480)
    viewer.setStyle({"cartoon": {"colorscheme": "ssJmol"}})
    viewer.zoomTo()
    showmol(viewer, height=480, width=680)


_SS_COLORS = {"H": "#e74c3c", "E": "#3498db", "C": "#95a5a6"}
_SS_LABELS = {"H": "Helix", "E": "Sheet", "C": "Coil"}


def _render_ss_annotation(sequence: str, sec_structure: str):
    """Render a color-coded sequence where each AA is colored by its SS type."""
    spans = []
    for aa, ss in zip(sequence, sec_structure):
        color = _SS_COLORS.get(ss, "#95a5a6")
        spans.append(f"<span style='color:{color};font-family:monospace'>{aa}</span>")
    # wrap at 60 chars with line breaks
    chunk = 60
    lines = []
    for i in range(0, len(spans), chunk):
        lines.append("".join(spans[i : i + chunk]))
    st.markdown("<br>".join(lines), unsafe_allow_html=True)

    # summary counts
    h = sec_structure.count("H")
    e = sec_structure.count("E")
    c = sec_structure.count("C")
    st.caption(
        f"<span style='color:#e74c3c'>■ Helix {h}</span>  "
        f"<span style='color:#3498db'>■ Sheet {e}</span>  "
        f"<span style='color:#95a5a6'>■ Coil {c}</span>",
        unsafe_allow_html=True,
    )


if not generate:
    st.info("Enter a PDB ID in the sidebar and press **Generate** to start.")
else:
    col_vis, col_audio = st.columns([1, 1])

    with col_vis:
        st.subheader(f"3D Structure — {pdb_id}")
        try:
            render_protein_3d(pdb_id)
        except Exception as e:
            st.error(f"Could not render structure for **{pdb_id}**: {e}")

    with col_audio:
        st.subheader("Sequence & Music")
        try:
            with st.spinner("Downloading structure, extracting sequence & secondary structure…"):
                sequence, sec_structure, chain_id = get_protein_data(pdb_id)

            st.success(f"Chain **{chain_id}** — {len(sequence)} residues")

            with st.expander("Annotated sequence (color = secondary structure)"):
                _render_ss_annotation(sequence, sec_structure)

            st.info(f"Genre: **{genre}** — {_GENRE_DESCRIPTIONS[genre]}")

            with st.spinner("Composing MIDI melody…"):
                sequence_to_midi(sequence, sec_structure, genre=genre, output_path=MIDI_PATH)

            with st.spinner("Synthesizing audio (fluidsynth)…"):
                midi_to_wav(MIDI_PATH, SOUNDFONT, output_path=WAV_PATH)

            with open(WAV_PATH, "rb") as f:
                audio_bytes = f.read()

            st.audio(audio_bytes, format="audio/wav")

            for path in (MIDI_PATH, WAV_PATH):
                try:
                    os.remove(path)
                except OSError:
                    pass

        except ValueError as e:
            st.error(str(e))
        except Exception as e:
            st.error(f"Unexpected error processing **{pdb_id}**: {e}")
