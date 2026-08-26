import { useStore } from '@nanostores/react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router'

import { AppLayout } from '@/pages/AppLayout'
import { $contexts, $currentContext } from '@/stores/contextsStore'

// RootRedirect lands "/" on the current context's empty workspace.
function RootRedirect() {
  const contexts = useStore($contexts)
  const current = useStore($currentContext)
  const ns = contexts[current]?.namespace || 'default'
  return <Navigate to={`/n/${ns}`} replace />
}

function App() {
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/n/:ns/*" element={<AppLayout />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Router>
  )
}

export default App
