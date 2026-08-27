import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { yaml } from '@codemirror/lang-yaml'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { linter, type Diagnostic } from '@codemirror/lint'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder as viewPlaceholder } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

// Token → theme-token classes; colors live in index.css (--code-*).
const highlight = HighlightStyle.define([
  { tag: [tags.propertyName, tags.attributeName], class: 'code-tok-key' },
  { tag: [tags.string, tags.attributeValue], class: 'code-tok-string' },
  { tag: tags.number, class: 'code-tok-number' },
  { tag: [tags.bool, tags.null, tags.keyword], class: 'code-tok-keyword' },
  { tag: [tags.comment, tags.meta], class: 'code-tok-comment' },
  { tag: [tags.punctuation, tags.separator, tags.bracket], class: 'code-tok-punct' },
])

export type CodeDiagnostic = Pick<Diagnostic, 'from' | 'to' | 'message'>

interface CodeEditorProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  /** Returns problems for the current text; empty — the text is fine.
   * Ranges are clamped to the document. */
  diagnose?: (text: string) => CodeDiagnostic[]
  invalid?: boolean
  placeholder?: string
  className?: string
}

/** YAML code surface (CodeMirror 6) styled as a kit input: RHF-friendly
 * controlled value, token-driven highlighting, wavy lint underlines. */
export function CodeEditor({
  id,
  value,
  onChange,
  onBlur,
  diagnose,
  invalid = false,
  placeholder,
  className,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Callbacks live in refs so the editor is built exactly once.
  const callbacksRef = useRef({ onChange, onBlur, diagnose })
  callbacksRef.current = { onChange, onBlur, diagnose }
  const placeholderCompartment = useRef(new Compartment())
  // The mount effect reads the initial doc through a ref so the
  // editor is built exactly once; later values sync via dispatch.
  const initialValueRef = useRef(value)

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          yaml(),
          syntaxHighlighting(highlight),
          linter((v) => {
            const diagnoseNow = callbacksRef.current.diagnose
            if (diagnoseNow === undefined) return []
            const length = v.state.doc.length
            return diagnoseNow(v.state.doc.toString()).map((d) => ({
              from: Math.min(d.from, length),
              to: Math.min(Math.max(d.to, d.from), length),
              severity: 'error' as const,
              message: d.message,
            }))
          }),
          placeholderCompartment.current.of([]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              callbacksRef.current.onChange(update.state.doc.toString())
            }
          }),
          EditorView.domEventHandlers({
            blur: () => callbacksRef.current.onBlur?.(),
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      viewRef.current = null
      view.destroy()
    }
  }, [])

  // External value changes (reset, programmatic set) fold into the doc.
  useEffect(() => {
    const view = viewRef.current
    if (view === null) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (view === null) return
    view.dispatch({
      effects: placeholderCompartment.current.reconfigure(
        placeholder === undefined ? [] : viewPlaceholder(placeholder),
      ),
    })
  }, [placeholder])

  return (
    <div
      ref={hostRef}
      id={id}
      data-invalid={invalid || undefined}
      className={cn('code-editor', className)}
    />
  )
}
