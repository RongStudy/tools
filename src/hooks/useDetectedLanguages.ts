import { useEffect, useState } from 'react'
import { detectLanguageFromContent, detectLanguageFromFileName } from '../utils/languageDetection'

export type LanguageInput = { id: string; language: string; content: string; filename?: string }
const DETECTION_DELAY = 400

/** Keep automatic selection separate from the inferred Monaco language. */
export const useDetectedLanguages = (inputs: LanguageInput[]) => {
  const [detected, setDetected] = useState<Record<string, string>>({})
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDetected(Object.fromEntries(inputs.map(({ id, language, content, filename }) => [
        id,
        language === 'auto'
          ? content.trim() ? detectLanguageFromContent(content, detectLanguageFromFileName(filename ?? '')) : 'plaintext'
          : language,
      ])))
    }, DETECTION_DELAY)
    return () => window.clearTimeout(timer)
  }, [inputs])
  return Object.fromEntries(inputs.map(({ id, language, content }) => [
    id, language === 'auto' ? content.trim() ? detected[id] ?? 'plaintext' : 'plaintext' : language,
  ]))
}
