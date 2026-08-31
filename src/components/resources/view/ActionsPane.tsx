import { useStore } from '@nanostores/react'
import { ArrowRightLeftIcon, PlayIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { client } from '@/client'
import { CommandForm } from '@/components/resources/view/CommandForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { kindInfo } from '@/helpers/kindSchema'
import type { Resource } from '@/proto/management/v1/resources_pb'
import { notify } from '@/stores/notificationsStore'
import { toggleWorkspacePanel } from '@/stores/workspaceLayoutStore'

// The record's ACTION surface (right column): dictionary commands with
// generated forms, plus the system verbs — transfer and delete (with
// the cascade preview from the live subtree). The server validates
// everything; failures land as notifications and inline text.
export function ActionsPane({ record }: { record: Resource }) {
  const { t } = useTranslation()
  const dictionary = useStore(client.stores.record(`kind/${record.kind}`))
  const subtree = useStore(client.stores.tree(record.ref))
  const [openCommand, setOpenCommand] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState(false)

  const info = dictionary.data === null ? null : kindInfo(dictionary.data)
  const commands = (info?.commands ?? []).filter((c) => c.name !== 'entity-set-labels')

  const runCommand = async (name: string, payload: Record<string, unknown>) => {
    const result = await client.resource(record.ref).invoke(name, payload)
    notify({
      severity: 'success',
      title: t('graphene.commands.done', { command: name, ref: record.ref }),
      body: result !== '' && result !== 'null' ? result.slice(0, 200) : undefined,
    })
    setOpenCommand(null)
  }

  const handleDelete = async () => {
    if (!deleteArmed) {
      setDeleteArmed(true)
      return
    }
    setDeleteArmed(false)
    try {
      await client.resource(record.ref).delete()
      notify({ severity: 'success', title: t('graphene.commands.deleted', { ref: record.ref }) })
    } catch (err) {
      notify({
        severity: 'error',
        title: t('graphene.commands.deleteFailed', { ref: record.ref }),
        body: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t('graphene.commands.title')}
      </h3>

      {/* Kind-specific jumps. */}
      <div className="flex flex-wrap gap-1.5">
        {record.kind === 'agent' && (
          <Button size="sm" variant="outline" onClick={() => toggleWorkspacePanel('terminal')}>
            <PlayIcon />
            {t('graphene.commands.openTerminal')}
          </Button>
        )}
      </div>

      {/* Dictionary commands with generated forms. */}
      <div className="flex flex-col gap-1.5">
        {dictionary.loaded && commands.length === 0 && (
          <p className="text-2xs text-muted-foreground">{t('graphene.commands.none')}</p>
        )}
        {commands.map((command) => (
          <div key={command.name} className="flex flex-col gap-1.5">
            <Button
              size="sm"
              variant={openCommand === command.name ? 'secondary' : 'outline'}
              className="justify-start font-mono"
              onClick={() => setOpenCommand(openCommand === command.name ? null : command.name)}
            >
              {command.name}
            </Button>
            {openCommand === command.name && (
              <CommandForm
                fields={command.fields}
                submitLabel={t('graphene.commands.invoke')}
                onSubmit={(payload) => runCommand(command.name, payload)}
                onCancel={() => setOpenCommand(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* System verbs. */}
      <div className="mt-1 flex flex-col gap-1.5 border-t border-border pt-2">
        <Button
          size="sm"
          variant="outline"
          className="justify-start"
          onClick={() => setTransferOpen((v) => !v)}
        >
          <ArrowRightLeftIcon />
          {t('graphene.commands.transfer')}
        </Button>
        {transferOpen && <TransferForm targetRef={record.ref} onDone={() => setTransferOpen(false)} />}

        {!record.protected && (
          <>
            <Button
              size="sm"
              variant={deleteArmed ? 'destructive' : 'outline'}
              className="justify-start"
              onBlur={() => setDeleteArmed(false)}
              onClick={() => void handleDelete()}
            >
              <Trash2Icon />
              {deleteArmed ? t('graphene.commands.deleteConfirm') : t('graphene.commands.delete')}
            </Button>
            {deleteArmed && subtree.data.length > 0 && (
              <p className="text-2xs text-destructive">
                {t('graphene.commands.cascade', { count: subtree.data.length })}{' '}
                <span className="font-mono">
                  {subtree.data
                    .map((n) => n.resource?.ref ?? '')
                    .filter((r) => r !== '')
                    .join(', ')}
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function TransferForm({ targetRef, onDone }: { targetRef: string; onDone: () => void }) {
  const { t } = useTranslation()
  const [owner, setOwner] = useState('')
  const [keep, setKeep] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const handleTransfer = async () => {
    const keepSeconds = keep.trim() === '' ? 0 : Number.parseInt(keep, 10)
    setBusy(true)
    setFailure(null)
    try {
      await client.resource(targetRef).transfer(owner.trim(), Number.isNaN(keepSeconds) ? 0 : keepSeconds)
      notify({
        severity: 'success',
        title: t('graphene.commands.transferred', { ref: targetRef, owner: owner.trim() }),
      })
      onDone()
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted p-2.5">
      <Input
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        placeholder={t('graphene.commands.transferOwnerPlaceholder')}
        className="h-7 font-mono text-xs"
      />
      <Input
        value={keep}
        onChange={(e) => setKeep(e.target.value)}
        placeholder={t('graphene.commands.transferKeepPlaceholder')}
        inputMode="numeric"
        className="h-7 font-mono text-xs"
      />
      {failure !== null && <p className="text-2xs text-destructive">{failure}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || owner.trim() === ''} onClick={() => void handleTransfer()}>
          {t('graphene.commands.transfer')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {t('graphene.contexts.cancel')}
        </Button>
      </div>
    </div>
  )
}
