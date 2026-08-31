import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  selectParentSyntax,
} from '@codemirror/commands'
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language'
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint'
import { gotoLine, highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightTrailingWhitespace,
  highlightWhitespace,
  keymap,
  lineNumbers,
  placeholder as viewPlaceholder,
  rectangularSelection,
} from '@codemirror/view'
import { indentationMarkers } from '@replit/codemirror-indentation-markers'
import { showMinimap } from '@replit/codemirror-minimap'
import { tags } from '@lezer/highlight'
import { useEffect, useRef } from 'react'

import { yamlLanguage, type EditorLanguage } from '@/helpers/editorLanguage'
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
  /** The document cannot be edited (git sources). */
  readOnly?: boolean
  /** Language support + built-in check; null — plain text. Defaults
   * to yaml (the config paste box). Resolve via languageForFile. */
  language?: EditorLanguage | null
  /** Fills the parent (editor canvas): full IDE chrome — line
   * numbers, folding, active line, search, lint gutter. */
  fill?: boolean
  /** Grows with content (describe blocks) instead of the input box. */
  autoHeight?: boolean
  /** IDE toggles (fill mode): wrap, whitespace, guides, minimap. */
  ide?: {
    wordWrap: boolean
    showWhitespace: boolean
    indentationMarkers: boolean
    minimap: boolean
  }
  /** The explicit save gesture (Ctrl+S). */
  onSave?: () => void
  /** Reformat gesture (Ctrl+Alt+L). */
  onFormat?: () => void
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
  readOnly = false,
  language,
  fill = false,
  autoHeight = false,
  ide,
  onSave,
  onFormat,
  placeholder,
  className,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Callbacks live in refs so the editor is built exactly once.
  const callbacksRef = useRef({ onChange, onBlur, diagnose, onSave, onFormat })
  callbacksRef.current = { onChange, onBlur, diagnose, onSave, onFormat }
  const placeholderCompartment = useRef(new Compartment())
  const readOnlyCompartment = useRef(new Compartment())
  const languageCompartment = useRef(new Compartment())
  const ideCompartment = useRef(new Compartment())
  const indentCompartment = useRef(new Compartment())
  // The mount effect reads the initial doc through a ref so the
  // editor is built exactly once; later values sync via dispatch.
  const initialValueRef = useRef(value)
  const fillRef = useRef(fill)
  const languageRef = useRef<EditorLanguage | null>(
    language === undefined ? yamlLanguage() : language,
  )
  languageRef.current = language === undefined ? yamlLanguage() : language

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          history(),
          keymap.of([
            // The editor OWNS Tab (indent); Esc then Tab still leaves
            // the editor — the standard accessibility escape hatch.
            indentWithTab,
            {
              key: 'Mod-s',
              run: () => {
                callbacksRef.current.onSave?.()
                return true
              },
            },
            {
              key: 'Mod-Alt-l',
              run: () => {
                callbacksRef.current.onFormat?.()
                return true
              },
            },
            { key: 'Mod-g', run: gotoLine },
            { key: 'Alt-w', run: selectParentSyntax },
            ...closeBracketsKeymap,
            ...completionKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...foldKeymap,
          ]),
          EditorState.allowMultipleSelections.of(true),
          drawSelection(),
          rectangularSelection(),
          autocompletion(),
          languageCompartment.current.of([]),
          readOnlyCompartment.current.of([]),
          indentCompartment.current.of(indentUnit.of('    ')),
          ideCompartment.current.of([]),
          syntaxHighlighting(highlight),
          bracketMatching(),
          closeBrackets(),
          indentOnInput(),
          ...(fillRef.current
            ? [
                lineNumbers(),
                foldGutter(),
                highlightActiveLine(),
                highlightActiveLineGutter(),
                highlightSelectionMatches(),
                highlightTrailingWhitespace(),
                lintGutter(),
              ]
            : []),
          linter((v) => {
            const length = v.state.doc.length
            const clamp = (d: { from: number; to: number; message: string }) => ({
              from: Math.min(d.from, length),
              to: Math.min(Math.max(d.to, d.from), length),
              severity: 'error' as const,
              message: d.message,
            })
            const own = languageRef.current?.lint?.(v) ?? []
            const external = callbacksRef.current.diagnose?.(v.state.doc.toString()) ?? []
            return [...own, ...external].map(clamp)
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

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
    })
  }, [readOnly])

  // biome-ignore lint/correctness/useExhaustiveDependencies: languageRef tracks the prop.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: [
        languageCompartment.current.reconfigure(languageRef.current?.support ?? []),
        indentCompartment.current.reconfigure(indentUnit.of(languageRef.current?.indent ?? '    ')),
      ],
    })
  }, [language])

  // IDE toggles (wrap, whitespace, guides, minimap) fold in live.
  useEffect(() => {
    const view = viewRef.current
    if (view === null || ide === undefined) return
    const minimapCreate = (v: EditorView) => {
      void v
      const dom = document.createElement('div')
      return { dom }
    }
    view.dispatch({
      effects: ideCompartment.current.reconfigure([
        ide.wordWrap ? EditorView.lineWrapping : [],
        ide.showWhitespace ? highlightWhitespace() : [],
        ide.indentationMarkers
          ? indentationMarkers({
              hideFirstIndent: true,
              colors: {
                light: 'var(--indent-guide)',
                dark: 'var(--indent-guide)',
                activeLight: 'var(--indent-guide-active)',
                activeDark: 'var(--indent-guide-active)',
              },
            })
          : [],
        ide.minimap
          ? showMinimap.compute([], () => ({ create: minimapCreate, displayText: 'blocks' }))
          : [],
      ]),
    })
  }, [ide])

  return (
    <div
      ref={hostRef}
      id={id}
      data-invalid={invalid || undefined}
      data-fill={fill || undefined}
      data-auto={autoHeight || undefined}
      className={cn('code-editor', className)}
    />
  )
}
