import { describe, expect, it } from 'vitest'
import { stepsOf, textMaterials } from '../lessonUtils.js'

describe('textMaterials', () => {
  it('extrai os textos de materiais no formato { type, data }', () => {
    expect(textMaterials([{ type: 'text', data: 'contexto' }])).toEqual(['contexto'])
  })

  it('aceita strings soltas', () => {
    expect(textMaterials(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('devolve lista vazia para entrada invalida', () => {
    expect(textMaterials(null)).toEqual([])
    expect(textMaterials(undefined)).toEqual([])
    expect(textMaterials('texto')).toEqual([])
  })
})

describe('stepsOf', () => {
  it('le o formato novo (steps)', () => {
    const steps = [{ statement: 'a' }]
    expect(stepsOf({ content: { steps } })).toBe(steps)
  })

  it('cai no formato legado (questions)', () => {
    const questions = [{ statement: 'a' }]
    expect(stepsOf({ content: { questions } })).toBe(questions)
  })

  it('prefere steps quando os dois existem', () => {
    const steps = [{ statement: 'novo' }]
    const task = { content: { steps, questions: [{ statement: 'antigo' }] } }
    expect(stepsOf(task)).toBe(steps)
  })

  it('devolve lista vazia sem conteudo', () => {
    expect(stepsOf(null)).toEqual([])
    expect(stepsOf({})).toEqual([])
    expect(stepsOf({ content: {} })).toEqual([])
  })
})
