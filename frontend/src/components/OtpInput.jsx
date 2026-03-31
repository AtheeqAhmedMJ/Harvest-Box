import { useRef, useEffect } from "react";

const BOX = {
  width: "48px", height: "56px",
  textAlign: "center", fontSize: "20px", fontWeight: "600",
  borderRadius: "12px",
  border: "1.5px solid transparent",
  background: "var(--bg-clay-light)",
  boxShadow: "var(--shadow-pressed)",
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
  color: "var(--text-dark)",
  caretColor: "var(--accent-green)",
};
const BOX_FOCUS = {
  ...BOX,
  borderColor: "var(--accent-green)",
  boxShadow: "var(--shadow-pressed), 0 0 0 3px rgba(58,125,68,0.15)",
};

export default function OtpInput({ value = "", onChange, onComplete }) {
  const refs = useRef([]);

  // Sync DOM values when value changes externally (e.g. clear on error)
  useEffect(() => {
    refs.current.forEach((el, i) => {
      if (el) el.value = value[i] ?? "";
    });
  }, [value]);

  function handleChange(e, i) {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    const chars = value.split("");
    chars[i] = digit;
    const next = chars.join("").slice(0, 6);
    onChange(next);
    if (digit && i < 5) refs.current[i + 1]?.focus();
    if (next.length === 6 && !next.includes("")) onComplete?.(next);
  }

  function handleKeyDown(e, i) {
    if (e.key === "Backspace") {
      if (!value[i] && i > 0) {
        refs.current[i - 1]?.focus();
        // clear the previous slot
        const chars = value.split("");
        chars[i - 1] = "";
        onChange(chars.join(""));
      }
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 5);
    refs.current[focusIdx]?.focus();
    if (pasted.length === 6) onComplete?.(pasted);
  }

  function handleFocus(e) {
    e.target.select();
    Object.assign(e.target.style, BOX_FOCUS);
  }
  function handleBlur(e) {
    Object.assign(e.target.style, BOX);
  }

  return (
    <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={el => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          defaultValue={value[i] ?? ""}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKeyDown(e, i)}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={BOX}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
