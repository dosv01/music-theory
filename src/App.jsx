import { useState, useMemo, useEffect } from "react";

/* ---------- dados musicais ---------- */
const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

const MAJOR_INTERVALS = [0,2,4,5,7,9,11];
const MINOR_INTERVALS = [0,2,3,5,7,8,10];

const PENTA_MAJOR_INTERVALS = [0, 2, 4, 7, 9];
const PENTA_MINOR_INTERVALS = [0, 3, 5, 7, 10];

const MAJOR_TRIAD_Q  = ["maj","min","min","maj","maj","min","dim"];
const MAJOR_ROMAN    = ["I","ii","iii","IV","V","vi","vii°"];
const MAJOR_7TH_Q    = ["maj7","m7","m7","maj7","7","m7","m7b5"];

const MINOR_TRIAD_Q  = ["min","dim","maj","min","min","maj","maj"];
const MINOR_ROMAN    = ["i","ii°","III","iv","v","VI","VII"];
const MINOR_7TH_Q    = ["m7","m7b5","maj7","m7","m7","maj7","7"];

const MODES = [
  { name: "Jônio",      sub: "(Maior)",        intervals: [0,2,4,5,7,9,11] },
  { name: "Dórico",     sub: "",               intervals: [0,2,3,5,7,9,10] },
  { name: "Frígio",     sub: "",               intervals: [0,1,3,5,7,8,10] },
  { name: "Lídio",      sub: "",               intervals: [0,2,4,6,7,9,11] },
  { name: "Mixolídio",  sub: "",               intervals: [0,2,4,5,7,9,10] },
  { name: "Eólio",      sub: "(Menor natural)",intervals: [0,2,3,5,7,8,10] },
  { name: "Lócrio",     sub: "",               intervals: [0,1,3,5,6,8,10] },
];

const TUNING = [
  { label: "E", idx: 4 },
  { label: "A", idx: 9 },
  { label: "D", idx: 2 },
  { label: "G", idx: 7 },
  { label: "B", idx: 11 },
  { label: "E", idx: 4 },
];
const STRINGS_TOP_TO_BOTTOM = [...TUNING].reverse();
const LOW_E_CLASS = TUNING[0].idx;

/* ---------- funções geradoras ---------- */
function buildShapeFromSequence(targetClassFn) {
  let n = 0;
  let prevLast = null;
  return TUNING.map((str) => {
    const t0 = targetClassFn(n), t1 = targetClassFn(n + 1), t2 = targetClassFn(n + 2);
    n += 3;
    const raw = (t) => (t - str.idx + 12) % 12;
    let f0 = raw(t0);
    if (prevLast !== null) {
      while (prevLast - f0 > 7) f0 += 12;
    }
    let f1 = raw(t1);
    if (f1 <= f0) f1 += 12;
    let f2 = raw(t2);
    if (f2 <= f1) f2 += 12;
    prevLast = f2;
    return [f0, f1, f2];
  });
}

function avoidOpenString(shape) {
  const min = Math.min(...shape.flat());
  if (min <= 0) {
    const shift = 12 - min;
    return shape.map((frets) => frets.map((f) => f + shift));
  }
  return shape;
}

function buildRelativeShapes(root) {
  const rawAnchors = MAJOR_INTERVALS.map(
    (iv) => ((root + iv) % 12 - LOW_E_CLASS + 12) % 12
  );
  const shift = new Array(7).fill(0);
  for (let i = 1; i <= 5; i++) {
    let a = rawAnchors[i];
    while (a <= rawAnchors[i - 1] + shift[i - 1]) a += 12;
    shift[i] = a - rawAnchors[i];
  }
  return MODES.map((m, i) => {
    const seq = (n) => (root + MAJOR_INTERVALS[(i + n) % 7]) % 12;
    const shape = avoidOpenString(
      buildShapeFromSequence(seq).map((frets) => frets.map((f) => f + shift[i]))
    );
    return { modeRoot: (root + MAJOR_INTERVALS[i]) % 12, shapeLowToHigh: shape };
  });
}

function buildParallelShapes(root) {
  return MODES.map((m) => {
    const seq = (n) => (root + m.intervals[n % 7]) % 12;
    const shape = avoidOpenString(buildShapeFromSequence(seq));
    return { modeRoot: root, shapeLowToHigh: shape };
  });
}

// NOVO: Algoritmo para gerar as 5 caixas (2 notas por corda) da Pentatônica
function buildPentaBoxes(root, isMinor = false) {
  const intervals = isMinor ? PENTA_MINOR_INTERVALS : PENTA_MAJOR_INTERVALS;
  const scaleNotes = intervals.map(iv => (root + iv) % 12);
  
  // Encontra as 5 posições de início na corda Mizona
  const lowE_frets = scaleNotes.map(noteClass => (noteClass - TUNING[0].idx + 12) % 12);
  const sortedLowE = [...lowE_frets].sort((a,b) => a-b);

  const boxes = sortedLowE.map(startFret => {
    const actualStart = startFret === 0 ? 12 : startFret; // Joga a corda solta pra casa 12
    const shape = TUNING.map(str => {
      let validFrets = [];
      // Janela de busca de 5 casas (padrão de abertura de dedos)
      for(let f = actualStart - 1; f <= actualStart + 4; f++) {
         if(f >= 0 && scaleNotes.includes((str.idx + f) % 12)) {
             validFrets.push(f);
         }
      }
      return validFrets.slice(0, 2); // Garante 2 notas por corda
    });
    return { shapeLowToHigh: shape };
  });
  
  // Ordena as caixas pela posição no braço
  return boxes.sort((a,b) => Math.min(...a.shapeLowToHigh.flat()) - Math.min(...b.shapeLowToHigh.flat()));
}

// NOVO: Mapeia todas as notas de um acorde no braço até a casa 15 (Base do CAGED)
function buildChordMap(chordNoteClasses) {
  return TUNING.map(str => {
      const frets = [];
      for (let f = 0; f <= 15; f++) {
          if (chordNoteClasses.includes((str.idx + f) % 12)) {
              frets.push(f);
          }
      }
      return frets;
  });
}

function qualitySuffix(q) {
  return { maj: "", min: "m", dim: "dim", maj7: "maj7", m7: "m7", "7": "7", m7b5: "m7b5" }[q] ?? "";
}

function buildField(rootIdx, intervals, triadQ, romans, seventhQ) {
  const scaleIdx = intervals.map((iv) => (rootIdx + iv) % 12);
  return scaleIdx.map((_, i) => {
    const triadPos = [i, (i + 2) % 7, (i + 4) % 7];
    const seventhPos = [i, (i + 2) % 7, (i + 4) % 7, (i + 6) % 7];
    const rootNote = NOTES[scaleIdx[i]];
    return {
      roman: romans[i],
      chordRootIdx: scaleIdx[i],
      triadName: rootNote + qualitySuffix(triadQ[i]),
      triadNotesClasses: triadPos.map((p) => scaleIdx[p]),
      triadNotes: triadPos.map((p) => NOTES[scaleIdx[p]]),
      seventhName: rootNote + qualitySuffix(seventhQ[i]),
      seventhNotesClasses: seventhPos.map((p) => scaleIdx[p]),
      seventhNotes: seventhPos.map((p) => NOTES[scaleIdx[p]]),
    };
  });
}

/* ---------- componente ---------- */
export default function CampoHarmonicoModos() {
  const [root, setRoot] = useState(0);
  
  // Modos Gregos State
  const [system, setSystem] = useState("parallel"); 
  const [modeIndex, setModeIndex] = useState(0);
  const [octaveNudge, setOctaveNudge] = useState(0);

  // Pentatônicas State
  const [pentaType, setPentaType] = useState("minor"); // 'major' | 'minor'
  const [pentaBoxIdx, setPentaBoxIdx] = useState(0);

  // Acordes / CAGED State
  const [selectedChord, setSelectedChord] = useState(null);

  const [visitCount, setVisitCount] = useState(null);

  useEffect(() => {
    fetch("https://countapi.mileshilliard.com/api/v1/hit/music-theory")
      .then((r) => r.json())
      .then((data) => {
        setVisitCount(data.value);
        console.log(
          "%c🎸 acessos ao Campo Harmônico & Modos: %c" + data.value,
          "color:#7C7462;font-family:monospace",
          "color:#C9A227;font-family:monospace;font-weight:bold;font-size:13px"
        );
      })
      .catch(() => {
        console.log("%c[debug] contador de acessos indisponível", "color:#7C7462");
      });
  }, []);

  const rootName = NOTES[root];

  const majorField = useMemo(
    () => buildField(root, MAJOR_INTERVALS, MAJOR_TRIAD_Q, MAJOR_ROMAN, MAJOR_7TH_Q),
    [root]
  );
  const minorField = useMemo(
    () => buildField(root, MINOR_INTERVALS, MINOR_TRIAD_Q, MINOR_ROMAN, MINOR_7TH_Q),
    [root]
  );

  // Lógica Modos Gregos
  const allShapes = useMemo(
    () => (system === "parallel" ? buildParallelShapes(root) : buildRelativeShapes(root)),
    [system, root]
  );
  const mode = MODES[modeIndex];
  const { modeRoot, shapeLowToHigh } = allShapes[modeIndex];
  const modeNoteNames = mode.intervals.map((iv) => NOTES[(modeRoot + iv) % 12]);
  const shapeByString = useMemo(
    () => [...shapeLowToHigh].reverse().map((frets) => frets.map((f) => f + octaveNudge)),
    [shapeLowToHigh, octaveNudge]
  );
  const allShapeFrets = shapeByString.flat();
  const minFret = Math.min(...allShapeFrets);
  const maxFret = Math.max(...allShapeFrets);
  const frets = Array.from({ length: maxFret - minFret + 1 }, (_, i) => minFret + i);
  const inlayFrets = new Set([3, 5, 7, 9, 12, 15]);

  // Lógica Pentatônicas
  const pentaBoxes = useMemo(() => buildPentaBoxes(root, pentaType === "minor"), [root, pentaType]);
  const activePentaShape = [...pentaBoxes[pentaBoxIdx].shapeLowToHigh].reverse();
  const allPentaFrets = activePentaShape.flat();
  const minPentaFret = Math.min(...allPentaFrets);
  const maxPentaFret = Math.max(...allPentaFrets);
  const pentaFretArray = Array.from({ length: maxPentaFret - minPentaFret + 1 }, (_, i) => minPentaFret + i);

  // Lógica Diagrama de Acorde (CAGED)
  const chordShape = useMemo(() => {
      if(!selectedChord) return null;
      return [...buildChordMap(selectedChord.notesClasses)].reverse();
  }, [selectedChord]);

  // Limpa o acorde selecionado quando a tônica principal muda
  useEffect(() => { setSelectedChord(null); }, [root]);

  return (
    <div className="wrap">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Spectral:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500&display=swap');

        * { box-sizing: border-box; }
        .wrap {
          background: #15120D;
          color: #EDE6D6;
          font-family: 'Inter', system-ui, sans-serif;
          padding: 0;
          min-height: 100%;
          border-radius: 10px;
          overflow: hidden;
        }
        .hero {
          position: relative;
          padding: 36px 28px 26px;
          background:
            repeating-linear-gradient(
              to bottom,
              transparent 0px, transparent 17px,
              rgba(237,230,214,0.10) 17px, rgba(237,230,214,0.10) 18px
            );
          background-position: 0 14px;
          background-size: 100% 90px;
          border-bottom: 1px solid #3A3226;
        }
        .eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #C9A227;
          margin: 0 0 8px;
        }
        h1 {
          font-family: 'Spectral', serif;
          font-weight: 700;
          font-size: 30px;
          margin: 0 0 6px;
          color: #F4EEDD;
        }
        .hero p.desc { margin: 0; color: #A99C86; font-size: 14px; max-width: 580px; line-height: 1.5; }

        .notepicker { display: flex; gap: 6px; margin-top: 22px; flex-wrap: wrap; }
        .notebtn {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          font-weight: 600;
          padding: 9px 0;
          width: 42px;
          text-align: center;
          border-radius: 6px;
          border: 1px solid #3A3226;
          background: #1F1A13;
          color: #D8CDB8;
          cursor: pointer;
          position: relative;
          transition: transform .12s ease, border-color .12s ease;
        }
        .notebtn.sharp { background: #17130E; color: #A99C86; }
        .notebtn:hover { transform: translateY(-2px); border-color: #C9A227; }
        .notebtn.active {
          background: #C9A227;
          color: #15120D;
          border-color: #C9A227;
        }
        .notebtn.active::after {
          content: '';
          position: absolute;
          bottom: -8px; left: 50%;
          width: 5px; height: 5px;
          margin-left: -2.5px;
          border-radius: 50%;
          background: #C9A227;
        }

        section.panel { padding: 26px 28px; border-bottom: 1px solid #221D16; }
        section.panel:last-child { border-bottom: none; }
        .panel h2 {
          font-family: 'Spectral', serif;
          font-size: 19px;
          margin: 0 0 4px;
          color: #F4EEDD;
        }
        .panel .hint { color: #7C7462; font-size: 13px; margin: 0 0 18px; }

        .fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
        @media (max-width: 640px) { .fields-grid { grid-template-columns: 1fr; } }

        .field-card { background: #1B160F; border: 1px solid #2E271C; border-radius: 8px; overflow: hidden; }
        .field-card .field-title {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          letter-spacing: .08em;
          text-transform: uppercase;
          padding: 12px 14px;
          color: #C9A227;
          border-bottom: 1px solid #2E271C;
        }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 9px 12px; text-align: left; border-bottom: 1px solid #241F16; }
        th { color: #7C7462; font-weight: 500; font-family: 'IBM Plex Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
        
        tr.clickable-row { cursor: pointer; transition: background 0.15s ease; }
        tr.clickable-row:hover { background: rgba(201, 162, 39, 0.08); }
        tr.clickable-row:active { background: rgba(201, 162, 39, 0.15); }
        
        td.roman { font-family: 'Spectral', serif; font-weight: 600; color: #EDE6D6; width: 44px; }
        td.chord { font-family: 'IBM Plex Mono', monospace; font-weight: 600; color: #E8B23D; }
        td.notes { color: #A99C86; font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
        tr:last-child td { border-bottom: none; }

        .mode-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
        .mode-tab {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #2E271C;
          background: #1B160F;
          color: #A99C86;
          cursor: pointer;
        }
        .mode-tab span { color: #6E6656; font-size: 10px; display: block; margin-top: 2px; }
        .mode-tab:hover { border-color: #C9A227; }
        .mode-tab.active { background: #B5482F; border-color: #B5482F; color: #F4EEDD; }
        .mode-tab.active span { color: #EAD4C8; }

        .mode-notes { margin: 16px 0 20px; display: flex; gap: 6px; flex-wrap: wrap; }
        .note-chip {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          padding: 4px 9px;
          border-radius: 999px;
          background: #241F16;
          border: 1px solid #3A3226;
          color: #D8CDB8;
        }
        .note-chip.root { background: #B5482F; border-color: #B5482F; color: #F4EEDD; font-weight: 600; }

        .pos-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .pos-tabs { display: flex; gap: 5px; }
        .pos-tab {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          padding: 6px 10px;
          border-radius: 5px;
          border: 1px solid #2E271C;
          background: #1B160F;
          color: #7C7462;
          cursor: pointer;
        }
        .pos-tab.active { background: #C9A227; color: #15120D; border-color: #C9A227; font-weight: 600; }
        .pos-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #6E6656; }

        .fretboard-card { background: #1B160F; border: 1px solid #2E271C; border-radius: 8px; padding: 18px 20px 10px; overflow-x: auto;}
        svg text { font-family: 'IBM Plex Mono', monospace; }

        .site-footer { padding: 22px 28px 26px; border-top: 1px solid #221D16; background: #12100B; }
        .site-footer p { margin: 0; font-size: 12.5px; line-height: 1.7; color: #7C7462; }
        .footer-links { display: inline-flex; gap: 12px; margin-left: 6px; vertical-align: middle; }
        .footer-link { display: inline-flex; align-items: center; gap: 5px; color: #C9A227; text-decoration: none; font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 500; }
        .footer-link:hover { color: #E8B23D; text-decoration: underline; }
        .footer-link svg { width: 14px; height: 14px; flex-shrink: 0; }
        .visit-counter { margin-top: 10px; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: #A99C86; }
        .visit-counter strong { color: #C9A227; font-size: 14px; }
      `}</style>

      <div className="hero">
        <p className="eyebrow">Harmonia · Acordes · Modos · Pentatônicas</p>
        <h1>Explorador de Tonalidades</h1>
        <p className="desc">
          Selecione a tônica para mapear os acordes do campo harmônico (clique neles para ver o arpejo no braço), as 5 posições da pentatônica e os modos gregos.
        </p>
        <div className="notepicker">
          {NOTES.map((n, i) => (
            <button
              key={n}
              className={`notebtn ${n.includes("#") ? "sharp" : ""} ${i === root ? "active" : ""}`}
              onClick={() => setRoot(i)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <section className="panel">
        <h2>Campo Harmônico de {rootName}</h2>
        <p className="hint">Tríades e tétrades diatônicas. <strong>Clique em qualquer acorde</strong> para ver seu mapeamento CAGED no braço.</p>
        <div className="fields-grid">
          <FieldTable 
            title={`${rootName} maior`} 
            rows={majorField} 
            onChordClick={setSelectedChord} 
          />
          <FieldTable 
            title={`${rootName} menor natural`} 
            rows={minorField} 
            onChordClick={setSelectedChord} 
          />
        </div>
      </section>

      {/* NOVO: Seção dinâmica do Acorde Selecionado (CAGED) */}
      {selectedChord && (
        <section className="panel" style={{ backgroundColor: 'rgba(201, 162, 39, 0.03)' }}>
          <h2>Mapeamento CAGED: {selectedChord.name}</h2>
          <p className="hint">
            Arpejo completo mapeando as notas <strong>{selectedChord.notes.join(' - ')}</strong> até a 15ª casa. 
            A nota vermelha é a tônica ({NOTES[selectedChord.rootIdx]}). Enxergue os shapes de C, A, G, E, D dentro destas notas!
          </p>
          <div className="fretboard-card">
            <Fretboard
              frets={Array.from({length: 16}, (_, i) => i)} // 0 a 15
              shapeByString={chordShape}
              rootIdx={selectedChord.rootIdx}
              inlayFrets={inlayFrets}
            />
          </div>
        </section>
      )}

      {/* NOVO: Seção Pentatônicas */}
      <section className="panel">
        <h2>Pentatônicas de {rootName}</h2>
        <p className="hint">As 5 caixas clássicas (2 notas por corda) mapeadas pelo braço.</p>
        
        <div className="mode-tabs" style={{ marginBottom: 16 }}>
          <button
            className={`mode-tab ${pentaType === "major" ? "active" : ""}`}
            onClick={() => { setPentaType("major"); setPentaBoxIdx(0); }}
          >
            Maior<span>{rootName} Pentatônica Maior</span>
          </button>
          <button
            className={`mode-tab ${pentaType === "minor" ? "active" : ""}`}
            onClick={() => { setPentaType("minor"); setPentaBoxIdx(0); }}
          >
            Menor<span>{rootName} Pentatônica Menor</span>
          </button>
        </div>

        <div className="mode-tabs">
          {pentaBoxes.map((_, i) => (
            <button
              key={i}
              className={`mode-tab ${i === pentaBoxIdx ? "active" : ""}`}
              onClick={() => setPentaBoxIdx(i)}
            >
              Caixa {i + 1}
            </button>
          ))}
        </div>

        <div className="pos-row" style={{ marginTop: 12 }}>
          <span className="pos-label">casas {minPentaFret}–{maxPentaFret}</span>
        </div>

        <div className="fretboard-card">
          <Fretboard
            frets={pentaFretArray}
            shapeByString={activePentaShape}
            rootIdx={root}
            inlayFrets={inlayFrets}
          />
        </div>
      </section>

      {/* Seção Modos Gregos Original */}
      <section className="panel">
        <h2>Modos Gregos de {rootName}</h2>
        <p className="hint">
          {system === "parallel"
            ? `Os 7 modos com tônica sempre em ${rootName} — cada um com notas diferentes.`
            : `Os 7 modos do campo harmônico de ${rootName} maior — todos com as mesmas notas, encadeados no braço.`}
        </p>

        <div className="mode-tabs" style={{ marginBottom: 16 }}>
          <button
            className={`mode-tab ${system === "parallel" ? "active" : ""}`}
            onClick={() => { setSystem("parallel"); setOctaveNudge(0); }}
          >
            Paralelos<span>mesma tônica ({rootName})</span>
          </button>
          <button
            className={`mode-tab ${system === "relative" ? "active" : ""}`}
            onClick={() => { setSystem("relative"); setOctaveNudge(0); }}
          >
            Relativos<span>campo harmônico de {rootName}</span>
          </button>
        </div>

        <div className="mode-tabs">
          {MODES.map((m, i) => {
            const mRoot = system === "parallel" ? rootName : NOTES[(root + MAJOR_INTERVALS[i]) % 12];
            return (
              <button
                key={m.name}
                className={`mode-tab ${i === modeIndex ? "active" : ""}`}
                onClick={() => { setModeIndex(i); setOctaveNudge(0); }}
              >
                {mRoot} {m.name}
                {m.sub && <span>{m.sub}</span>}
              </button>
            );
          })}
        </div>

        <div className="mode-notes">
          {modeNoteNames.map((n, i) => (
            <span key={i} className={`note-chip ${i === 0 ? "root" : ""}`}>{n}</span>
          ))}
        </div>

        <div className="pos-row">
          <div className="pos-tabs">
            <button
              className="pos-tab"
              disabled={minFret - 12 < 0}
              style={minFret - 12 < 0 ? { opacity: 0.35, cursor: "default" } : undefined}
              onClick={() => setOctaveNudge((v) => v - 12)}
            >
              ← 1 oitava
            </button>
            <button className="pos-tab" onClick={() => setOctaveNudge(0)}>
              posição padrão
            </button>
            <button className="pos-tab" onClick={() => setOctaveNudge((v) => v + 12)}>
              1 oitava →
            </button>
          </div>
          <span className="pos-label">casas {minFret}–{maxFret}</span>
        </div>

        <div className="fretboard-card">
          <Fretboard
            frets={frets}
            shapeByString={shapeByString}
            rootIdx={modeRoot}
            inlayFrets={inlayFrets}
          />
        </div>
      </section>

      <footer className="site-footer">
        <p>
          Mini App Criado com o Claude + Github Pages por dosv01. Aproveita, dá uma moral, e se
          inscreve nos meus canais:
          <span className="footer-links">
            <a className="footer-link" href="https://www.youtube.com/@DaniloSantosGT" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 8.5s-.2-1.6-.8-2.3c-.8-.9-1.7-.9-2.1-1C16.3 5 12 5 12 5h0s-4.3 0-7.1.2c-.4 0-1.3.1-2.1 1C2.2 6.9 2 8.5 2 8.5S1.8 10.4 1.8 12.2v1.6c0 1.9.2 3.7.2 3.7s.2 1.6.8 2.3c.8.9 1.9.9 2.4 1C6.9 21 12 21 12 21s4.3 0 7.1-.2c.4 0 1.3-.1 2.1-1 .6-.7.8-2.3.8-2.3s.2-1.9.2-3.7v-1.6c0-1.9-.2-3.7-.2-3.7ZM9.8 15.5v-6l5.6 3-5.6 3Z" />
              </svg>
              YouTube
            </a>
            <a className="footer-link" href="https://www.instagram.com/dosv01/" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
              </svg>
              Instagram
            </a>
          </span>
        </p>
        <p className="visit-counter">
          <strong>{visitCount ?? "…"}</strong> músicos já visitaram este mini App
        </p>
      </footer>
    </div>
  );
}

// ATUALIZADO: Suporte para click nas linhas
function FieldTable({ title, rows, onChordClick }) {
  return (
    <div className="field-card">
      <div className="field-title">{title}</div>
      <table>
        <thead>
          <tr>
            <th>Grau</th>
            <th>Tríade</th>
            <th>7ª</th>
            <th>Notas (7ª)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr 
              key={i} 
              className="clickable-row"
              onClick={() => onChordClick({
                name: r.seventhName,
                rootIdx: r.chordRootIdx,
                notes: r.seventhNotes,
                notesClasses: r.seventhNotesClasses
              })}
              title={`Clique para ver o mapeamento CAGED de ${r.seventhName}`}
            >
              <td className="roman">{r.roman}</td>
              <td className="chord">{r.triadName}</td>
              <td className="chord">{r.seventhName}</td>
              <td className="notes">{r.seventhNotes.join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fretboard({ frets, shapeByString, rootIdx, inlayFrets }) {
  const minFret = frets[0];
  const maxFret = frets[frets.length - 1];
  const lineStart = Math.max(minFret - 1, 0);
  const gridLines = Array.from({ length: maxFret - lineStart + 1 }, (_, i) => lineStart + i);

  const cellW = 62;
  const leftPad = 34;
  const topPad = 22;
  const rowH = 26;
  const width = leftPad + cellW * (gridLines.length - 1) + 26;
  const height = topPad + rowH * (STRINGS_TOP_TO_BOTTOM.length - 1) + 34;

  const lineX = (lineVal) => leftPad + (lineVal - lineStart) * cellW;
  const noteX = (f) => (f === 0 ? lineX(0) : (lineX(f - 1) + lineX(f)) / 2);

  const usedFrets = new Set(shapeByString.flat());

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ minWidth: 460 }}>
      {gridLines.map((lv) => (
        <line
          key={lv}
          x1={lineX(lv)} x2={lineX(lv)}
          y1={topPad} y2={topPad + rowH * (STRINGS_TOP_TO_BOTTOM.length - 1)}
          stroke={lv === 0 ? "#EDE6D6" : "#4A4130"}
          strokeWidth={lv === 0 ? 3 : 1.5}
        />
      ))}
      {STRINGS_TOP_TO_BOTTOM.map((s, r) => (
        <line
          key={r}
          x1={lineX(lineStart)} x2={lineX(maxFret)}
          y1={topPad + r * rowH} y2={topPad + r * rowH}
          stroke="#6E6656" strokeWidth={1}
        />
      ))}
      {gridLines.map((f) => {
        if (f < 1 || !inlayFrets.has(f) || (!usedFrets.has(f) && frets.length < 10)) return null;
        const cy = topPad + rowH * (STRINGS_TOP_TO_BOTTOM.length - 1) + 16;
        return <circle key={f} cx={noteX(f)} cy={cy} r={2.5} fill="#3A3226" />;
      })}
      {gridLines.map((f) => {
        if (f < 1 || (!usedFrets.has(f) && frets.length < 10)) return null;
        return (
          <text key={f} x={noteX(f)} y={topPad - 8} fontSize={10} fill="#6E6656" textAnchor="middle">
            {f}
          </text>
        );
      })}
      {STRINGS_TOP_TO_BOTTOM.map((s, r) =>
        shapeByString[r].map((f) => {
          const noteIdx = (s.idx + f) % 12;
          const isRoot = noteIdx === rootIdx;
          const cx = noteX(f);
          const cy = topPad + r * rowH;
          return (
            <g key={`${r}-${f}`}>
              <circle
                cx={cx} cy={cy} r={10}
                fill={isRoot ? "#B5482F" : "#1F1A13"}
                stroke={isRoot ? "#B5482F" : "#C9A227"} strokeWidth={1.5}
              />
              <text
                x={cx} y={cy + 3.5}
                fontSize={9.5} fontWeight={600}
                fill={isRoot ? "#F4EEDD" : "#E8B23D"} textAnchor="middle"
              >
                {NOTES[noteIdx]}
              </text>
            </g>
          );
        })
      )}
      {STRINGS_TOP_TO_BOTTOM.map((s, r) => (
        <text
          key={`label-${r}`}
          x={leftPad - 16} y={topPad + r * rowH + 3.5}
          fontSize={11} fill="#7C7462" textAnchor="middle"
        >
          {s.label}
        </text>
      ))}
    </svg>
  );
}
