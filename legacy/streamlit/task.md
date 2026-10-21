You are building a Python-based Streamlit web application that translates protein structures (PDB files) into playable music and interactive 3D visualizations. The app will fetch PDB data, extract the amino acid sequence, translate the sequence's biological properties into MIDI music (using specific constraints to keep it melodic), synthesize the MIDI to WAV, and display a 3D model.
Execution Rules:
Do not write the entire application at once.
Execute this plan step-by-step.
Perform the "Sanity Check" at the end of each step and wait for user confirmation before proceeding to the next step.
Step 1: Environment Setup & Core Dependencies
Initialize a new Python environment (e.g., venv) and activate it.
Install the necessary Python packages: streamlit, stmol, py3Dmol, biopython, pretty_midi, scipy, numpy.
Crucial System Dependency: Audio synthesis requires fluidsynth. Check if it is installed on the system (e.g., via brew install fluidsynth on macOS or apt-get install fluidsynth on Linux). Request user action if it is missing.
Download a basic SoundFont file (e.g., GeneralUser GS.sf2) using wget or curl and place it in the project root. This is required for fluidsynth to synthesize audio.
Sanity Check 1: Verify that fluidsynth is accessible via the command line and all pip dependencies are installed.
Step 2: Streamlit UI Scaffolding
Create an app.py file.
Build the basic Streamlit layout:
Set page config (wide layout, custom title).
Add a header and a brief description of the science communication concept.
Create a sidebar or main container with a text input field for a PDB ID (default to "1A2C") and a "Generate" button.
Sanity Check 2: Run streamlit run app.py. Does the basic UI load without errors?
Step 3: 3D Protein Visualization (stmol)
In app.py, integrate stmol to visualize the PDB ID entered by the user.
Create a function render_protein_3d(pdb_id) that fetches the PDB and uses py3Dmol to render a cartoon representation colored by secondary structure.
Display the viewer in the Streamlit app using stmol.showmol().
Sanity Check 3: Enter PDB ID "1A2C" in the running app. Does a 3D, interactively rotatable protein structure appear?
Step 4: Biological Data Extraction (Biopython)
Create a function get_protein_sequence(pdb_id) using Bio.PDB.PDBList and Bio.PDB.PDBParser.
Download the PDB file temporarily, parse the structure, and extract the primary amino acid sequence (1-letter codes) for Chain A.
Display the raw sequence string in an st.expander in the Streamlit app.
Sanity Check 4: Does the app successfully download the PDB, extract the sequence, and print a string like "IVGGYTCG..." to the UI?
Step 5: The Translation Matrix (Sequence to MIDI logic)
Create a music_engine.py file. Define a dictionary that maps all 20 standard amino acids to their biological properties: Hydrophobicity index, Molecular Mass, and Charge (+1, -1, 0).
Write a function sequence_to_midi(sequence) using pretty_midi.
The Musical Logic Rules:
Scale: Use a C-Major Pentatonic scale (C, D, E, G, A) spanning 2-3 octaves to ensure melody remains harmonious.
Pitch (Hydrophobicity): Sort the scale from lowest note to highest note. Map highly hydrophilic AAs to the highest notes, and highly hydrophobic AAs to the lowest notes.
Duration (Mass): Small AAs (e.g., Glycine) = 0.125 seconds (fast). Large AAs (e.g., Tryptophan) = 0.5 seconds (slow).
Velocity/Volume (Charge): Charged AAs (R, K, D, E) = Velocity 110 (loud). Neutral/Uncharged = Velocity 70 (soft).
Save the generated sequence to a temporary melody.mid file.
Sanity Check 5: Pass a test sequence. Does a melody.mid file successfully generate without crashing?
Step 6: The Backing Track & Audio Synthesis
In music_engine.py, add a function to generate a simple repeating 4/4 bassline or kick drum pulse matching the tempo of the sequence. Append this track to the pretty_midi object before saving.
Write a function midi_to_wav(midi_path, soundfont_path) that uses Python's subprocess to call fluidsynth via command line:
fluidsynth -ni [soundfont_path] [midi_path] -F output.wav -r 44100
In app.py, link the "Generate" button to: fetch sequence -> generate MIDI -> synthesize to WAV.
Pass the resulting WAV file to Streamlit's st.audio(wav_file, format="audio/wav").
Sanity Check 6: Press "Generate" in the app. Does it process the data and present a playable audio player that outputs music?
Step 7: Sci-Comm UI Polish
Add a "Legend" section using st.columns that explains the sonification rules to the user (e.g., "Deep notes = Hydrophobic, Fast notes = Small mass").
Add error handling (e.g., try/except blocks if a user enters an invalid PDB ID).
Ensure temporary files (.cif, .mid, .wav) are cleaned up/overwritten cleanly during each run so the server doesn't bloat.
Sanity Check 7: Final code review and test of the complete user experience.
