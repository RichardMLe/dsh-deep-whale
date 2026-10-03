/**
 * Whale balance widget boot (2026-10-02): dsh-whale-widget's host half
 * serves the widget script at /dsh-whale/widget.js, but the old page
 * injection (webServer.tapIndex) no longer applies in the new shell.
 * A hand-written client half for the widget package was tried and the app
 * crashed at restart, so the injection now rides the skin's own stable
 * client channel instead: append the official script tag, dispose removes it.
 * The script self-deduplicates (window.__dshWhaleWidget), and a 404 route
 * is harmless.
 */
const WIDGET_SCRIPT_SRC = '/dsh-whale/widget.js'

export function installMaidWhaleWidget(body: HTMLElement): () => void {
  const doc = body.ownerDocument
  const script = doc.createElement('script')
  script.src = WIDGET_SCRIPT_SRC
  script.defer = true
  script.setAttribute('data-skin-chrome', 'whale-widget')
  script.setAttribute('data-skin-owner', 'maid-atelier')
  doc.head.append(script)
  return () => {
    script.remove()
  }
}
