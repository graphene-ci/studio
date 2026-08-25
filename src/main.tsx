import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import i18n from '@/lib/i18n'
import { $lang } from '@/stores/langStore'
import { startHealthPolling } from '@/stores/contextHealthStore'
import { restoreSession } from '@/stores/sessionStore'
import { $theme, THEMES } from '@/stores/themeStore'
import '@/index.css'
import App from '@/App'
import { TooltipProvider } from '@/components/ui/tooltip'

// Composition-root wiring: stores → document/i18n.
$theme.subscribe((theme) => {
  const root = document.documentElement
  root.classList.remove(...THEMES)
  root.classList.add(theme)
})

$lang.subscribe((lang) => {
  void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
})

void restoreSession()

// Background context health: every 10s while the tab is visible.
startHealthPolling(10_000, () => document.visibilityState === 'visible')

const root = document.getElementById('root')
if (root === null) throw new Error('Graphene Studio root element is missing')

createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>,
)
