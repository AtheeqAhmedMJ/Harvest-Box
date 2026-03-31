import { useState, useCallback, useEffect, useMemo, memo, useRef } from "react";
import { apiUpload } from "../../api/client";
import { useUploadStore, useReportsStore } from "../../store/useAppStore";
import { getCoords } from "../../services/weatherService";
import UploadProgress from "../../components/UploadProgress/UploadProgress";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import "./fieldSetup.css";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function sanitize(str) {
  return str.replace(/[<>"'`]/g, "");
}

function validateFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith("image/")) return "Only image files are allowed.";
    if (f.size > MAX_SIZE) return `"${f.name}" exceeds the 5 MB limit.`;
  }
  return null;
}

function useObjectUrls(files) {
  const urls = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [urls]);
  return urls;
}

/* ── Leaf photo instructions card ── */
function LeafInstructions() {
  const [open, setOpen] = useState(false);
  return (
    <div className="clay-card fs-instructions">
      <button className="fs-instr-toggle" onClick={() => setOpen(o => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="fs-instr-icon">📸</span>
          <div>
            <div className="fs-instr-title">How to photograph your leaf</div>
            <div className="fs-instr-sub">Follow these steps for accurate AI diagnosis</div>
          </div>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          width="16" height="16"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="fs-instr-body">
          <div className="fs-instr-rule">
            <span className="fs-instr-num">1</span>
            <div>
              <strong>One leaf at a time</strong>
              <p>Pick one leaf per photo. Do not photograph a bunch of leaves together — the AI analyses a single leaf only.</p>
            </div>
          </div>
          <div className="fs-instr-rule">
            <span className="fs-instr-num">2</span>
            <div>
              <strong>Use a plain background</strong>
              <p>Place the leaf on white paper, a white cloth, or bare soil. Avoid grass, other leaves, or shadows behind it.</p>
            </div>
          </div>
          <div className="fs-instr-rule">
            <span className="fs-instr-num">3</span>
            <div>
              <strong>Good lighting — no direct sun</strong>
              <p>Shoot in open shade or indoors near a window. Avoid harsh shadows or glare that hides symptoms.</p>
            </div>
          </div>
          <div className="fs-instr-rule">
            <span className="fs-instr-num">4</span>
            <div>
              <strong>Fill the frame</strong>
              <p>Get close so the leaf fills at least 70% of the photo. Hold the camera steady — blurry photos reduce accuracy.</p>
            </div>
          </div>
          <div className="fs-instr-rule">
            <span className="fs-instr-num">5</span>
            <div>
              <strong>Photograph the TOP of the leaf</strong>
              <p>Most grape diseases show first on the upper leaf surface. If you see white powder or spots on the underside too, take a second photo of that.</p>
            </div>
          </div>
          <div className="fs-instr-rule">
            <span className="fs-instr-num">6</span>
            <div>
              <strong>Pick a symptomatic leaf</strong>
              <p>Choose leaves that look sick — not leaves that look fully healthy. Early-stage spots or discolouration are ideal for diagnosis.</p>
            </div>
          </div>
          <div className="fs-instr-note">
            ⚠️ Our model currently supports <strong>grape leaves only</strong>. Results for other crops may not be accurate.
          </div>
        </div>
      )}
    </div>
  );
}

const PreviewGrid = memo(({ previews, onRemove }) => (
  <div className="fs-previews">
    {previews.map((url, i) => (
      <div key={i} className="fs-preview-item">
        <img src={url} alt={`Preview ${i + 1}`} loading="lazy" decoding="async" />
        <button
          className="fs-preview-remove"
          onClick={() => onRemove(i)}
          aria-label="Remove image"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    ))}
  </div>
));

export default function FieldSetup() {
  const [fieldName, setFieldName] = useState("");
  const [row, setRow]             = useState("");
  const [col, setCol]             = useState("");
  const [images, setImages]       = useState([]);
  const [error, setError]         = useState(null);
  const [dragOver, setDragOver]   = useState(false);
  const coordsRef                 = useRef(null);   // cached GPS coords

  const upload = useUploadStore();
  const { clearCache } = useReportsStore();

  const previews = useObjectUrls(images);

  // Fetch GPS coords eagerly when component mounts
  useEffect(() => {
    getCoords()
      .then(c => { coordsRef.current = c; })
      .catch(() => {}); // silent — backend defaults will be used as fallback
  }, []);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList);
    const err = validateFiles(files);
    if (err) { setError(err); return; }
    setError(null);
    setImages(prev => [...prev, ...files]);
  }, []);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  function handleRemove(i) {
    setImages(prev => prev.filter((_, idx) => idx !== i));
  }

  async function simulateProcessingSteps(uploadPromise) {
    upload.start();
    const processingTimer = setTimeout(() => upload.setProcessing(), 1200);
    const generatingTimer = setTimeout(() => upload.setGenerating(), 3000);

    try {
      const data = await uploadPromise;
      clearTimeout(processingTimer);
      clearTimeout(generatingTimer);
      upload.setDone({ pdfUrl: data.reportPdfUrl, health: data.health });
      clearCache();
      return data;
    } catch (err) {
      clearTimeout(processingTimer);
      clearTimeout(generatingTimer);
      upload.setError(err.message || "Upload failed. Please try again.");
      throw err;
    }
  }

  async function handleAnalyze() {
    const name = sanitize(fieldName.trim());
    if (!name)                    return setError("Field area name is required.");
    if (!row || Number(row) <= 0) return setError("Enter a valid row number.");
    if (!col || Number(col) <= 0) return setError("Enter a valid column number.");
    if (!images.length)           return setError("Please upload at least one image.");

    setError(null);

    const fd = new FormData();
    fd.append("file",      images[0]);
    fd.append("row",       row);
    fd.append("col",       col);
    fd.append("fieldName", name);

    // Attach GPS coords if available — improves weather accuracy in the report
    if (coordsRef.current) {
      fd.append("lat", coordsRef.current.lat);
      fd.append("lon", coordsRef.current.lon);
    }

    try {
      await simulateProcessingSteps(apiUpload("/images/upload", fd));
    } catch {
      // Error already set inside simulateProcessingSteps
    }
  }

  const isUploading = ["uploading", "processing", "generating"].includes(upload.status);
  const result = upload.status === "done" ? upload.result : null;

  return (
    <ErrorBoundary label="Field Setup encountered an error.">
      <div className="fs-root app-page">
        <div className="fs-wrap">

          <div className="fs-header">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="fs-header-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="24" height="24">
                  <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
              </div>
              <div>
                <h1>Field Area Sampling</h1>
                <p>Upload a grape leaf photo — AI will diagnose disease and generate a full treatment report.</p>
              </div>
            </div>
          </div>

          {/* Leaf photography instructions */}
          <LeafInstructions />

          {error && (
            <div className="fs-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {upload.status !== "idle" && (
            <div style={{ marginBottom: 16 }}>
              <UploadProgress />
              {upload.status === "error" && (
                <button
                  className="primary-btn"
                  style={{ marginTop: 12 }}
                  onClick={() => { upload.reset(); setError(null); }}
                >
                  Try again
                </button>
              )}
            </div>
          )}

          <div className="clay-card fs-section">
            <label className="fs-label">Field Area Name</label>
            <input
              type="text"
              className="fs-input"
              placeholder="e.g. Vineyard Block A"
              value={fieldName}
              onChange={e => setFieldName(sanitize(e.target.value))}
              maxLength={80}
              disabled={isUploading}
            />
          </div>

          <div className="clay-card fs-section">
            <label className="fs-label">Grid Position</label>
            <div className="fs-grid-row">
              <div className="fs-grid-field">
                <span>Row</span>
                <input type="number" className="fs-input" placeholder="1" value={row} min="1"
                  onChange={e => setRow(e.target.value)} disabled={isUploading} />
              </div>
              <div className="fs-grid-sep">×</div>
              <div className="fs-grid-field">
                <span>Column</span>
                <input type="number" className="fs-input" placeholder="1" value={col} min="1"
                  onChange={e => setCol(e.target.value)} disabled={isUploading} />
              </div>
            </div>
          </div>

          <div className="clay-card fs-section">
            <label className="fs-label">Leaf Photo</label>
            <div
              className={`fs-dropzone${dragOver ? " drag-over" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isUploading && document.getElementById("fs-file-input").click()}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === "Enter" && !isUploading && document.getElementById("fs-file-input").click()}
              aria-disabled={isUploading}
            >
              <input
                id="fs-file-input"
                type="file" accept="image/*" multiple hidden
                onChange={e => addFiles(e.target.files)}
                disabled={isUploading}
              />
              <div className="fs-drop-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p className="fs-drop-text">Drop leaf photo here or <span>click to browse</span></p>
              <p className="fs-drop-hint">PNG, JPG, WEBP · Max 5 MB · One leaf at a time</p>
            </div>

            {previews.length > 0 && (
              <PreviewGrid previews={previews} onRemove={handleRemove} />
            )}
          </div>

          <button className="primary-btn fs-submit" onClick={handleAnalyze} disabled={isUploading}>
            {isUploading
              ? <><span className="btn-spinner" /> Analyzing…</>
              : <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>
                  </svg>
                  Analyze Leaf Sample
                </>
            }
          </button>

          {result && (
            <div className="clay-card fs-result">
              <div className="fs-result-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div>
                <h3>Analysis Complete</h3>
                {result.health && <p>Health status: <strong>{result.health}</strong></p>}
              </div>
              {result.pdfUrl && (
                <a href={result.pdfUrl} target="_blank" rel="noopener noreferrer" className="primary-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  View Full PDF Report
                </a>
              )}
              <button className="fs-new-btn" onClick={() => {
                upload.reset(); setImages([]); setFieldName(""); setRow(""); setCol("");
              }}>
                Analyze another
              </button>
            </div>
          )}

        </div>
      </div>
    </ErrorBoundary>
  );
}
