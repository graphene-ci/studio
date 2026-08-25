import { useStore } from '@nanostores/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { AppLayout } from '@/pages/AppLayout'
import { PipelineDetailPage } from '@/pages/PipelineDetailPage'
import { RunDetailPage } from '@/pages/RunDetailPage'
import { PipelinesPage } from '@/pages/PipelinesPage'
import { ResourcesPage } from '@/pages/ResourcesPage'
import { RunsPage } from '@/pages/RunsPage'
import { SecretsPage } from '@/pages/SecretsPage'
import { VariablesPage } from '@/pages/VariablesPage'
import { $contexts, $currentContext } from '@/stores/contextsStore'

// RootRedirect lands "/" on the current context's namespace.
function RootRedirect() {
  const contexts = useStore($contexts)
  const current = useStore($currentContext)
  const ns = contexts[current]?.namespace || 'default'
  return <Navigate to={`/n/${ns}/runs`} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/n/:ns" element={<AppLayout />}>
          <Route index element={<Navigate to="runs" replace />} />
          <Route path="pipelines" element={<PipelinesPage />} />
          <Route path="pipelines/:pipelineId" element={<PipelineDetailPage />} />
          <Route path="runs" element={<RunsPage />} />
          <Route path="runs/:runId" element={<RunDetailPage />} />
          <Route path="resources" element={<ResourcesPage />} />
          <Route path="settings/variables" element={<VariablesPage />} />
          <Route path="settings/secrets" element={<SecretsPage />} />
          <Route path="*" element={<Navigate to="runs" replace />} />
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
