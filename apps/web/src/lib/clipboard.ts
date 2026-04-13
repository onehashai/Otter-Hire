export async function copyToClipboard(text: string): Promise<boolean> {
  const value = String(text ?? "").trim();
  if (!value) return false;

  // Modern clipboard API (works in secure contexts - HTTPS)
  if (typeof window !== "undefined" && window.isSecureContext && window.navigator?.clipboard) {
    try {
      await window.navigator.clipboard.writeText(value);
      return true;
    } catch (err) {
      // Fall through to fallback method
    }
  }

  // Fallback for non-secure contexts (HTTP) or when modern API fails
  return new Promise((resolve) => {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.padding = "0";
    textarea.style.border = "none";
    textarea.style.outline = "none";
    textarea.style.boxShadow = "none";
    textarea.style.background = "transparent";

    document.body.appendChild(textarea);

    let copyEventFired = false;
    const copyListener = (e: ClipboardEvent) => {
      copyEventFired = true;
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData("text/plain", value);
      }
    };

    document.addEventListener("copy", copyListener);

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);

    let success = false;
    try {
      success = document.execCommand("copy");
    } catch (err) {
      // Ignore error
    }

    document.removeEventListener("copy", copyListener);
    document.body.removeChild(textarea);

    resolve(success || copyEventFired);
  });
}
