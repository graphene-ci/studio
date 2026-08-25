import { createClient, type Interceptor } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'

import { NamespacesAPI } from '@/proto/management/v1/namespaces_pb'
import { ObserveAPI } from '@/proto/management/v1/observe_pb'
import { ResourcesAPI } from '@/proto/management/v1/resources_pb'
import { RunsAPI } from '@/proto/management/v1/runs_pb'
import { SecretsAPI } from '@/proto/management/v1/secrets_pb'
import { VarsAPI } from '@/proto/management/v1/vars_pb'

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
    if (namespace !== '') req.header.set('x-graphene-namespace', namespace)
    return next(req)
  }
  const transport = createConnectTransport({ baseUrl, interceptors: [withAuth] })
  return {
    namespaces: createClient(NamespacesAPI, transport),
    observe: createClient(ObserveAPI, transport),
    resources: createClient(ResourcesAPI, transport),
    runs: createClient(RunsAPI, transport),
    secrets: createClient(SecretsAPI, transport),
    vars: createClient(VarsAPI, transport),
  }
}

export type Api = ReturnType<typeof makeApi>
