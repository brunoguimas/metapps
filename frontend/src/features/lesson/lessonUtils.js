// ─── HELPERS DO EXERCÍCIO ────────────────────────────────────────────
//
// Separado do componente para manter o fast refresh do Vite functioning:
// um arquivo de componente só exporta componentes.

/**
 * Extrai os textos de um material (array de { type, data } ou strings).
 */
export function textMaterials(rawMaterial) {
  if (!Array.isArray(rawMaterial)) return []
  return rawMaterial
    .map(m => (typeof m === 'string' ? m : m?.data))
    .filter(Boolean)
}

/**
 * Normaliza o conteúdo de uma sessão para a lista de exercícios.
 *
 * Aceita o formato novo (`steps`) e o legado (`questions`), para que
 * tasks criadas antes da migração continuem jogáveis.
 */
export function stepsOf(task) {
  const content = task?.content || {}
  if (Array.isArray(content.steps) && content.steps.length > 0) {
    return content.steps
  }
  if (Array.isArray(content.questions) && content.questions.length > 0) {
    return content.questions
  }
  return []
}
