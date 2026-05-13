/**
 * Stock Unraid Docker template UI defines `openFileBrowser` (CreateDocker.php) on the
 * top window when those scripts are loaded. Same-origin iframe can reuse it when present.
 * @see https://github.com/unraid/webgui/blob/master/emhttp/plugins/dynamix.docker.manager/include/CreateDocker.php
 */
export function tryOpenUnraidFileBrowser(el: HTMLInputElement): boolean {
  const topWin = (typeof window !== 'undefined' && window.top) || window
  const fn = (
    topWin as Window & {
      openFileBrowser?: (
        input: HTMLInputElement,
        top: string,
        root: string,
        filter: string,
        onFolders: boolean,
        onFiles: boolean,
        closeOnSelect?: boolean,
      ) => void
    }
  ).openFileBrowser
  if (typeof fn !== 'function') return false
  const start = (el.value || '/mnt/user/').trim() || '/mnt/user/'
  try {
    fn.call(topWin, el, start, start, '', true, true, true)
    return true
  } catch {
    return false
  }
}
