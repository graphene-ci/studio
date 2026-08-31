import { createClient, type Interceptor } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'

import { AgentsAPI } from '@/proto/management/v1/agents_pb'
import { NamespacesAPI } from '@/proto/management/v1/namespaces_pb'
import { ObserveAPI } from '@/proto/management/v1/observe_pb'
import { RbacAPI } from '@/proto/management/v1/rbac_pb'
import { ResourcesAPI } from '@/proto/management/v1/resources_pb'
import { RevisionsAPI } from '@/proto/management/v1/revisions_pb'
import { RunsAPI } from '@/proto/management/v1/runs_pb'
import { SecretsAPI } from '@/proto/management/v1/secrets_pb'
import { SourceAPI } from '@/proto/management/v1/source_pb'

export interface ApiAuth {
  token: string
  namespace: string
}

/** Builds a client set for one server. Auth is read per request, so
 * token/namespace changes need no rebuild — only a baseUrl change does. */
export function makeApi(baseUrl: string, auth: () => ApiAuth) {
  const withAuth: Interceptor = (next) => (req) => {
    const { token, namespace } = auth()
    if (token !== '') req.header.set('Authorization', `Bearer ${token}`)
    // A per-call header wins: system-namespace reads (the namespace
    // dictionary lives in graphene-system) pass their own scope.
    if (namespace !== '' && !req.header.has('x-graphene-namespace')) {
      req.header.set('x-graphene-namespace', namespace)
    }
    return next(req)
  }
  const transport = createConnectTransport({ baseUrl, interceptors: [withAuth] })
  return {
    agents: createClient(AgentsAPI, transport),
    namespaces: createClient(NamespacesAPI, transport),
    observe: createClient(ObserveAPI, transport),
    rbac: createClient(RbacAPI, transport),
    resources: createClient(ResourcesAPI, transport),
    revisions: createClient(RevisionsAPI, transport),
    runs: createClient(RunsAPI, transport),
    secrets: createClient(SecretsAPI, transport),
    source: createClient(SourceAPI, transport),
  }
}

export type Api = ReturnType<typeof makeApi>
